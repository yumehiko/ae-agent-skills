import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'host', 'lib', 'query_handlers.jsx'), 'utf8');

class MockCompItem {
  constructor(id, name, layers = []) {
    this.id = id;
    this.name = name;
    this.time = 0;
    this._layers = layers;
    this.numLayers = layers.length;
  }

  layer(index) {
    return this._layers[index - 1] || null;
  }
}

class MockAVLayer {}

function decodePayload(raw) {
  assert.ok(raw.startsWith('__ENC__'));
  return JSON.parse(decodeURIComponent(raw.slice('__ENC__'.length)));
}

function createContext(items, activeItem) {
  const context = vm.createContext({
    AVLayer: MockAVLayer,
    CompItem: MockCompItem,
    KeyframeInterpolationType: {
      LINEAR: 'LINEAR',
      BEZIER: 'BEZIER',
      HOLD: 'HOLD',
    },
    app: {
      project: {
        activeItem,
        numItems: items.length,
        item(index) {
          return items[index - 1] || null;
        },
      },
    },
    ensureJSON() {},
    encodePayload(value) {
      return `__ENC__${encodeURIComponent(JSON.stringify(value))}`;
    },
    aeResolveCompByIdOrName(compId, compName) {
      const matches = items.filter((item) => (
        compId !== null ? item.id === Number(compId) : item.name === String(compName)
      ));
      return matches.length === 1
        ? { item: matches[0], error: null }
        : { item: null, error: 'Composition not found.' };
    },
    aeResolveLayer(comp, layerId, layerName) {
      const layer = comp._layers.find((entry) => (
        layerId !== null ? entry.index === Number(layerId) : entry.name === String(layerName)
      ));
      return layer
        ? { layer, error: null }
        : { layer: null, error: 'Layer not found.' };
    },
    aeTryGetLayerUid(layer) {
      return `uid-${layer.index}`;
    },
    aeIsFileFootageItem() {
      return false;
    },
    aeIsPropertyNode(prop) {
      return prop.isProperty === true;
    },
    aeCanExposeProperty(prop) {
      return prop.exposed !== false;
    },
    aeCanTraverseProperty(prop) {
      return typeof prop.numProperties === 'number';
    },
    aeGetPropertyIdentifier(prop) {
      return prop.matchName || prop.name;
    },
    aePropertyValueToString(prop) {
      return prop.value;
    },
    resolveProperty(layer, propertyPath) {
      return layer.propertiesByPath ? layer.propertiesByPath[propertyPath] || null : null;
    },
    aeCompItemSummary(item) {
      return { id: item.id, name: item.name };
    },
    aeLayoutLayerBounds(layer, time) {
      return {
        left: layer.left + time,
        top: layer.top,
        right: layer.left + time + layer.width,
        bottom: layer.top + layer.height,
        width: layer.width,
        height: layer.height,
        centerX: layer.left + time + layer.width / 2,
        centerY: layer.top + layer.height / 2,
      };
    },
    getLayerTypeName() {
      return 'Solid';
    },
    log() {},
    isFinite,
  });
  vm.runInContext(source, context);
  return context;
}

test('getLayers reads an explicit composition and exposes null-layer identity', () => {
  const activeComp = new MockCompItem(1, 'Active', []);
  const nullLayer = {
    index: 1,
    name: 'CTRL',
    nullLayer: true,
    startTime: 0,
    inPoint: 0,
    outPoint: 2,
  };
  const targetComp = new MockCompItem(2, 'TX01_Title', [nullLayer]);
  const context = createContext([activeComp, targetComp], activeComp);

  const payload = decodePayload(vm.runInContext('getLayers(null, "TX01_Title")', context));

  assert.equal(payload.length, 1);
  assert.equal(payload[0].name, 'CTRL');
  assert.equal(payload[0].isNull, true);
  assert.equal(context.app.project.activeItem, activeComp);
});

test('keyframe serialization includes values, interpolation, and temporal ease', () => {
  const context = createContext([], null);
  vm.runInContext(`
    propertyUnderTest = {
      numKeys: 1,
      keyTime: function () { return 0.5; },
      keyValue: function () { return [10, 20]; },
      keyInInterpolationType: function () { return KeyframeInterpolationType.BEZIER; },
      keyOutInterpolationType: function () { return KeyframeInterpolationType.HOLD; },
      keyInTemporalEase: function () { return [{ speed: 0, influence: 33 }]; },
      keyOutTemporalEase: function () { return [{ speed: 2, influence: 66 }]; }
    };
  `, context);

  const keyframes = vm.runInContext('aeQueryPropertyKeyframes(propertyUnderTest)', context);
  assert.deepEqual(JSON.parse(JSON.stringify(keyframes)), [{
    index: 1,
    time: 0.5,
    value: [10, 20],
    inInterpolation: 'bezier',
    outInterpolation: 'hold',
    inTemporalEase: [0, 33],
    outTemporalEase: [2, 66],
  }]);
});

test('getProperties includes expression source only when requested', () => {
  const expressionProperty = {
    isProperty: true,
    name: 'Opacity',
    matchName: 'ADBE Opacity',
    value: 100,
    expression: 'time * 10',
    expressionEnabled: false,
  };
  const targetLayer = {
    index: 1,
    name: 'Title',
    numProperties: 1,
    property(index) {
      return index === 1 ? expressionProperty : null;
    },
  };
  const targetComp = new MockCompItem(2, 'TX01_Title', [targetLayer]);
  const context = createContext([targetComp], targetComp);

  const compact = decodePayload(vm.runInContext(
    'getProperties(1, JSON.stringify({ compId: 2 }))',
    context,
  ));
  const complete = decodePayload(vm.runInContext(
    'getProperties(1, JSON.stringify({ compId: 2, includeExpression: true }))',
    context,
  ));

  assert.equal(Object.hasOwn(compact[0], 'expression'), false);
  assert.equal(complete[0].expression, 'time * 10');
  assert.equal(complete[0].expressionEnabled, false);
});

test('getProperties can include normally hidden property nodes for diagnostics', () => {
  const hiddenProperty = {
    isProperty: true,
    exposed: false,
    name: 'Shape',
    matchName: 'ADBE Text Range Shape',
    value: 2,
  };
  const targetLayer = {
    index: 1,
    name: 'Title',
    numProperties: 1,
    property(index) {
      return index === 1 ? hiddenProperty : null;
    },
  };
  const targetComp = new MockCompItem(2, 'TX01_Title', [targetLayer]);
  const context = createContext([targetComp], targetComp);

  const compact = decodePayload(vm.runInContext(
    'getProperties(1, JSON.stringify({ compId: 2 }))',
    context,
  ));
  const complete = decodePayload(vm.runInContext(
    'getProperties(1, JSON.stringify({ compId: 2, includeDisabled: true }))',
    context,
  ));

  assert.equal(compact.length, 0);
  assert.equal(complete[0].path, 'ADBE Text Range Shape');
  assert.equal(complete[0].value, 2);
});

test('getProperties reads a non-enumerated property by exact matchName path', () => {
  const exactPath = 'ADBE Text Range Advanced.ADBE Text Range Shape';
  const hiddenProperty = {
    isProperty: true,
    name: 'Shape',
    matchName: 'ADBE Text Range Shape',
    value: 2,
  };
  const targetLayer = {
    index: 1,
    name: 'Title',
    numProperties: 0,
    propertiesByPath: { [exactPath]: hiddenProperty },
  };
  const targetComp = new MockCompItem(2, 'TX01_Title', [targetLayer]);
  const context = createContext([targetComp], targetComp);

  const payload = decodePayload(vm.runInContext(
    `getProperties(1, JSON.stringify({ compId: 2, propertyPath: ${JSON.stringify(exactPath)} }))`,
    context,
  ));

  assert.equal(payload[0].path, exactPath);
  assert.equal(payload[0].matchName, 'ADBE Text Range Shape');
  assert.equal(payload[0].value, 2);
});

test('getLayerBounds returns composition-space bounds without activating the target comp', () => {
  const activeComp = new MockCompItem(1, 'Active', []);
  const targetLayer = {
    index: 3,
    name: 'Title',
    left: 100,
    top: 200,
    width: 400,
    height: 80,
  };
  const targetComp = new MockCompItem(2, 'TX01_Title', [targetLayer]);
  const context = createContext([activeComp, targetComp], activeComp);

  const payload = decodePayload(vm.runInContext(
    'getLayerBounds(null, JSON.stringify({ layerName: "Title", compId: 2, time: 1.25 }))',
    context,
  ));

  assert.equal(payload.compId, 2);
  assert.equal(payload.layerId, 3);
  assert.deepEqual(payload.bounds, {
    left: 101.25,
    top: 200,
    right: 501.25,
    bottom: 280,
    width: 400,
    height: 80,
    centerX: 301.25,
    centerY: 240,
  });
  assert.equal(context.app.project.activeItem, activeComp);
});

test('getLayerBounds rejects null layers instead of returning a controller rectangle', () => {
  const nullLayer = {
    index: 1,
    name: 'CTRL',
    nullLayer: true,
  };
  const targetComp = new MockCompItem(2, 'TX01_Title', [nullLayer]);
  const context = createContext([targetComp], targetComp);

  const payload = decodePayload(vm.runInContext(
    'getLayerBounds(1, JSON.stringify({ compId: 2, time: 0 }))',
    context,
  ));

  assert.equal(payload.status, 'error');
  assert.match(payload.message, /does not have visual bounds/);
});
