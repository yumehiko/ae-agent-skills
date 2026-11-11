from __future__ import annotations

from pathlib import Path

import py_aep
import pytest


def key_metadata(key):
    """Public, serialized metadata, independent of a key's list position."""
    return dict(value=key.value, label=int(key.label),
                incoming=key.in_interpolation_type.name,
                outgoing=key.out_interpolation_type.name,
                in_ease=[(e.speed, e.influence) for e in key.in_temporal_ease],
                out_ease=[(e.speed, e.influence) for e in key.out_temporal_ease],
                temporal_auto=key.temporal_auto_bezier,
                temporal_continuous=key.temporal_continuous,
                spatial_auto=key.spatial_auto_bezier,
                spatial_continuous=key.spatial_continuous,
                in_tangent=key.in_spatial_tangent,
                out_tangent=key.out_spatial_tangent, roving=key.roving)


def single_key_project(fps=25, stretch=100):
    project = py_aep.new(version="26.3x87").project
    comp = project.root_folder.add_comp("Single key edits", 320, 180, 1, 10, fps)
    layer = comp.add_shape()
    layer.name = "Metadata preservation"
    layer.start_time = 0.25
    layer.stretch = stretch
    for name, values in [("ADBE Opacity", [10, 50, 90]),
                         ("ADBE Position", [[20, 30, 0], [100, 80, 0], [200, 140, 0]]),
                         ("ADBE Scale", [[40, 50, 100], [60, 80, 100], [100, 120, 100]])]:
        prop = layer.transform.property(name)
        for time, value in zip((1, 2, 3), values):
            prop.set_value_at_time(time, value)
        for index, key in enumerate(prop.keyframes):
            key.label = py_aep.Label(index + 1)
            key.in_interpolation_type = key.out_interpolation_type = py_aep.KeyframeInterpolationType.BEZIER
            key.in_temporal_ease = [py_aep.KeyframeEase(0, 60) for _ in key.in_temporal_ease]
            key.out_temporal_ease = [py_aep.KeyframeEase(0, 70) for _ in key.out_temporal_ease]
            if name == "ADBE Position":
                key.in_spatial_tangent = [-10, -5, 0]
                key.out_spatial_tangent = [15, 7, 0]
                key.spatial_continuous = True
    return project


@pytest.mark.parametrize("fps", [25, 30000 / 1001])
@pytest.mark.parametrize("stretch", [50, 100, 150, -100])
@pytest.mark.parametrize("operation", ["move", "delete"])
def test_single_key_edit_roundtrip_preserves_other_keys(tmp_path, fps, stretch, operation):
    project = single_key_project(fps, stretch)
    source = tmp_path / "source.aep"
    project.save(source)
    original = source.read_bytes()
    project = py_aep.parse(source).project
    layer = project.compositions[0].layers[0]
    expected = {}
    for name in ("ADBE Opacity", "ADBE Position", "ADBE Scale"):
        prop = layer.transform.property(name)
        before = {int(k.label): (k.time, key_metadata(k)) for k in prop.keyframes}
        target = prop.keyframes[1]
        label = int(target.label)
        if operation == "move":
            target.time = 3.5  # Cross a neighbour, preserving the same key object.
            assert any(k is target for k in prop.keyframes)
            before[label] = (3.5, before[label][1])
        else:
            prop.remove_key(1)  # py-aep is zero-based, unlike ExtendScript.
            del before[label]
        expected[name] = before
    output = tmp_path / f"{operation}-{fps}-{stretch}.aep"
    project.save(output)
    checked_layer = py_aep.parse(output).project.compositions[0].layers[0]
    for name, wanted in expected.items():
        keys = checked_layer.transform.property(name).keyframes
        assert len(keys) == len(wanted)
        for key in keys:
            time, metadata = wanted[int(key.label)]
            assert key.time == pytest.approx(time, abs=1e-4)
            assert key_metadata(key) == metadata
    assert source.read_bytes() == original


def test_key_move_collision_and_roving_reject_without_mutation(tmp_path):
    project = single_key_project()
    prop = project.compositions[0].layers[0].transform.position
    before = [(k.time, key_metadata(k)) for k in prop.keyframes]
    for time in (prop.keyframes[0].time, prop.keyframes[0].time + 1e-10):
        with pytest.raises(ValueError, match="already exists"):
            prop.keyframes[1].time = time
        assert [(k.time, key_metadata(k)) for k in prop.keyframes] == before
    prop.keyframes[1].roving = True
    before = [(k.time, key_metadata(k)) for k in prop.keyframes]
    with pytest.raises(ValueError, match="roving"):
        prop.keyframes[1].time = 2.5
    assert [(k.time, key_metadata(k)) for k in prop.keyframes] == before
    output = tmp_path / "roving-rejected.aep"
    project.save(output)
    checked = py_aep.parse(output).project.compositions[0].layers[0].transform.position
    assert [(k.time, key_metadata(k)) for k in checked.keyframes] == before


def test_distinct_subframe_keys_are_not_a_collision(tmp_path):
    project = single_key_project()
    prop = project.compositions[0].layers[0].transform.opacity
    prop.keyframes[1].time = 1.01
    assert prop.keyframes[0].frame_time == prop.keyframes[1].frame_time
    output = tmp_path / "subframe-move.aep"
    project.save(output)
    keys = py_aep.parse(output).project.compositions[0].layers[0].transform.opacity.keyframes
    assert [k.time for k in keys] == pytest.approx([1, 1.01, 3], abs=1e-4)


@pytest.mark.parametrize("index", [-1, 3])
def test_invalid_delete_index_does_not_mutate(index):
    project = single_key_project()
    prop = project.compositions[0].layers[0].transform.opacity
    before = [(k.time, key_metadata(k)) for k in prop.keyframes]
    with pytest.raises(ValueError):
        prop.remove_key(index)
    assert [(k.time, key_metadata(k)) for k in prop.keyframes] == before


def test_remove_last_key_preserves_static_value(tmp_path):
    project = single_key_project()
    prop = project.compositions[0].layers[0].transform.opacity
    prop.remove_key(2)
    prop.remove_key(0)
    value = prop.keyframes[0].value
    prop.remove_key(0)
    output = tmp_path / "last-key-deleted.aep"
    project.save(output)
    checked = py_aep.parse(output).project.compositions[0].layers[0].transform.opacity
    assert not checked.keyframes
    assert checked.value == value


@pytest.mark.parametrize("mode", ["LINEAR", "HOLD", "continuous", "auto"])
@pytest.mark.parametrize("operation", ["move", "delete"])
def test_interpolation_flags_survive_single_key_edit(tmp_path, mode, operation):
    project = single_key_project()
    prop = project.compositions[0].layers[0].transform.opacity
    for key in prop.keyframes:
        if mode in ("LINEAR", "HOLD"):
            key.in_interpolation_type = key.out_interpolation_type = getattr(py_aep.KeyframeInterpolationType, mode)
        elif mode == "continuous":
            key.temporal_continuous = True
        else:
            key.temporal_auto_bezier = True
    if operation == "move":
        prop.keyframes[1].time = 2.25
    else:
        prop.remove_key(0)
    # Auto/linear ease is derived from neighbours. Compare the post-edit state,
    # not a promise that evaluated speed stays constant after changing timing.
    expected = [(k.time, key_metadata(k)) for k in prop.keyframes]
    output = tmp_path / f"{operation}-{mode}.aep"
    project.save(output)
    keys = py_aep.parse(output).project.compositions[0].layers[0].transform.opacity.keyframes
    assert [(k.time, key_metadata(k)) for k in keys] == expected


@pytest.mark.parametrize("operation", ["move_anchor", "delete_anchor"])
def test_roving_neighbours_can_retime_on_single_key_edit(tmp_path, operation):
    project = single_key_project()
    prop = project.compositions[0].layers[0].transform.position
    prop.set_value_at_time(4, [260, 150, 0])
    prop.keyframes[1].roving = True
    roving = prop.keyframes[1]
    original_time = roving.time
    if operation == "move_anchor":
        prop.keyframes[2].time = 3.5
    else:
        prop.remove_key(2)
    assert roving.time != original_time
    expected = [(k.time, key_metadata(k)) for k in prop.keyframes]
    output = tmp_path / f"roving-{operation}.aep"
    project.save(output)
    keys = py_aep.parse(output).project.compositions[0].layers[0].transform.position.keyframes
    assert [(k.time, key_metadata(k)) for k in keys] == expected


def test_solid_footage_name_persists_after_save_and_reparse(
    tmp_path: Path,
) -> None:
    output = tmp_path / "solid-rename.aep"
    app = py_aep.new(version="26.3x87")
    comp = app.project.root_folder.add_comp(
        "Main",
        200,
        200,
        1.0,
        1.0,
        25.0,
    )
    layer = comp.add_solid(
        [1.0, 0.0, 0.0],
        "Original Solid",
        40,
        40,
        1.0,
        1.0,
    )
    footage = layer.source
    footage_id = footage.id

    footage.name = "Renamed Solid Item"
    app.project.save(output)

    checked = py_aep.parse(output).project
    solid = next(item for item in checked.footages if item.id == footage_id)
    assert solid.name == "Renamed Solid Item"


def test_animated_property_uses_containing_comp_timebase(tmp_path: Path) -> None:
    # 0.15.1 applied an animated template with a 24fps property timebase,
    # even when the containing comp used a different rate. Parser time
    # round-trip alone concealed it; AE interpreted those ticks differently.
    for fps in (25.0, 30000 / 1001):
        project = py_aep.new(version="26.3x87").project
        comp = project.root_folder.add_comp("Timebase", 100, 100, 1, 5, fps)
        layer = comp.add_shape()
        for match_name, value in [("ADBE Opacity", 50), ("ADBE Position", [20, 30, 0]), ("ADBE Scale", [70, 80, 100])]:
            layer.transform.property(match_name).set_value_at_time(15 / fps, value)
        output = tmp_path / f"timebase-{fps}.aep"
        project.save(output)
        checked = py_aep.parse(output).project.compositions[0]
        for match_name in ("ADBE Opacity", "ADBE Position", "ADBE Scale"):
            prop = checked.layers[0].transform.property(match_name)
            # Internal inspection is intentional regression evidence only;
            # production code must not patch these private binary fields.
            assert prop._tdb4._time_base == checked._cdta.internal_timebase
