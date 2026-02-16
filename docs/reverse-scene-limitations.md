# Reverse Conversion (Existing Comp -> scene JSON): Known Limitations

This document records expected unsupported cases for the planned reverse-conversion feature (`manual scene -> scene JSON`, planned for v0.3).
The goal is to make future work explicit and avoid silent data loss during export.

## Context

- Declarative schema: `schemas/scene.schema.json`
- Scene apply implementation: `host/lib/mutation_scene_handlers.jsx` (`applyScene()`)
- Query APIs: `host/lib/query_*_handlers.jsx` (`getLayers()`, `getProperties()`, `getExpressionErrors()`, etc.)

## Limitation Categories

1. Schema/apply-side representation gaps (cannot be represented in scene JSON)
2. Query-side data gaps (representable in schema, but not retrievable today)
3. Conversion policy ambiguity (multiple valid outputs, unstable without strict rules)

## 1) Schema/Apply Representation Gaps

- Layer types
  - Current `layer.type` supports only `text | null | solid | shape`
  - `camera`, `light`, `footage`, `audio`, `precomp`, etc. are not supported
- Layer switches and advanced attributes
  - No dedicated fields for 3D layer, blending mode, track matte, guide/shy/solo, motion blur, time remap, etc.
- Composition details
  - Some comp settings (such as work area) are not fully representable in scene JSON
- Advanced shape structures
  - Complex freeform shape contents are not fully captured by dedicated schema fields

## 2) Query-Side Data Gaps

- `getLayers()` is expanded, but not all returned attributes can be mapped 1:1 into current declarative schema
- `getProperties()` now includes typed values, but some property types still fall back to string representation
- Expression/keyframe query APIs are now available, but some property value types are still not safely recoverable
- Complex keyframe payloads (Shape/Marker/Custom values) are currently excluded from export
- Essential Graphics currently provides controller names, but reverse path mapping is only possible for unique name matches

## 3) Conversion Policy Ambiguity

- `layers[].id` generation strategy (name-based / UID-based / hash-based)
- Stable mapping when multiple layers share same name/type
- Canonical selector choice for effect params (`matchName` vs display name)
- 2D/3D normalization choices for vector values

## Recommended v0.3 Policy

- Principle:
  - Export only what is supported and reliable
  - Always emit unsupported items as explicit `warnings` (never silently drop)
- Output:
  - `scene.json` + machine-readable `warnings`
  - Optional human-readable `report.md`
- Validation:
  - Auto-run `apply-scene --validate-only` after export
  - Return exact failing paths/reasons

## Future Backlog (Suggested Order)

1. Extend query APIs: expression source extraction, keyframe enumeration, richer layer detail
2. Extend schema: more layer types (precomp/footage/etc.), layer switches
3. Lock export policy: deterministic `id` generation and conflict resolution rules
4. Regression tests: automate `export -> apply -> diff` with fixture projects

## Non-goals for v0.3

- Lossless reverse conversion for all AE features
- Zero-adjustment round-trip for arbitrary hand-authored projects
