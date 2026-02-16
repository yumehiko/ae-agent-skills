---
name: switch-to-declarative
description: Decision points for moving from imperative to declarative workflow
---

Switch to `$aftereffects-declarative` when:

- The same change must be repeated across multiple layers.
- You need reproducibility and rerun safety.
- The project now has stable `layers[].id` ownership.
- Scope has expanded from local edits to full scene restructuring.

Keep using `$aftereffects-cli` when:

- You are still investigating unknown structure.
- Only one or two localized edits are required.
- Full scene ownership has not been established yet.

