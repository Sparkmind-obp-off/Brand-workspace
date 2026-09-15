export type Channel = 'instagram' | 'facebook' | 'threads'
export type RiskLevel = 'low' | 'medium' | 'high'
export type AssetStatus = 'draft' | 'needs_review' | 'approved' | 'rejected'
export type AccountStatus = 'active' | 'needs_reauth' | 'disconnected' | 'provider_unavailable'
export type PublicationStatus = 'draft' | 'needs_approval' | 'approved' | 'scheduled' | 'preparing' | 'submitting' | 'published' | 'needs_reauth' | 'blocked' | 'failed' | 'cancelled'
export type ConnectorErrorCode = 'AUTH_REQUIRED' | 'AUTH_EXPIRED' | 'PERMISSION_DENIED' | 'CAPABILITY_UNAVAILABLE' | 'VALIDATION_ERROR' | 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE' | 'MEDIA_ERROR' | 'DUPLICATE_REQUEST' | 'UNKNOWN_PROVIDER_ERROR'
export type Capability = 'text_publish' | 'image_publish' | 'video_publish' | 'carousel_publish' | 'scheduled_publish' | 'insights'

export interface BrandContext {
  positioning: string
  audience: string
  offers: string[]
  differentiators: string[]
  pillars: string[]
  tone: string
  vocabulary: string[]
  claimsPolicy: string
  avoidTopics: string[]
  ctaPatterns: string[]
}

export interface ContentPlan {
  objective: string
  audience: string
  pillar: string
  channels: Channel[]
  angle: string
  cta: string
}

export interface ContentVariant {
  channel: Channel
  hook: string
  body: string
  cta: string
}

export interface QaResult {
  status: 'passed' | 'blocked'
  riskLevel: RiskLevel
  checks: Array<{ name: string; passed: boolean; detail: string }>
  warnings: string[]
}

export interface PublishInput {
  publicationId: string
  workspaceId: string
  socialAccountId: string
  channel: Channel
  text: string
  idempotencyKey: string
}

export interface PublishResult {
  status: 'published' | 'failed'
  providerPublicationId?: string
  providerUrl?: string
  simulated: boolean
  errorCode?: ConnectorErrorCode
  retryable?: boolean
  message?: string
  raw?: Record<string, unknown>
}

const transitions: Record<PublicationStatus, PublicationStatus[]> = {
  draft: ['needs_approval', 'approved', 'cancelled'],
  needs_approval: ['approved', 'blocked', 'cancelled'],
  approved: ['scheduled', 'preparing', 'cancelled'],
  scheduled: ['preparing', 'cancelled', 'blocked'],
  preparing: ['submitting', 'blocked', 'failed', 'needs_reauth'],
  submitting: ['published', 'failed', 'needs_reauth', 'blocked'],
  published: [],
  needs_reauth: ['preparing', 'cancelled'],
  blocked: ['preparing', 'cancelled'],
  failed: ['preparing', 'cancelled'],
  cancelled: []
}

export function transitionPublication(from: PublicationStatus, to: PublicationStatus): PublicationStatus {
  if (!transitions[from].includes(to)) throw new Error(`Invalid publication transition: ${from} → ${to}`)
  return to
}

export function assertApproval(assetStatus: AssetStatus): void {
  if (assetStatus !== 'approved') throw new Error('APPROVAL_REQUIRED')
}

export function requireCapability(capabilities: Capability[], required: Capability): void {
  if (!capabilities.includes(required)) throw new Error(`CAPABILITY_UNAVAILABLE:${required}`)
}

export async function idempotencyKey(parts: string[]): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('|')))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function classifyRetry(errorCode: ConnectorErrorCode): boolean {
  return errorCode === 'RATE_LIMITED' || errorCode === 'PROVIDER_UNAVAILABLE' || errorCode === 'UNKNOWN_PROVIDER_ERROR'
}

export function generatePlan(idea: string, brand: BrandContext, channels: Channel[]): ContentPlan {
  const pillar = brand.pillars[0] || 'insight'
  return {
    objective: 'Build qualified attention through a useful, evidence-grounded insight',
    audience: brand.audience,
    pillar,
    channels,
    angle: `Show what ${idea.trim()} means for ${brand.audience}`,
    cta: brand.ctaPatterns[0] || 'What would you add?'
  }
}

export function generateVariants(idea: string, plan: ContentPlan, brand: BrandContext): ContentVariant[] {
  const cleanIdea = idea.trim()
  return plan.channels.map((channel) => {
    if (channel === 'threads') return { channel, hook: cleanIdea, body: `${cleanIdea}\n\nA practical lens for ${plan.audience}: start with the smallest useful action, observe the result, then improve.`, cta: plan.cta }
    if (channel === 'instagram') return { channel, hook: `${cleanIdea} — in practice`, body: `${cleanIdea}\n\nFor ${plan.audience}, the useful move is to turn this into one clear, repeatable step. Save this as a prompt for your next work session.`, cta: plan.cta }
    return { channel, hook: `A practical note on ${cleanIdea}`, body: `${cleanIdea}\n\n${brand.positioning} This matters to ${plan.audience} because reliable progress comes from focused execution and honest feedback.`, cta: plan.cta }
  })
}

export function runQa(idea: string, brand: BrandContext, variants: ContentVariant[]): QaResult {
  const unsupportedClaimPattern = /guarantee|guaranteed|100%|best in the world|millions? in revenue/i
  const hasUnsupportedClaim = unsupportedClaimPattern.test(idea) || variants.some((v) => unsupportedClaimPattern.test(v.body))
  const hasBrandContext = Boolean(brand.positioning && brand.audience && brand.tone)
  const hasContent = variants.length > 0 && variants.every((v) => v.body.length >= 30)
  const riskLevel: RiskLevel = hasUnsupportedClaim ? 'high' : 'low'
  const checks = [
    { name: 'brand_context', passed: hasBrandContext, detail: hasBrandContext ? 'Structured brand context applied.' : 'Positioning, audience, and tone are required.' },
    { name: 'content_completeness', passed: hasContent, detail: hasContent ? 'All variants contain usable content.' : 'At least one channel variant is incomplete.' },
    { name: 'unsupported_claims', passed: !hasUnsupportedClaim, detail: hasUnsupportedClaim ? 'Potential unsupported or absolute claim detected.' : 'No common unsupported-claim pattern detected.' }
  ]
  return { status: checks.every((c) => c.passed) ? 'passed' : 'blocked', riskLevel, checks, warnings: hasUnsupportedClaim ? ['Human correction is required before approval.'] : [] }
}
