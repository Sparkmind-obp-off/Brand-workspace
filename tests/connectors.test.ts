import { describe, expect, it } from 'vitest'
import { ConnectorFailure, MockConnector, connectorRegistry } from '../src/connectors'

const input = { publicationId: 'pub-1', workspaceId: 'ws-1', socialAccountId: 'account-1', channel: 'threads' as const, text: 'Useful post', idempotencyKey: 'same-key' }

describe('mock OAuth integration', () => {
  it('discovers an explicitly simulated account', async () => {
    const profile = await new MockConnector().discoverAccount({})
    expect(profile.providerAccountId).toMatch(/^mock_account_/)
    expect(profile.capabilities).toContain('text_publish')
  })
  it('classifies OAuth failure', async () => {
    await expect(new MockConnector().discoverAccount({ mockScenario: 'oauth_failure' })).rejects.toMatchObject({ code: 'AUTH_REQUIRED' })
  })
})

describe('mock provider publishing integration', () => {
  it('returns an explicitly simulated provider identifier', async () => {
    const result = await new MockConnector().publish(input)
    expect(result.status).toBe('published')
    expect(result.simulated).toBe(true)
    expect(result.providerPublicationId).toMatch(/^sim_/)
  })
  it('deduplicates submission in one connector session', async () => {
    const connector = new MockConnector()
    const first = await connector.publish(input)
    const duplicate = await connector.publish(input)
    expect(duplicate.providerPublicationId).toBe(first.providerPublicationId)
  })
  it.each([
    ['expired', 'AUTH_EXPIRED', false],
    ['permission', 'PERMISSION_DENIED', false],
    ['outage', 'PROVIDER_UNAVAILABLE', true],
    ['validation', 'VALIDATION_ERROR', false]
  ])('classifies %s failure', async (scenario, code, retryable) => {
    try {
      await new MockConnector().publish(input, scenario)
      throw new Error('Expected connector failure')
    } catch (error) {
      expect(error).toBeInstanceOf(ConnectorFailure)
      expect(error).toMatchObject({ code, retryable })
    }
  })
  it('keeps production connectors unavailable without credentials', async () => {
    const connector = connectorRegistry(false).get('meta-v1')!
    await expect(connector.publish(input)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
  })
})
