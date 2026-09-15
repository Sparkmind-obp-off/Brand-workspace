import { describe, expect, it } from 'vitest'
import { assertApproval, classifyRetry, generatePlan, generateVariants, idempotencyKey, requireCapability, runQa, transitionPublication, type BrandContext } from '../src/domain'

const brand: BrandContext = {
  positioning: 'Practical systems for independent teams',
  audience: 'independent product teams',
  offers: ['advisory'],
  differentiators: ['evidence-led'],
  pillars: ['systems'],
  tone: 'direct and thoughtful',
  vocabulary: [],
  claimsPolicy: 'Only owner-supplied facts',
  avoidTopics: [],
  ctaPatterns: ['What would you test?']
}

describe('publication state machine', () => {
  it('allows the required happy path', () => {
    expect(transitionPublication('draft', 'approved')).toBe('approved')
    expect(transitionPublication('approved', 'scheduled')).toBe('scheduled')
    expect(transitionPublication('scheduled', 'preparing')).toBe('preparing')
    expect(transitionPublication('preparing', 'submitting')).toBe('submitting')
    expect(transitionPublication('submitting', 'published')).toBe('published')
  })
  it('rejects ambiguous or unsafe jumps', () => expect(() => transitionPublication('draft', 'published')).toThrow('Invalid publication transition'))
})

describe('approval and capability policy', () => {
  it('requires an approved asset', () => {
    expect(() => assertApproval('needs_review')).toThrow('APPROVAL_REQUIRED')
    expect(() => assertApproval('approved')).not.toThrow()
  })
  it('requires runtime capabilities', () => {
    expect(() => requireCapability(['insights'], 'text_publish')).toThrow('CAPABILITY_UNAVAILABLE')
    expect(() => requireCapability(['text_publish'], 'text_publish')).not.toThrow()
  })
})

describe('content and QA boundary', () => {
  it('creates channel-native variants from structured brand context', () => {
    const plan = generatePlan('Small feedback loops improve delivery', brand, ['threads', 'facebook'])
    const variants = generateVariants('Small feedback loops improve delivery', plan, brand)
    expect(variants).toHaveLength(2)
    expect(variants[0].body).not.toEqual(variants[1].body)
    expect(runQa('Small feedback loops improve delivery', brand, variants).status).toBe('passed')
  })
  it('blocks common unsupported absolute claims', () => {
    const plan = generatePlan('Our method guarantees millions in revenue', brand, ['threads'])
    const qa = runQa('Our method guarantees millions in revenue', brand, generateVariants('Our method guarantees millions in revenue', plan, brand))
    expect(qa.status).toBe('blocked')
    expect(qa.riskLevel).toBe('high')
  })
})

describe('idempotency and retry', () => {
  it('is deterministic for the same intent', async () => {
    const first = await idempotencyKey(['ws', 'asset', '1', 'account', 'threads'])
    const second = await idempotencyKey(['ws', 'asset', '1', 'account', 'threads'])
    expect(first).toBe(second)
    expect(first).toHaveLength(64)
  })
  it('retries transient errors only', () => {
    expect(classifyRetry('PROVIDER_UNAVAILABLE')).toBe(true)
    expect(classifyRetry('RATE_LIMITED')).toBe(true)
    expect(classifyRetry('PERMISSION_DENIED')).toBe(false)
    expect(classifyRetry('VALIDATION_ERROR')).toBe(false)
  })
})
