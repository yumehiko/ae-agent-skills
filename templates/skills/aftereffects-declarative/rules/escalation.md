---
name: escalation
description: Escalation policy when work is blocked by permissions or external prerequisites
---

## Escalate to yumehiko when blocked

- Missing OS-level permission or app permission required by AE/CEP tooling
- Installation/signing steps that cannot proceed in the current environment
- Credentials/secrets/API keys required for user-owned services
- Any operation that requires manual approval outside agent control

## Escalation format

Ask for one concrete action with clear reason and command/context, for example:

- "Please grant Full Disk Access to After Effects and retry `ae-cli health`."
- "Please run installer with admin permission and share the output."

Do not silently bypass or avoid blocked work. Surface the blocker and request the minimal required action.

