---
name: escalation
description: Escalation policy when imperative AE work is blocked
---

## Escalate to yumehiko when blocked

- AE/CEP permission dialogs or OS-level access controls block execution
- Signed extension install/update cannot proceed without user action
- Environment setup requires manual trust/approval
- Secrets or credentials are required and unavailable

## Escalation format

Request one explicit action and include the blocked command/context, for example:

- "Please open AE once and allow extension permission, then run `ae-cli health`."
- "Please install the signed ZXP with UPIA/ExManCmd and share the result."

Do not work around blocked permission prerequisites silently.

