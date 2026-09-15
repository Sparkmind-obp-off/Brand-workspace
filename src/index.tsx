import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { connectorError, connectorRegistry } from './connectors'
import { assertApproval, generatePlan, generateVariants, idempotencyKey, requireCapability, runQa, transitionPublication, type BrandContext, type Capability, type Channel, type PublicationStatus } from './domain'

type Bindings = {
  DB: D1Database
  OPERATOR_API_KEY?: string
  ENABLE_MOCK_CONNECTOR?: string
}

type Variables = { correlationId: string }
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const now = () => new Date().toISOString()
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`
const json = (value: unknown) => JSON.stringify(value)
function parse<T>(value: string): T { return JSON.parse(value) as T }

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function body<T>(c: Context): Promise<T> {
  try { return await c.req.json<T>() } catch { throw new Error('INVALID_JSON') }
}

function required(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`)
  return value.trim()
}

async function audit(db: D1Database, input: { workspaceId: string; entityType: string; entityId: string; action: string; actorType?: string; actorId?: string; reason?: string; correlationId: string; metadata?: unknown }) {
  await db.prepare(`INSERT INTO audit_events (id, workspace_id, entity_type, entity_id, action, actor_type, actor_id, reason, correlation_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id('audit'), input.workspaceId, input.entityType, input.entityId, input.action, input.actorType || 'user', input.actorId || 'operator', input.reason || '', input.correlationId, json(input.metadata || {}), now()).run()
}

async function ensureWorkspace(db: D1Database, workspaceId: string) {
  const workspace = await db.prepare('SELECT id FROM workspaces WHERE id = ?').bind(workspaceId).first()
  if (!workspace) throw new Error('WORKSPACE_NOT_FOUND')
}

app.use('/api/*', cors({ origin: (origin) => origin, allowHeaders: ['Content-Type', 'X-Operator-Key'], allowMethods: ['GET', 'POST', 'OPTIONS'] }))
app.use('/api/*', async (c, next) => {
  c.set('correlationId', c.req.header('X-Correlation-ID') || crypto.randomUUID())
  if (c.req.path === '/api/health') return next()
  const configured = c.env.OPERATOR_API_KEY
  if (!configured) return c.json({ error: 'SERVER_NOT_CONFIGURED', message: 'OPERATOR_API_KEY is not configured.' }, 503)
  const supplied = c.req.header('X-Operator-Key') || ''
  if (!supplied || supplied.length !== configured.length) return c.json({ error: 'UNAUTHORIZED' }, 401)
  const left = new TextEncoder().encode(supplied)
  const right = new TextEncoder().encode(configured)
  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) mismatch |= left[index] ^ right[index]
  if (mismatch !== 0) return c.json({ error: 'UNAUTHORIZED' }, 401)
  await next()
})

app.onError((error, c) => {
  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
  const status = message.includes('NOT_FOUND') ? 404 : message.includes('required') || message === 'INVALID_JSON' || message.startsWith('Invalid') ? 400 : 409
  return c.json({ error: message, correlationId: c.get('correlationId') }, status)
})

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'brand-workspace', mockConnectorEnabled: c.env.ENABLE_MOCK_CONNECTOR === 'true' }))

app.post('/api/workspaces', async (c) => {
  const input = await body<{ name?: string; timezone?: string; brand?: Partial<BrandContext> }>(c)
  const workspaceId = id('ws')
  const createdAt = now()
  const brand = input.brand || {}
  const context: BrandContext = {
    positioning: required(brand.positioning, 'brand.positioning'),
    audience: required(brand.audience, 'brand.audience'),
    offers: Array.isArray(brand.offers) ? brand.offers : [],
    differentiators: Array.isArray(brand.differentiators) ? brand.differentiators : [],
    pillars: Array.isArray(brand.pillars) && brand.pillars.length ? brand.pillars : ['Expert insight'],
    tone: required(brand.tone, 'brand.tone'),
    vocabulary: Array.isArray(brand.vocabulary) ? brand.vocabulary : [],
    claimsPolicy: brand.claimsPolicy || 'Only use facts explicitly supplied by the owner.',
    avoidTopics: Array.isArray(brand.avoidTopics) ? brand.avoidTopics : [],
    ctaPatterns: Array.isArray(brand.ctaPatterns) && brand.ctaPatterns.length ? brand.ctaPatterns : ['What is your experience?']
  }
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO workspaces (id, name, timezone, created_at) VALUES (?, ?, ?, ?)').bind(workspaceId, required(input.name, 'name'), input.timezone || 'UTC', createdAt),
    c.env.DB.prepare(`INSERT INTO brand_profiles (workspace_id, positioning, audience, offers_json, differentiators_json, pillars_json, tone, vocabulary_json, claims_policy, avoid_topics_json, cta_patterns_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(workspaceId, context.positioning, context.audience, json(context.offers), json(context.differentiators), json(context.pillars), context.tone, json(context.vocabulary), context.claimsPolicy, json(context.avoidTopics), json(context.ctaPatterns), createdAt)
  ])
  await audit(c.env.DB, { workspaceId, entityType: 'workspace', entityId: workspaceId, action: 'workspace.created', correlationId: c.get('correlationId') })
  return c.json({ id: workspaceId, name: input.name, timezone: input.timezone || 'UTC', brand: context }, 201)
})

app.get('/api/workspaces', async (c) => {
  const result = await c.env.DB.prepare('SELECT id, name, timezone, created_at FROM workspaces ORDER BY created_at DESC').all()
  return c.json({ workspaces: result.results })
})

app.post('/api/ideas', async (c) => {
  const input = await body<{ workspaceId?: string; rawText?: string; sourceMaterial?: string; channels?: Channel[] }>(c)
  const workspaceId = required(input.workspaceId, 'workspaceId')
  await ensureWorkspace(c.env.DB, workspaceId)
  const profile = await c.env.DB.prepare('SELECT * FROM brand_profiles WHERE workspace_id = ?').bind(workspaceId).first<Record<string, string>>()
  if (!profile) throw new Error('BRAND_PROFILE_NOT_FOUND')
  const context: BrandContext = {
    positioning: profile.positioning, audience: profile.audience, offers: parse(profile.offers_json), differentiators: parse(profile.differentiators_json), pillars: parse(profile.pillars_json), tone: profile.tone, vocabulary: parse(profile.vocabulary_json), claimsPolicy: profile.claims_policy, avoidTopics: parse(profile.avoid_topics_json), ctaPatterns: parse(profile.cta_patterns_json)
  }
  const rawText = required(input.rawText, 'rawText')
  const channels = (input.channels || ['threads']) as Channel[]
  if (!channels.length || channels.some((channel) => !['instagram', 'facebook', 'threads'].includes(channel))) throw new Error('Invalid channels')
  const ideaId = id('idea'), planId = id('plan'), assetId = id('asset'), createdAt = now()
  const plan = generatePlan(rawText, context, channels)
  const variants = generateVariants(rawText, plan, context)
  const qa = runQa(`${rawText} ${input.sourceMaterial || ''}`, context, variants)
  const contentHash = await sha256(json({ plan, variants }))
  const status = qa.status === 'passed' ? 'needs_review' : 'draft'
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO ideas (id, workspace_id, raw_text, source_material, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(ideaId, workspaceId, rawText, input.sourceMaterial || '', 'processed', createdAt),
    c.env.DB.prepare('INSERT INTO content_plans (id, workspace_id, idea_id, objective, audience, pillar, channels_json, angle, cta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(planId, workspaceId, ideaId, plan.objective, plan.audience, plan.pillar, json(plan.channels), plan.angle, plan.cta, createdAt),
    c.env.DB.prepare('INSERT INTO content_assets (id, workspace_id, idea_id, plan_id, version, status, variants_json, qa_json, content_hash, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)').bind(assetId, workspaceId, ideaId, planId, status, json(variants), json(qa), contentHash, createdAt, createdAt)
  ])
  await audit(c.env.DB, { workspaceId, entityType: 'content_asset', entityId: assetId, action: 'content.generated_and_qa_completed', actorType: 'agent', actorId: 'deterministic-content-engine', reason: qa.status, correlationId: c.get('correlationId'), metadata: { riskLevel: qa.riskLevel, channels } })
  return c.json({ ideaId, plan: { id: planId, ...plan }, asset: { id: assetId, status, variants, qa, contentHash } }, 201)
})

app.post('/api/assets/:assetId/decision', async (c) => {
  const input = await body<{ workspaceId?: string; decision?: 'approved' | 'rejected'; actor?: string; note?: string }>(c)
  const workspaceId = required(input.workspaceId, 'workspaceId'), assetId = c.req.param('assetId')
  const asset = await c.env.DB.prepare('SELECT * FROM content_assets WHERE id = ? AND workspace_id = ?').bind(assetId, workspaceId).first<Record<string, string>>()
  if (!asset) throw new Error('CONTENT_ASSET_NOT_FOUND')
  if (!['approved', 'rejected'].includes(input.decision || '')) throw new Error('Invalid decision')
  const qa = parse<{ status: string }>(asset.qa_json)
  if (input.decision === 'approved' && qa.status !== 'passed') throw new Error('QA_BLOCKED')
  const decision = input.decision as 'approved' | 'rejected'
  const approvalId = id('approval')
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO approvals (id, workspace_id, content_asset_id, decision, actor, content_hash, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(approvalId, workspaceId, assetId, decision, required(input.actor, 'actor'), asset.content_hash, input.note || '', now()),
    c.env.DB.prepare('UPDATE content_assets SET status = ?, updated_at = ? WHERE id = ?').bind(decision, now(), assetId)
  ])
  await audit(c.env.DB, { workspaceId, entityType: 'content_asset', entityId: assetId, action: `content.${decision}`, actorId: input.actor, reason: input.note, correlationId: c.get('correlationId'), metadata: { contentHash: asset.content_hash } })
  return c.json({ approvalId, assetId, status: decision })
})

app.post('/api/accounts/oauth/start', async (c) => {
  const input = await body<{ workspaceId?: string; connectorKey?: string }>(c)
  const workspaceId = required(input.workspaceId, 'workspaceId'), connectorKey = required(input.connectorKey, 'connectorKey')
  await ensureWorkspace(c.env.DB, workspaceId)
  const connector = connectorRegistry(c.env.ENABLE_MOCK_CONNECTOR === 'true').get(connectorKey)
  if (!connector) throw new Error('CONNECTOR_NOT_FOUND')
  if (!connector.simulated) return c.json({ status: 'provider_unavailable', connectorKey, message: 'Official provider credentials and verified OAuth endpoint are not configured. No connection was claimed.' }, 503)
  const state = crypto.randomUUID() + crypto.randomUUID()
  await c.env.DB.prepare('INSERT INTO oauth_states (state_hash, workspace_id, provider, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').bind(await sha256(state), workspaceId, connectorKey, new Date(Date.now() + 10 * 60_000).toISOString(), now()).run()
  await audit(c.env.DB, { workspaceId, entityType: 'oauth_state', entityId: connectorKey, action: 'oauth.started', correlationId: c.get('correlationId'), metadata: { simulated: true } })
  return c.json({ status: 'awaiting_callback', state, connectorKey, simulated: true })
})

app.post('/api/accounts/oauth/callback', async (c) => {
  const input = await body<{ workspaceId?: string; connectorKey?: string; state?: string; scenario?: string }>(c)
  const workspaceId = required(input.workspaceId, 'workspaceId'), connectorKey = required(input.connectorKey, 'connectorKey'), state = required(input.state, 'state')
  const stateHash = await sha256(state)
  const oauth = await c.env.DB.prepare('SELECT * FROM oauth_states WHERE state_hash = ? AND workspace_id = ? AND provider = ?').bind(stateHash, workspaceId, connectorKey).first<Record<string, string>>()
  if (!oauth || oauth.used_at || oauth.expires_at < now()) throw new Error('INVALID_OR_EXPIRED_OAUTH_STATE')
  const connector = connectorRegistry(c.env.ENABLE_MOCK_CONNECTOR === 'true').get(connectorKey)
  if (!connector) throw new Error('CONNECTOR_NOT_FOUND')
  const profile = await connector.discoverAccount({ mockScenario: input.scenario })
  const accountId = id('acct'), createdAt = now()
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE oauth_states SET used_at = ? WHERE state_hash = ?').bind(createdAt, stateHash),
    c.env.DB.prepare(`INSERT INTO social_accounts (id, workspace_id, connector_key, provider, provider_account_id, display_name, status, capabilities_json, credential_ref, is_simulated, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`)
      .bind(accountId, workspaceId, connector.key, connector.provider, profile.providerAccountId, profile.displayName, json(profile.capabilities), connector.simulated ? null : `secret:${accountId}`, connector.simulated ? 1 : 0, createdAt, createdAt)
  ])
  await audit(c.env.DB, { workspaceId, entityType: 'social_account', entityId: accountId, action: 'account.connected', actorType: 'connector', actorId: connector.key, correlationId: c.get('correlationId'), metadata: { simulated: connector.simulated, capabilities: profile.capabilities } })
  return c.json({ id: accountId, ...profile, status: 'active', simulated: connector.simulated }, 201)
})

app.post('/api/publications', async (c) => {
  const input = await body<{ workspaceId?: string; contentAssetId?: string; socialAccountId?: string; channel?: Channel; scheduledAt?: string }>(c)
  const workspaceId = required(input.workspaceId, 'workspaceId'), assetId = required(input.contentAssetId, 'contentAssetId'), accountId = required(input.socialAccountId, 'socialAccountId'), channel = required(input.channel, 'channel') as Channel
  const asset = await c.env.DB.prepare('SELECT * FROM content_assets WHERE id = ? AND workspace_id = ?').bind(assetId, workspaceId).first<Record<string, string>>()
  const account = await c.env.DB.prepare('SELECT * FROM social_accounts WHERE id = ? AND workspace_id = ?').bind(accountId, workspaceId).first<Record<string, string | number>>()
  if (!asset) throw new Error('CONTENT_ASSET_NOT_FOUND')
  if (!account) throw new Error('SOCIAL_ACCOUNT_NOT_FOUND')
  assertApproval(asset.status as any)
  if (account.status === 'needs_reauth') throw new Error('ACCOUNT_NEEDS_REAUTH')
  requireCapability(parse<Capability[]>(String(account.capabilities_json)), 'text_publish')
  const variants = parse<Array<{ channel: Channel; body: string; hook: string; cta: string }>>(asset.variants_json)
  if (!variants.some((variant) => variant.channel === channel)) throw new Error('CHANNEL_VARIANT_NOT_FOUND')
  const key = await idempotencyKey([workspaceId, assetId, String(asset.version), accountId, channel, input.scheduledAt || 'immediate'])
  const existing = await c.env.DB.prepare('SELECT * FROM publications WHERE idempotency_key = ?').bind(key).first()
  if (existing) return c.json({ publication: existing, duplicate: true })
  const publicationId = id('pub'), createdAt = now()
  let status: PublicationStatus = 'approved'
  if (input.scheduledAt) {
    if (new Date(input.scheduledAt).getTime() <= Date.now()) throw new Error('scheduledAt must be in the future')
    status = transitionPublication(status, 'scheduled')
  }
  await c.env.DB.prepare(`INSERT INTO publications (id, workspace_id, content_asset_id, social_account_id, channel, scheduled_at, status, idempotency_key, simulated, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(publicationId, workspaceId, assetId, accountId, channel, input.scheduledAt || null, status, key, Number(account.is_simulated), createdAt, createdAt).run()
  await audit(c.env.DB, { workspaceId, entityType: 'publication', entityId: publicationId, action: input.scheduledAt ? 'publication.scheduled' : 'publication.created', correlationId: c.get('correlationId'), metadata: { idempotencyKey: key, simulated: Boolean(account.is_simulated) } })
  return c.json({ id: publicationId, status, idempotencyKey: key, simulated: Boolean(account.is_simulated) }, 201)
})

async function executePublication(db: D1Database, publicationId: string, correlationId: string, mockEnabled: boolean, scenario = 'success') {
  const publication = await db.prepare('SELECT * FROM publications WHERE id = ?').bind(publicationId).first<Record<string, string | number>>()
  if (!publication) throw new Error('PUBLICATION_NOT_FOUND')
  if (publication.status === 'published') return { publication, duplicate: true }
  const account = await db.prepare('SELECT * FROM social_accounts WHERE id = ? AND workspace_id = ?').bind(publication.social_account_id, publication.workspace_id).first<Record<string, string | number>>()
  const asset = await db.prepare('SELECT * FROM content_assets WHERE id = ? AND workspace_id = ?').bind(publication.content_asset_id, publication.workspace_id).first<Record<string, string>>()
  if (!account || !asset) throw new Error('PUBLICATION_DEPENDENCY_NOT_FOUND')
  assertApproval(asset.status as any)
  if (account.status === 'needs_reauth') {
    return { id: publicationId, status: 'needs_reauth', errorCode: 'AUTH_REQUIRED', message: 'Reconnect this account before retrying.', retryable: false }
  }
  if (account.status !== 'active') {
    return { id: publicationId, status: 'blocked', errorCode: 'AUTH_REQUIRED', message: 'The target account is not active.', retryable: false }
  }
  const current = publication.status as PublicationStatus
  const preparing = transitionPublication(current, 'preparing')
  await db.prepare('UPDATE publications SET status = ?, attempt_count = attempt_count + 1, updated_at = ? WHERE id = ?').bind(preparing, now(), publicationId).run()
  const connector = connectorRegistry(mockEnabled).get(String(account.connector_key))
  if (!connector) throw new Error('CONNECTOR_NOT_FOUND')
  const variant = parse<Array<{ channel: Channel; body: string; hook: string; cta: string }>>(asset.variants_json).find((item) => item.channel === publication.channel)
  if (!variant) throw new Error('CHANNEL_VARIANT_NOT_FOUND')
  await db.prepare('UPDATE publications SET status = ?, updated_at = ? WHERE id = ?').bind(transitionPublication(preparing, 'submitting'), now(), publicationId).run()
  try {
    const result = await connector.publish({ publicationId, workspaceId: String(publication.workspace_id), socialAccountId: String(publication.social_account_id), channel: publication.channel as Channel, text: `${variant.hook}\n\n${variant.body}\n\n${variant.cta}`, idempotencyKey: String(publication.idempotency_key) }, scenario)
    if (!result.providerPublicationId) throw new Error('Provider did not confirm a publication ID')
    await db.prepare(`UPDATE publications SET status = 'published', provider_publication_id = ?, provider_url = ?, simulated = ?, error_code = NULL, error_message = NULL, updated_at = ? WHERE id = ?`).bind(result.providerPublicationId, result.providerUrl || null, result.simulated ? 1 : 0, now(), publicationId).run()
    await audit(db, { workspaceId: String(publication.workspace_id), entityType: 'publication', entityId: publicationId, action: result.simulated ? 'publication.simulated_published' : 'publication.published', actorType: 'connector', actorId: connector.key, reason: 'Provider returned a publication identifier.', correlationId, metadata: { providerPublicationId: result.providerPublicationId, simulated: result.simulated } })
    return { id: publicationId, status: 'published', providerPublicationId: result.providerPublicationId, simulated: result.simulated }
  } catch (error) {
    const failure = connectorError(error)
    const failedStatus: PublicationStatus = failure.code === 'AUTH_EXPIRED' || failure.code === 'AUTH_REQUIRED' ? 'needs_reauth' : failure.retryable ? 'failed' : 'blocked'
    const attempts = Number(publication.attempt_count) + 1
    const nextAttemptAt = failure.retryable && attempts < 3 ? new Date(Date.now() + Math.min(60_000 * 2 ** attempts, 15 * 60_000)).toISOString() : null
    await db.prepare('UPDATE publications SET status = ?, error_code = ?, error_message = ?, next_attempt_at = ?, updated_at = ? WHERE id = ?').bind(failedStatus, failure.code, failure.message, nextAttemptAt, now(), publicationId).run()
    if (failedStatus === 'needs_reauth') await db.prepare(`UPDATE social_accounts SET status = 'needs_reauth', updated_at = ? WHERE id = ?`).bind(now(), account.id).run()
    await audit(db, { workspaceId: String(publication.workspace_id), entityType: 'publication', entityId: publicationId, action: `publication.${failedStatus}`, actorType: 'connector', actorId: connector.key, reason: failure.message, correlationId, metadata: { errorCode: failure.code, retryable: failure.retryable, nextAttemptAt } })
    return { id: publicationId, status: failedStatus, errorCode: failure.code, message: failure.message, retryable: failure.retryable, nextAttemptAt }
  }
}

app.post('/api/publications/:publicationId/execute', async (c) => {
  const input = await body<{ scenario?: string }>(c)
  return c.json(await executePublication(c.env.DB, c.req.param('publicationId'), c.get('correlationId'), c.env.ENABLE_MOCK_CONNECTOR === 'true', input.scenario))
})

app.post('/api/publications/:publicationId/feedback', async (c) => {
  const publicationId = c.req.param('publicationId')
  const publication = await c.env.DB.prepare('SELECT * FROM publications WHERE id = ?').bind(publicationId).first<Record<string, string | number>>()
  if (!publication) throw new Error('PUBLICATION_NOT_FOUND')
  if (publication.status !== 'published' || !publication.provider_publication_id) throw new Error('PUBLICATION_NOT_CONFIRMED')
  const account = await c.env.DB.prepare('SELECT * FROM social_accounts WHERE id = ?').bind(publication.social_account_id).first<Record<string, string>>()
  const connector = account && connectorRegistry(c.env.ENABLE_MOCK_CONNECTOR === 'true').get(account.connector_key)
  if (!connector) throw new Error('CONNECTOR_NOT_FOUND')
  const metrics = await connector.fetchMetrics(String(publication.provider_publication_id))
  const metricId = id('metric'), feedbackId = id('feedback'), engagement = metrics.normalized.engagement || 0, impressions = metrics.normalized.impressions || 0
  const rate = impressions ? engagement / impressions : 0
  const observation = `Observed ${impressions} impressions and ${engagement} engagement events (${(rate * 100).toFixed(1)}% observed engagement rate).`
  const recommendation = impressions < 200 ? 'Collect a larger sample before changing strategy; test one hook variation next.' : 'Preserve the core angle and test one CTA variation.'
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO metric_snapshots (id, workspace_id, publication_id, observed_at, normalized_json, raw_provider_json, simulated) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(metricId, publication.workspace_id, publicationId, now(), json(metrics.normalized), json(metrics.raw), metrics.simulated ? 1 : 0),
    c.env.DB.prepare('INSERT INTO feedback (id, workspace_id, publication_id, observation, recommendation, confidence, sample_context, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(feedbackId, publication.workspace_id, publicationId, observation, recommendation, impressions < 200 ? 0.35 : 0.6, `Single publication; ${metrics.simulated ? 'simulated' : 'provider'} metrics. Correlation only.`, now())
  ])
  await audit(c.env.DB, { workspaceId: String(publication.workspace_id), entityType: 'feedback', entityId: feedbackId, action: 'feedback.created', actorType: 'agent', actorId: 'bounded-learning-engine', correlationId: c.get('correlationId'), metadata: { simulated: metrics.simulated, sampleSize: 1 } })
  return c.json({ metricId, feedbackId, observation, recommendation, confidence: impressions < 200 ? 0.35 : 0.6, simulated: metrics.simulated }, 201)
})

app.get('/api/workspaces/:workspaceId/overview', async (c) => {
  const workspaceId = c.req.param('workspaceId')
  await ensureWorkspace(c.env.DB, workspaceId)
  const [workspace, brand, ideas, assets, accounts, publications, feedbackRows, auditRows] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM workspaces WHERE id = ?').bind(workspaceId).first(),
    c.env.DB.prepare('SELECT * FROM brand_profiles WHERE workspace_id = ?').bind(workspaceId).first(),
    c.env.DB.prepare('SELECT * FROM ideas WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 20').bind(workspaceId).all(),
    c.env.DB.prepare('SELECT * FROM content_assets WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 20').bind(workspaceId).all(),
    c.env.DB.prepare('SELECT id, connector_key, provider, provider_account_id, display_name, status, capabilities_json, is_simulated, created_at FROM social_accounts WHERE workspace_id = ? ORDER BY created_at DESC').bind(workspaceId).all(),
    c.env.DB.prepare('SELECT * FROM publications WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 20').bind(workspaceId).all(),
    c.env.DB.prepare('SELECT * FROM feedback WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 20').bind(workspaceId).all(),
    c.env.DB.prepare('SELECT * FROM audit_events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50').bind(workspaceId).all()
  ])
  const mapJson = (rows: D1Result<unknown>, keys: string[]) => rows.results.map((row: any) => {
    const decoded = Object.fromEntries(keys.map((key) => [key.replace('_json', ''), parse(row[key])]))
    const cleaned = { ...row, ...decoded, ...(row.is_simulated !== undefined ? { simulated: Boolean(row.is_simulated) } : {}) }
    for (const key of keys) delete cleaned[key]
    return cleaned
  })
  return c.json({ workspace, brand, ideas: ideas.results, assets: mapJson(assets, ['variants_json', 'qa_json']), accounts: mapJson(accounts, ['capabilities_json']), publications: publications.results.map((item: any) => ({ ...item, simulated: Boolean(item.simulated) })), feedback: feedbackRows.results, audit: auditRows.results.map((item: any) => ({ ...item, metadata: parse(item.metadata_json) })) })
})

app.get('/', (c) => c.html(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brand Workspace</title><link rel="stylesheet" href="/static/style.css"></head><body><header class="app-header"><div><p class="eyebrow">AUTONOMOUS MARKETING OPERATIONS</p><h1>Brand Workspace</h1></div><span id="system-status" class="status-pill neutral">Checking system</span></header><main id="app" class="app-shell"><noscript>JavaScript is required for the operator workspace.</noscript></main><script src="/static/app.js" defer></script></body></html>`))

export default app
