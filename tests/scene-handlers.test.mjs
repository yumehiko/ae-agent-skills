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
  assert.equal(result.keyframesRemoved, 3);
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
