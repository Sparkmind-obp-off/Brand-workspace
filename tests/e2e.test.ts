import { describe, expect, it } from 'vitest'
import { MockConnector } from '../src/connectors'
import { assertApproval, generatePlan, generateVariants, idempotencyKey, requireCapability, runQa, transitionPublication, type BrandContext, type PublicationStatus } from '../src/domain'

describe('internal MVP vertical slice', () => {
  it('moves real input through approval, controlled simulation, and feedback', async () => {
    const brand: BrandContext = {
      positioning: 'Operational guidance grounded in real delivery work',
      audience: 'small service businesses', offers: ['workflow advisory'], differentiators: ['practical evidence'], pillars: ['operations'], tone: 'clear and calm', vocabulary: [], claimsPolicy: 'Owner-provided facts only', avoidTopics: [], ctaPatterns: ['Which step is hardest?']
    }
    const idea = 'Document one repeatable process before adding automation.'
    const plan = generatePlan(idea, brand, ['threads'])
    const variants = generateVariants(idea, plan, brand)
    const qa = runQa(idea, brand, variants)
    expect(qa.status).toBe('passed')

    const assetStatus = 'approved' as const
    assertApproval(assetStatus)
    const connector = new MockConnector()
    const account = await connector.discoverAccount({})
    requireCapability(account.capabilities, 'text_publish')

    let publicationStatus: PublicationStatus = 'draft'
    publicationStatus = transitionPublication(publicationStatus, 'approved')
    publicationStatus = transitionPublication(publicationStatus, 'preparing')
    publicationStatus = transitionPublication(publicationStatus, 'submitting')
    const key = await idempotencyKey(['ws-e2e', 'asset-e2e', '1', account.providerAccountId, 'threads'])
    const result = await connector.publish({ publicationId: 'pub-e2e', workspaceId: 'ws-e2e', socialAccountId: account.providerAccountId, channel: 'threads', text: variants[0].body, idempotencyKey: key })
    expect(result.providerPublicationId).toBeTruthy()
    expect(result.simulated).toBe(true)
    publicationStatus = transitionPublication(publicationStatus, 'published')
    expect(publicationStatus).toBe('published')

    const metrics = await connector.fetchMetrics(result.providerPublicationId!)
    const recommendation = metrics.normalized.impressions < 200 ? 'Collect a larger sample before changing strategy.' : 'Test one CTA variation.'
    expect(metrics.simulated).toBe(true)
    expect(recommendation).toContain('larger sample')
  })
})
