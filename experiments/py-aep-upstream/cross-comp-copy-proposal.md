Field use has exposed two related workflow gaps that would be valuable after ExtendScript parity:

1. Import a comp/layer/footage dependency closure from another AEP, equivalent to AE's Import
   Project workflow.
2. Copy a group of related layers between comps while preserving their internal parent/matte/
   effect-layer references and appearance.

The current `Layer.copy_to_comp()` behavior is internally consistent with its documentation:
cross-comp copies clear parent and matte references and auto-number duplicate names. However, a
parented layer then retains values expressed in the old parent's local space, so its appearance
changes. Copying layers one at a time also cannot safely reconstruct the dependency graph.

A useful API could operate on a closure rather than a single layer, for example:

```python
result = target_comp.copy_layers(
    source_layers,
    include_dependencies=True,
    preserve_world_transform=True,
)
```

For project import, a staged API such as
`source_comp.copy_to_project(target_project, include_dependencies=True)` could remap item IDs,
layer IDs, sources, parents, mattes, effect layer parameters, expressions/Essential Graphics
references, and folders. It would be safer to add a new API than to change the existing
`copy_to_comp()` semantics.

I can contribute minimal fixtures covering nested comps, same-name footage, parent chains,
track mattes, layer-reference effects, keyframes, and expressions once the desired contract is
agreed.
