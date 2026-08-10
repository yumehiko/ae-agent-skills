import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'host', 'lib', 'snapshot_handlers.jsx'), 'utf8');

class MockCompItem {
  constructor(id, name, width = 1080, height = 1920) {
    this.id = id;
    this.name = name;
    this.width = width;
    this.height = height;
    this.pixelAspect = 1;
    this.duration = 4;
    this.frameRate = 25;
    this.displayStartTime = 0;
    this.removed = false;
  }

  remove() {
    this.removed = true;
  }
}

function decodePayload(raw) {
  assert.ok(raw.startsWith('__ENC__'));
  return JSON.parse(decodeURIComponent(raw.slice('__ENC__'.length)));
}

function createContext(targetComp) {
  const files = new Map();
  const temporaryComps = [];

  function MockFile(filePath) {
    const normalized = String(filePath);
    if (!files.has(normalized)) {
      files.set(normalized, {
        path: normalized,
        fsName: normalized,
        exists: false,
        length: 0,
        parent: { exists: true },
        remove() {
          this.exists = false;
          this.length = 0;
          return true;
        },
      });
    }
    return files.get(normalized);
  }

  function addScaledComp(name, width, height, pixelAspect, duration, frameRate) {
    const comp = new MockCompItem(100 + temporaryComps.length, name, width, height);
    comp.pixelAspect = pixelAspect;
    comp.duration = duration;
    comp.frameRate = frameRate;
    const values = {};
    const transform = {
      property(matchName) {
        return {
          setValue(value) {
            values[matchName] = value;
          },
        };
      },
    };
    comp.layers = {
      add(sourceComp) {
        comp.sourceComp = sourceComp;
        return {
          property() {
            return transform;
          },
        };
      },
    };
    comp.transformValues = values;
    comp.saveFrameToPng = (time, outputFile) => {
      if (targetComp.failScaledRender) throw new Error('scaled render failed');
      comp.savedTime = time;
      outputFile.exists = true;
      outputFile.length = 128;
    };
    temporaryComps.push(comp);
    return comp;
  }

  const activeComp = new MockCompItem(1, 'Active');
  const project = {
    activeItem: activeComp,
    items: { addComp: addScaledComp },
    get numItems() {
      return temporaryComps.filter((item) => !item.removed).length;
    },
    item(index) {
      return temporaryComps.filter((item) => !item.removed)[index - 1] || null;
    },
  };
  const context = vm.createContext({
    CompItem: MockCompItem,
    File: MockFile,
    app: {
      project,
    },
    ensureJSON() {},
    encodePayload(value) {
      return `__ENC__${encodeURIComponent(JSON.stringify(value))}`;
    },
    aeResolveCompByIdOrName(compId, compName) {
      if (compId === targetComp.id || compName === targetComp.name) {
        return { item: targetComp, error: null };
      }
      return { item: null, error: 'Composition not found.' };
    },
    log() {},
    isFinite,
  });
  vm.runInContext(source, context);
  return { context, files, temporaryComps, activeComp };
}

test('saveCompSnapshot writes a full-size frame without changing the active comp', () => {
  const targetComp = new MockCompItem(2, 'TX01_Title');
  targetComp.saveFrameToPng = (time, outputFile) => {
    targetComp.savedTime = time;
    outputFile.exists = true;
    outputFile.length = 256;
  };
  const { context, activeComp } = createContext(targetComp);

  const payload = decodePayload(vm.runInContext(
    'saveCompSnapshot(2, null, 1.25, "/tmp/frame.png", 1)',
    context,
  ));

  assert.equal(payload.status, 'success');
  assert.equal(payload.width, 1080);
  assert.equal(payload.height, 1920);
  assert.equal(targetComp.savedTime, 1.25);
  assert.equal(context.app.project.activeItem, activeComp);
});

test('saveCompSnapshot keeps a scaled temporary comp until explicit cleanup', () => {
  const targetComp = new MockCompItem(2, 'TX01_Title');
  const { context, temporaryComps } = createContext(targetComp);

  const payload = decodePayload(vm.runInContext(
    'saveCompSnapshot(null, "TX01_Title", 1.5, "/tmp/half.png", 0.5)',
    context,
  ));

  assert.equal(payload.status, 'success');
  assert.equal(payload.width, 540);
  assert.equal(payload.height, 960);
  assert.equal(temporaryComps.length, 1);
  assert.equal(temporaryComps[0].removed, false);
  assert.equal(payload.temporaryCompId, temporaryComps[0].id);
  assert.deepEqual(
    Array.from(temporaryComps[0].transformValues['ADBE Scale']),
    [50, 50],
  );
});

test('cleanupCompSnapshot removes only the generated temporary comp', () => {
  const targetComp = new MockCompItem(2, 'TX01_Title');
  const { context, temporaryComps } = createContext(targetComp);
  const snapshotPayload = decodePayload(vm.runInContext(
    'saveCompSnapshot(2, null, 1, "/tmp/half.png", 0.5)',
    context,
  ));

  const cleanupPayload = decodePayload(vm.runInContext(
    `cleanupCompSnapshot(${snapshotPayload.temporaryCompId})`,
    context,
  ));

  assert.equal(cleanupPayload.status, 'success');
  assert.equal(cleanupPayload.removed, true);
  assert.equal(temporaryComps[0].removed, true);
});

test('saveCompSnapshot rejects unsupported saveFrameToPng without leaving a temp comp', () => {
  const targetComp = new MockCompItem(2, 'TX01_Title');
  const { context, temporaryComps } = createContext(targetComp);

  const payload = decodePayload(vm.runInContext(
    'saveCompSnapshot(2, null, 1, "/tmp/frame.png", 1)',
    context,
  ));

  assert.equal(payload.status, 'error');
  assert.match(payload.message, /does not expose/);
  assert.equal(temporaryComps.length, 0);
});

test('saveCompSnapshot removes a scaled temporary comp after a render error', () => {
  const targetComp = new MockCompItem(2, 'TX01_Title');
  targetComp.failScaledRender = true;
  const { context, temporaryComps } = createContext(targetComp);

  const payload = decodePayload(vm.runInContext(
    'saveCompSnapshot(2, null, 1, "/tmp/frame.png", 0.5)',
    context,
  ));

  assert.equal(payload.status, 'error');
  assert.match(payload.message, /scaled render failed/);
  assert.equal(temporaryComps.length, 1);
  assert.equal(temporaryComps[0].removed, true);
});
