import type { Capability, ConnectorErrorCode, PublishInput, PublishResult } from './domain'

export interface AccountProfile {
  providerAccountId: string
  displayName: string
  capabilities: Capability[]
}

export interface SocialConnector {
  readonly key: string
  readonly provider: string
  readonly simulated: boolean
  discoverAccount(input: { authorizationCode?: string; mockScenario?: string }): Promise<AccountProfile>
  publish(input: PublishInput, scenario?: string): Promise<PublishResult>
  fetchMetrics(providerPublicationId: string): Promise<{ normalized: Record<string, number>; raw: Record<string, unknown>; simulated: boolean }>
}

export class ConnectorFailure extends Error {
  constructor(public code: ConnectorErrorCode, message: string, public retryable = false) {
    super(message)
  }
}

export class MockConnector implements SocialConnector {
  readonly key = 'mock-social-v1'
  readonly provider = 'mock'
  readonly simulated = true
  private published = new Map<string, PublishResult>()

  async discoverAccount(input: { mockScenario?: string }): Promise<AccountProfile> {
    if (input.mockScenario === 'oauth_failure') throw new ConnectorFailure('AUTH_REQUIRED', 'Simulated OAuth rejection.')
    return {
      providerAccountId: `mock_account_${crypto.randomUUID().slice(0, 8)}`,
      displayName: 'Simulation account',
      capabilities: ['text_publish', 'scheduled_publish', 'insights']
    }
  }

  async publish(input: PublishInput, scenario = 'success'): Promise<PublishResult> {
    const duplicate = this.published.get(input.idempotencyKey)
    if (duplicate) return duplicate
    if (scenario === 'expired') throw new ConnectorFailure('AUTH_EXPIRED', 'Simulated expired credential.')
    if (scenario === 'permission') throw new ConnectorFailure('PERMISSION_DENIED', 'Simulated permission denial.')
    if (scenario === 'outage') throw new ConnectorFailure('PROVIDER_UNAVAILABLE', 'Simulated transient provider outage.', true)
    if (scenario === 'validation') throw new ConnectorFailure('VALIDATION_ERROR', 'Simulated provider validation failure.')

    const result: PublishResult = {
      status: 'published',
      providerPublicationId: `sim_${crypto.randomUUID()}`,
      providerUrl: undefined,
      simulated: true,
      raw: { testMode: true, accepted: true }
    }
    this.published.set(input.idempotencyKey, result)
    return result
  }

  async fetchMetrics(_providerPublicationId: string): Promise<{ normalized: Record<string, number>; raw: Record<string, unknown>; simulated: boolean }> {
    return {
      normalized: { impressions: 120, engagement: 9, replies: 2 },
      raw: { mock_impressions: 120, mock_engagement: 9, mock_replies: 2 },
      simulated: true
    }
  }
}

export class UnavailableConnector implements SocialConnector {
  readonly simulated = false
  constructor(readonly key: string, readonly provider: string, private reason: string) {}
  async discoverAccount(): Promise<AccountProfile> { throw new ConnectorFailure('PROVIDER_UNAVAILABLE', this.reason) }
  async publish(): Promise<PublishResult> { throw new ConnectorFailure('PROVIDER_UNAVAILABLE', this.reason) }
  async fetchMetrics(): Promise<{ normalized: Record<string, number>; raw: Record<string, unknown>; simulated: boolean }> { throw new ConnectorFailure('PROVIDER_UNAVAILABLE', this.reason) }
}

export function connectorRegistry(mockEnabled: boolean): Map<string, SocialConnector> {
  const connectors: SocialConnector[] = [
    new UnavailableConnector('meta-v1', 'meta', 'Meta production connector is not configured. Complete official app review, OAuth configuration, and provider smoke testing first.'),
    new UnavailableConnector('threads-v1', 'threads', 'Threads production connector is not configured. Complete official OAuth configuration and provider smoke testing first.')
  ]
  if (mockEnabled) connectors.push(new MockConnector())
  return new Map(connectors.map((connector) => [connector.key, connector]))
}

export function connectorError(error: unknown): ConnectorFailure {
  if (error instanceof ConnectorFailure) return error
  return new ConnectorFailure('UNKNOWN_PROVIDER_ERROR', error instanceof Error ? error.message : 'Unknown provider error', true)
}
