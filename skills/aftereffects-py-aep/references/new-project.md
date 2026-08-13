# New project workflow

Use this path only after checking the whole deliverable for unsupported dependencies.

## Preflight

1. List the dimensions, pixel aspect, frame rate, duration, comp tree, layer types, footage,
   fonts, effects/plugins, expressions, and delivery/render requirements.
2. Start empty only when every required structural edit is supported. Treat arbitrary effects,
   third-party plugins, cross-project component import, and exact inherited styles as reasons
   to use a small foundation AEP instead.
3. Stamp the file for the target AE version. A project stamped for version N opens in N or
   newer; do not silently use py-aep's default when the target version is known.
4. Pass `ae_preferences_dir` only when composition presets, render/output templates, or local
   defaults are required. Keep explicit project settings in the script when reproducibility
   matters.

## Build

1. Copy `assets/new_project_template.py` beside the job as
   `_automation/build_<project>.py`.
2. Implement `build_scene(project, main_comp)` with direct py-aep object operations.
3. Implement `assert_scene(project, main_comp)` with task-specific semantic assertions.
4. Put repeated content in Python data and small builder functions. Do not invent scene JSON
   or a second declarative schema.
5. Run the task script once. It must instantiate one object graph, save once, reparse, and run
   both generic and task-specific assertions.

## Validate

- Assert comp names/settings, layer order/types/timing, sources, text, property values,
  keyframes, expressions, parent/matte links, and render queue settings that matter.
- Open the output in AE for the structure pass.
- Run `ae-cli purge` before snapshots or renders. Check modified transition boundaries as well
  as representative hold frames.
- Keep the task script as the editable source of truth for revisions and series variants.

If a required feature fails after the preflight, stop and switch to a foundation AEP instead of
recreating a complex AE component as lossy static values.
