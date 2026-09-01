## Environment

- py-aep 0.15.0 and current `main`
- Python 3.14
- target AEP version `26.3x87`

## Resolution

Fixed by [py-aep #209](https://github.com/forticheprod/py-aep/pull/209) and released in
[v0.15.1](https://github.com/forticheprod/py-aep/releases/tag/v0.15.1). On 2026-09-01, the
original reproduction below still failed with 0.15.0 and passed with 0.15.1. Solid and
placeholder footage names containing Japanese text also persisted after save and reparse.

## Problem

Assigning `FootageItem.name` works in memory for a `SolidSource`, but the name is restored from
the Solid source after save and reparse. File-backed footage names persist normally.

## Minimal reproduction

```python
from pathlib import Path
import py_aep

output = Path("solid-rename.aep")
app = py_aep.new(version="26.3x87")
comp = app.project.root_folder.add_comp("Main", 200, 200, 1.0, 1.0, 25.0)
layer = comp.add_solid([1.0, 0.0, 0.0], "Original Solid", 40, 40, 1.0, 1.0)
footage = layer.source

footage.name = "Renamed Solid Item"
assert footage.name == "Renamed Solid Item"
app.project.save(output)

checked = py_aep.parse(output).project
solid = next(item for item in checked.footages if item.id == footage.id)
assert solid.name == "Renamed Solid Item"  # fails on 0.15.0; passes on 0.15.1
```

## Expected behavior

Either `FootageItem.name` should persist for Solid-backed footage like other project items, or
the assignment should be rejected with an actionable error. Silently accepting a value that is
lost on save makes project-panel cleanup difficult to validate.

The binary appears to carry both an item display name and a Solid source name. It would be useful
to confirm whether the setter should synchronize both fields or whether Solid footage needs a
dedicated rename path.
