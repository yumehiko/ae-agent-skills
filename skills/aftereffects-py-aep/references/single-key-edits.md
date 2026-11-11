# Move or delete one keyframe

Use the pinned py-aep 0.19.0 public APIs on the existing property:

```python
import math

# Resolve comp, layer and prop uniquely before this block.
# Match the source composition time, not an old index from a previous edit.
source_seconds = 2.0
matches = [k for k in prop.keyframes if abs(k.time - source_seconds) < 1e-5]
if len(matches) != 1:
    raise ValueError("Expected exactly one source key")
key = matches[0]
if any(k.roving for k in prop.keyframes):
    raise ValueError("Roving track needs a separate retiming plan")

# MOVE: preserve the existing key object, value and stored metadata.
target_seconds = 3.5
if not math.isfinite(target_seconds):
    raise ValueError("Target must be finite composition seconds")
key.time = target_seconds

# DELETE instead of MOVE:
# index = next(i for i, k in enumerate(prop.keyframes) if k is key)
# prop.remove_key(index)
```

- `key.time` is composition seconds, including the layer's start offset and stretch.
  For a frame target, divide explicitly by `comp.frame_rate`. `frame_time` is a rounded
  whole-frame view; do not use it to identify subframe keys. Do not change fps/stretch
  as part of an unrelated single-key edit.
- Moving past another key reorders the key list and binary data together. Resolve
  indices again after every edit. Negative stretch can make list order differ from
  ascending composition time. py-aep indices are zero-based; AE scripting indices
  are one-based.
- The time setter rejects collisions at the serialized tick, even when two requested
  floating-point times differ slightly. Catch `ValueError` and stop; never remove the
  destination key, merge values, or nudge the time silently. Different subframe times
  within the same frame are not necessarily a collision.
- Keep the key object; do not delete/recreate it, replace `prop.keyframes`, rewrite
  every key, or use `set_value_at_time()` as a move. The time setter retains stored
  interpolation, ease, label, flags and spatial tangents. The animation changes when
  segment duration/order changes: derived LINEAR/auto-Bezier speeds or tangents may
  change, so unchanged evaluated speed is not a preservation guarantee.
- `remove_key(index)` deletes only that key. Deleting the last key turns a numeric
  property static at the removed value. Confirm that this is the intended result.
- A roving key rejects direct time assignment. Moving/deleting its anchors can also
  retime other keys. For a strict single-key edit, reject the whole roving track.
  Do not clear roving silently; agree on the broader retiming and verify all affected
  keys in AE if the user wants to proceed.
- These regression cases cover numeric Opacity, Position and Scale. Do not infer
  support for text/shape-path/marker/custom-value tracks, separated dimensions,
  expression results or plugin-specific properties. Inspect their supported API and
  validate separately, or use a guarded live operation that supports the property.

## Save and verify

Record source hash, property identity, key count and each key's time/value, label,
interpolation, temporal ease/flags and spatial tangents/flags before editing. Save
once to a new path, reparse, and compare the requested edit plus every surviving key.
Use a serialization-aware tolerance for time, not whole-frame rounding; verify no
unintended keys disappeared. Confirm the source hash is unchanged.

Then open the derived file in AE, read time/value/metadata, save to another new file
and reopen it for the same checks. Include the actual layer offset/stretch and fps.
Purge caches before any visual review. A parser round-trip alone is only a file pass.
The whole-track fallback in [keyframe-verification.md](keyframe-verification.md) is
not a single-key editing tool.
