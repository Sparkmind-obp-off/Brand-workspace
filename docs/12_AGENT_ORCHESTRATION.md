# Agent Orchestration

## Principle
Agents are specialized workers inside a deterministic business workflow. They do not independently own the system or bypass approval/security controls.

## Recommended Agents
- **Intake Agent** — structures raw ideas.
- **Strategy Agent** — chooses objectives, audience, pillar, and channel plan.
- **Research Agent** — gathers permitted external evidence when enabled.
- **Content Agent** — creates canonical content and variants.
- **QA Agent** — checks facts, voice, safety, and platform constraints.
- **Publishing Agent** — prepares and executes connector jobs.
- **Analytics Agent** — interprets performance data.
- **Learning Agent** — proposes improvements.

## Orchestrator Responsibilities
- create and track tasks
- pass only required context
- enforce budgets/timeouts
- enforce approval policy
- sequence dependencies
- retry recoverable failures
- record agent outputs
- prevent recursive/unbounded execution

## Agent Contract
Every agent receives structured input and returns structured output with:
`status`, `result`, `confidence`, `warnings`, `sources`, `next_action`.

## Tool Permissions
Agents receive least-privilege tools. Content generation does not get publishing credentials. Analytics does not get write access to social accounts. Publishing can only execute an approved publication job.

## Context Management
Do not dump an entire workspace into every prompt. Retrieve relevant brand facts, content history, policies, and source material by need.

## Cost and Reliability
Set model/time budgets per task. If an agent fails, the orchestrator should use a bounded fallback or surface a recoverable error rather than silently inventing an answer.
