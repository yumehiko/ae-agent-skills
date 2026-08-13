# py-aep API notes

Use these notes only when API discovery stalls.

- `project.items` is a dictionary keyed by item ID. Iterate `project.items.values()`, or use
  typed views such as `project.compositions` and `project.footages`; iterating `project.items`
  itself yields integer IDs.
- Read keyframes with `prop.keyframes`; use `len(prop.keyframes)` for the ExtendScript-like
  key count. In py-aep 0.15.0 there is no `num_keys` convenience property.
- Call `prop.value_at_time(time)` for offline pre-expression interpolation. Do not pass
  `pre_expression=False`: that requests expression evaluation, which the parser cannot do.
- Find nested shape/effect properties recursively by `match_name`, not localized display name.
  For rectangle geometry, search for `ADBE Vector Shape - Rect`, then access its child Size
  property.
- Cross-project comp/layer copying is not supported. Do not silently flatten a complex source
  into static values; report the boundary when masks, effects, expressions, or keyframes make
  reconstruction unsafe.
