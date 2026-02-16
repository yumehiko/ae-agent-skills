---
name: propertypath
description: Stable propertyPath and expression authoring rules
---

## Required approach

- Use matchName-based paths whenever possible.
- Resolve every target path from `ae-cli properties` output before applying.
- Avoid display-name-only paths because they are less stable.

## Shape path traversal

When targeting shape internals, traverse in this order:

1. `ADBE Root Vectors Group`
2. `ADBE Vector Group`
3. `ADBE Vectors Group`
4. Concrete node (Path, Fill, Stroke, Filter, etc.)

## Expression references

- Prefer effect matchName references (example: `ADBE Slider Control-0001`).
- Validate expressions with `ae-cli expression-errors` after each apply.

## Never do

- Never guess a `propertyPath` from memory.
- Never skip path re-check after layer structure changes.

