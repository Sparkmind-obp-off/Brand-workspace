# Autonomous Marketing Engine

## Objective
Convert raw owner input into a controlled marketing workflow with minimum repetitive manual work.

## Operating Cycle
### 1. Intake
Accept ideas, notes, project updates, customer questions, lessons, offers, wins, failures, and source material.

### 2. Interpretation
Extract topic, audience relevance, business relevance, evidence, claims, emotional angle, and possible content objectives.

### 3. Planning
Select content pillar, format, channel, CTA, publishing priority, and timing.

### 4. Creation
Generate a canonical content concept, then channel-native variants rather than blindly cross-posting the same copy.

### 5. Quality Gate
Check factual grounding, brand voice, repetition, platform requirements, unsafe claims, prohibited content, and missing assets.

### 6. Approval
Use policy-based approval. New/high-risk content defaults to human review; trusted low-risk flows can become more autonomous later.

### 7. Execution
Schedule or publish through the relevant connector. Every execution receives an idempotency key.

### 8. Feedback
Collect publication and performance signals and store them against the content and strategy that generated them.

### 9. Learning
Generate recommendations such as topic expansion, format adjustment, CTA change, or deprioritization. Learning proposes changes; policy controls whether they are automatically applied.

## Autonomy Levels
- **L0:** draft only
- **L1:** draft + approval
- **L2:** approved templates + scheduled publishing
- **L3:** autonomous low-risk publishing within policy
- **L4:** adaptive planning based on measured feedback

The MVP targets L1/L2 and establishes architecture for L3/L4.

## Failure Behavior
No autonomous step may silently continue after a critical dependency fails. The job becomes `blocked`, `failed`, or `needs_approval` with a recoverable reason.
