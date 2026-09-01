# py-aep API notes

Use these notes only when API discovery stalls.

- `project.items` is a dictionary keyed by item ID. Iterate `project.items.values()`, or use
  typed views such as `project.compositions` and `project.footages`; iterating `project.items`
  itself yields integer IDs.
- Read keyframes with `prop.keyframes`; use `len(prop.keyframes)` for the ExtendScript-like
  key count. In py-aep 0.15.1 there is no `num_keys` convenience property.
- Call `prop.value_at_time(time)` for offline pre-expression interpolation. Do not pass
  `pre_expression=False`: that requests expression evaluation, which the parser cannot do.
- Find nested shape/effect properties recursively by `match_name`, not localized display name.
  For rectangle geometry, search for `ADBE Vector Shape - Rect`, then access its child Size
  property.
- Cross-project comp/layer copying is not supported. Do not silently flatten a complex source
  into static values; report the boundary when masks, effects, expressions, or keyframes make
  reconstruction unsafe.
- `layer.effects` and `layer.masks` return `None`, not an empty group, when absent. Iterate over
  `layer.effects or ()` and `layer.masks or ()`.
- `comp.layers[0]` is the topmost layer. py-aep layer indices are zero-based.
- Item and layer IDs are read-only. Use them for selection and validation, not reassignment.
- Assign `prop.value` only to a static property. If keys exist, use `set_value_at_time()`;
  use `value_at_time(time)` to read pre-expression interpolation at a composition time.
- py-aep 0.15.1 persists `FootageItem.name` for solid and placeholder footage. As with every
  file edit, verify the intended names only after save and reparse.
- Across comps, `copy_to_comp()` intentionally clears parent/matte references and auto-numbers
  duplicate names. Reject parented/matted layers instead of trying to repair baked transforms.
- Treat `CompItem.duplicate()` with parent/matte/effect references as requiring an AE-open check;
  parser round-trip alone does not prove that AE resolved every runtime reference.
