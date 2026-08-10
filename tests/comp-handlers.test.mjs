import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'host', 'lib', 'comp_handlers.jsx'), 'utf8');

class MockCompItem {
  constructor(id, name, duration = 2) {
    this.id = id;
    this.name = name;
    this.width = 1920;
    this.height = 1080;
    this.pixelAspect = 1;
    this.duration = duration;
    this.frameRate = 30;
    this.layers = null;
  }
}

function decodePayload(raw) {
  assert.ok(raw.startsWith('__ENC__'));
  return JSON.parse(decodeURIComponent(raw.slice('__ENC__'.length)));
}

function createContext(items, activeItem) {
  const context = vm.createContext({
    CompItem: MockCompItem,
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
    aeTryGetLayerUid(layer) {
      return String(layer.id);
    },
    log() {},
    isFinite,
  });
  vm.runInContext(source, context);
  return context;
}

test('addCompLayer adds a unique source comp with explicit timing', () => {
  const sourceComp = new MockCompItem(10, 'TX01_Title', 1.8);
  const targetComp = new MockCompItem(20, 'Main', 8);
  targetComp.layers = {
    add(sourceItem) {
      return {
        id: 101,
        index: 1,
        name: sourceItem.name,
        startTime: 0,
        inPoint: 0,
        outPoint: sourceItem.duration,
      };
    },
  };
  const context = createContext([sourceComp, targetComp], targetComp);

  const raw = vm.runInContext(
    'addCompLayer(null, "TX01_Title", "Title 01", 2, 2, 3.8)',
    context,
  );
  const payload = decodePayload(raw);

  assert.equal(payload.status, 'success');
  assert.equal(payload.layerName, 'Title 01');
  assert.equal(payload.source.id, 10);
  assert.deepEqual(payload.timing, { startTime: 2, inPoint: 2, outPoint: 3.8 });
});

test('addCompLayer rejects self nesting', () => {
  const targetComp = new MockCompItem(20, 'Main', 8);
  targetComp.layers = { add() { throw new Error('must not be called'); } };
  const context = createContext([targetComp], targetComp);
  const payload = decodePayload(vm.runInContext('addCompLayer(20, null, null, null, null, null)', context));

  assert.equal(payload.status, 'error');
  assert.match(payload.message, /cannot be added as a layer inside itself/);
});

test('addCompLayer rejects ambiguous source comp names', () => {
  const sourceA = new MockCompItem(10, 'Duplicate');
  const sourceB = new MockCompItem(11, 'Duplicate');
  const targetComp = new MockCompItem(20, 'Main', 8);
  targetComp.layers = { add() { throw new Error('must not be called'); } };
  const context = createContext([sourceA, sourceB, targetComp], targetComp);
  const payload = decodePayload(
    vm.runInContext('addCompLayer(null, "Duplicate", null, null, null, null)', context),
  );

  assert.equal(payload.status, 'error');
  assert.match(payload.message, /Multiple compositions share the name/);
});

test('composition setting changes are planned and applied declaratively', () => {
  const targetComp = new MockCompItem(20, 'Main', 8);
  targetComp.layers = { add() { throw new Error('not used'); } };
  const context = createContext([targetComp], targetComp);
  context.compSpec = {
    width: 1080,
    height: 1920,
    pixelAspect: 1,
    duration: 1.8,
    frameRate: 25,
  };

  const changes = vm.runInContext('aePlanCompositionSettingChanges(app.project.activeItem, compSpec)', context);
  assert.deepEqual(
    Array.from(changes, (change) => change.field),
    ['width', 'height', 'frameRate', 'duration'],
  );

  const applied = vm.runInContext('aeApplyCompositionSettingChanges(app.project.activeItem, aePlanCompositionSettingChanges(app.project.activeItem, compSpec))', context);
  assert.equal(applied.length, 4);
  assert.equal(targetComp.width, 1080);
  assert.equal(targetComp.height, 1920);
  assert.equal(targetComp.duration, 1.8);
  assert.equal(targetComp.frameRate, 25);
});
