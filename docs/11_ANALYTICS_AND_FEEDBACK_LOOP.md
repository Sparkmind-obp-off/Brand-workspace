# Analytics and Feedback Loop

## Objective
Measure whether marketing activity creates meaningful outcomes and use those observations to improve future planning.

## Metric Layers
### Delivery
- published count
- failed count
- delay
- connector errors

### Attention
- impressions/reach where available
- views
- engagement
- saves/shares/replies where available

### Intent
- profile actions
- link actions
- conversations
- lead events when measurable

### Business
- qualified leads
- opportunities
- conversions
- revenue attribution where available

## Normalization
Provider-specific metrics should be mapped into a normalized schema while preserving raw provider values for traceability.

## Feedback Unit
A feedback record should connect:
`content → strategy → channel → publication → metrics → observation → recommendation`.

## Learning Rules
The system should avoid overreacting to small samples. Recommendations should include confidence/sample context and distinguish correlation from proven causation.

## Human Control
Automatic learning may adjust low-risk prioritization, but major brand positioning, offer claims, audience definitions, or strategic changes require approval.

## MVP
Analytics begins with publication status and a small reliable set of platform metrics. A sophisticated attribution system is later-stage work.
