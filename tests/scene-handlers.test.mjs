import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(
  path.join(root, 'host', 'lib', 'mutation_scene_handlers.jsx'),
  'utf8',
);

function createContext() {
  const context = vm.createContext({
    aeValidateSceneLayoutSpecs() {},
    aeValidateTextStyle() {},
    aeValidateTextStyleRanges() {},
    aeValidateTextAnimators() {},
    File: function File(value) {
      this.fsName = String(value);
      this.exists = true;
    },
  });
  vm.runInContext(source, context);
  return context;
}

function validate(context, scene) {
  context.sceneJSON = JSON.stringify(scene);
  return vm.runInContext('aeValidateSceneSpec(JSON.parse(sceneJSON))', context);
}

test('scene validation accepts an empty replace keyframe set', () => {
  const result = validate(createContext(), {
    layers: [
      {
        id: 'layer-a',
        type: 'solid',
        animations: [
          {
            propertyPath: 'ADBE Transform Group.ADBE Opacity',
            keyframes: [],
          },
        ],
      },
    ],
  });

  assert.equal(result.ok, true);
});

test('applyScene rejects an unexpected open project before validation or mutation', () => {
  const context = createContext();
  let validationCalled = false;
  context.ensureJSON = () => {};
  context.encodePayload = (value) => JSON.stringify(value);
  context.aeGetProjectState = () => ({
    path: '/projects/wrong.aep',
    name: 'wrong.aep',
    dirty: false,
    saved: true,
  });
  context.aeNormalizeProjectPath = (value) => String(value);
  context.aeProjectPathMatches = (expected, state) => expected === state.path;
  context.aeValidateSceneSpec = () => {
    validationCalled = true;
    return { ok: true, errors: [] };
  };
  context.sceneJSON = JSON.stringify({ layers: [] });
  context.optionsJSON = JSON.stringify({ expectProject: '/projects/main.aep' });

  const result = JSON.parse(
    vm.runInContext('applyScene(sceneJSON, optionsJSON)', context),
  );

  assert.equal(result.status, 'error');
  assert.match(result.message, /Project path mismatch/);
  assert.equal(result.expectedProject, '/projects/main.aep');
  assert.equal(result.project.path, '/projects/wrong.aep');
  assert.equal(validationCalled, false);
});

test('apply response keeps the legacy createdLayers alias while classifying actions', () => {
  const source = fs.readFileSync(
    path.join(root, 'host', 'lib', 'mutation_scene_handlers.jsx'),
    'utf8',
  );

  assert.match(source, /createdLayers:\s*appliedLayers/);
  assert.match(source, /newlyCreatedLayers:\s*newlyCreatedLayers/);
  assert.match(source, /updatedLayers:\s*updatedLayers/);
});

test('scene apply creates missing compositions only after opening its Undo group', () => {
  const beginIndex = source.indexOf('app.beginUndoGroup("Apply Scene")');
  const mutatingResolveIndex = source.indexOf('comp = aeResolveSceneComp(scene, true)');

  assert.ok(beginIndex >= 0);
  assert.ok(mutatingResolveIndex > beginIndex);
});

test('scene transaction rollback verifies that its marker was removed', () => {
  const context = createContext();
  context.app = {
    project: {
      numItems: 1,
      item() {
        return { id: 91 };
      },
    },
    executeCommand(commandId) {
      context.undoCommandId = commandId;
      this.project.numItems = 0;
    },
  };
  context.aeGetProjectState = () => ({ dirty: true });
  context.marker = { id: 91 };
  context.beforeState = { dirty: false };

  const result = vm.runInContext(
    'aeRollbackSceneTransaction(marker, beforeState)',
    context,
  );

  assert.equal(context.undoCommandId, 16);
  assert.equal(result.attempted, true);
  assert.equal(result.succeeded, true);
  assert.equal(result.markerRemoved, true);
  assert.equal(result.dirtyRestored, false);
  assert.match(result.warning, /dirty state was not restored/);
});

test('scene transaction does not Undo unrelated history without its marker', () => {
  const context = createContext();
  context.app = {
    project: { numItems: 0, item() { return null; } },
    executeCommand() {
      throw new Error('must not execute');
    },
  };
  context.aeGetProjectState = () => ({ dirty: false });
  context.marker = { id: 91 };

  const result = vm.runInContext(
    'aeRollbackSceneTransaction(marker, { dirty: false })',
    context,
  );

  assert.equal(result.attempted, false);
  assert.equal(result.succeeded, false);
  assert.match(result.warning, /unrelated history/);
});

test('scene validation rejects duplicate animation property paths', () => {
  const result = validate(createContext(), {
    layers: [
      {
        id: 'layer-a',
        type: 'solid',
        animations: [
          { propertyPath: 'Opacity', keyframes: [] },
          { propertyPath: 'Opacity', keyframes: [] },
        ],
      },
    ],
  });

  assert.equal(result.ok, false);
  assert.ok(Array.from(result.errors).some((message) => message.includes('duplicated')));
});

test('scene validation rejects unknown keyframe modes and fractional comp dimensions', () => {
  const result = validate(createContext(), {
    composition: { width: 1080.5, height: 1920 },
    layers: [
      {
        id: 'layer-a',
        type: 'solid',
        animations: [
          { propertyPath: 'Opacity', keyframeMode: 'append', keyframes: [] },
        ],
      },
    ],
  });

  assert.equal(result.ok, false);
  const errors = Array.from(result.errors);
  assert.ok(errors.some((message) => message.includes('width must be a positive integer')));
  assert.ok(errors.some((message) => message.includes('keyframeMode must be replace or merge')));
});

test('scene validation requires a base text style for declarative range styles', () => {
  const result = validate(createContext(), {
    layers: [
      {
        id: 'title',
        type: 'text',
        textStyleRanges: [{ start: 0, end: 2, style: { fillColor: [255, 0, 0] } }],
      },
    ],
  });

  assert.equal(result.ok, false);
  assert.ok(Array.from(result.errors).some((message) => message.includes('requires textStyle')));
});

test('scene validation accepts text ranges and animators on a text layer', () => {
  const result = validate(createContext(), {
    layers: [
      {
        id: 'title',
        type: 'text',
        textStyle: { fontSize: 80 },
        textStyleRanges: [{ start: 0, end: 2, style: { fillColor: [255, 0, 0] } }],
        textAnimators: [
          { id: 'reveal', properties: { opacity: 0 }, selector: { start: 0, end: 100 } },
        ],
      },
    ],
  });

  assert.equal(result.ok, true);
});

function applyLayer(context, layerSpec) {
  context.layerSpecJSON = JSON.stringify(layerSpec);
  vm.runInContext(`
    removedPaths = [];
    mutationCalls = [];
    mockLayer = { index: 1, id: 101, name: "Layer A" };
    aeResolveOrCreateSceneLayer = function() {
      return { layer: mockLayer, created: false, sceneId: "layer-a", layerType: "solid" };
    };
    aeApplyLayerTransform = function() { return 0; };
    aeApplyLayerTiming = function() { return 0; };
    aeTryGetLayerUid = function(layer) { return String(layer.id); };
    removePropertyKeyframes = function(layer, propertyPath) {
      removedPaths.push(propertyPath);
      return 3;
    };
    aeInvokeMutation = function(fn, args, label) {
      mutationCalls.push({ args: args, label: label });
      return { status: "success" };
    };
    setPropertyValue = function() {};
    setKeyframe = function() {};
  `, context);
  return vm.runInContext(
    'aeApplySceneLayer({}, JSON.parse(layerSpecJSON), 0, {}, {})',
    context,
  );
}

test('scene layer apply replaces property keys by default', () => {
  const context = createContext();
  const result = applyLayer(context, {
    id: 'layer-a',
    type: 'solid',
    animations: [
      {
        propertyPath: 'Opacity',
        keyframes: [
          { time: 0, value: 0 },
          { time: 1, value: 100 },
        ],
      },
    ],
  });

  assert.deepEqual(Array.from(context.removedPaths), ['Opacity']);
  assert.equal(context.mutationCalls.length, 2);
  assert.equal(context.mutationCalls[0].args[5], null);
  assert.equal(context.mutationCalls[1].args[5], null);
  assert.equal(result.keyframesRemoved, 3);
  assert.equal(result.action, 'updated');
});

test('scene layer apply preserves undeclared keys in explicit merge mode', () => {
  const context = createContext();
  const result = applyLayer(context, {
    id: 'layer-a',
    type: 'solid',
    animations: [
      {
        propertyPath: 'Opacity',
        keyframeMode: 'merge',
        keyframes: [{ time: 1, value: 100 }],
      },
    ],
  });

  assert.deepEqual(Array.from(context.removedPaths), []);
  assert.equal(context.mutationCalls.length, 1);
  assert.equal(result.keyframesRemoved, 0);
});

test('empty replace animation reapplies the declared static transform value', () => {
  const context = createContext();
  const result = applyLayer(context, {
    id: 'layer-a',
    type: 'solid',
    transform: { opacity: 80 },
    animations: [
      {
        propertyPath: 'ADBE Transform Group.ADBE Opacity',
        keyframes: [],
      },
    ],
  });

  assert.deepEqual(
    Array.from(context.removedPaths),
    ['ADBE Transform Group.ADBE Opacity'],
  );
  assert.equal(context.mutationCalls.length, 1);
  assert.equal(
    context.mutationCalls[0].label,
    'setPropertyValue(empty animation fallback)',
  );
  assert.equal(context.mutationCalls[0].args[2], 'ADBE Transform Group.ADBE Opacity');
  assert.equal(context.mutationCalls[0].args[3], '80');
  assert.equal(result.keyframesRemoved, 3);
});

test('empty replace animation prefers propertyValues over transform fallback', () => {
  const context = createContext();
  applyLayer(context, {
    id: 'layer-a',
    type: 'solid',
    transform: { opacity: 80 },
    propertyValues: [
      { propertyPath: 'ADBE Transform Group.ADBE Opacity', value: 65 },
    ],
    animations: [
      {
        propertyPath: 'ADBE Transform Group.ADBE Opacity',
        keyframes: [],
      },
    ],
  });

  assert.equal(context.mutationCalls.length, 2);
  assert.equal(context.mutationCalls[0].label, 'setPropertyValue(propertyValues)');
  assert.equal(context.mutationCalls[1].args[3], '65');
});

test('scene mutation temporarily activates a non-active target and restores the previous comp', () => {
  const context = createContext();
  vm.runInContext(`
    CompItem = function CompItem(id) { this.id = id; };
    previousComp = new CompItem(10);
    targetComp = new CompItem(20);
    app = { project: { activeItem: previousComp } };
    activeCompCalls = [];
    setActiveComp = function() {};
    aeInvokeMutation = function(fn, args, label) {
      activeCompCalls.push({ id: args[0], label: label });
      app.project.activeItem = args[0] === targetComp.id ? targetComp : previousComp;
      return { status: "success" };
    };
    activeCompState = aeActivateSceneCompForMutation(
      targetComp,
      { setActive: false },
      aeGetActiveSceneComp()
    );
    aeRestoreSceneActiveComp(activeCompState);
    aeRestoreSceneActiveComp(activeCompState);
  `, context);

  assert.deepEqual(
    Array.from(context.activeCompCalls, (call) => ({ id: call.id, label: call.label })),
    [
      { id: 20, label: 'setActiveComp(apply target)' },
      { id: 10, label: 'setActiveComp(restore)' },
    ],
  );
  assert.equal(context.app.project.activeItem, context.previousComp);
});
