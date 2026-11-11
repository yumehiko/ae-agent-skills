import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(
  path.join(root, 'host', 'lib', 'mutation_keyframe_handlers.jsx'),
  'utf8',
);

function createContext(property) {
  const context = vm.createContext({
    resolveProperty() {
      return property;
    },
    PropertyValueType: {},
    KeyframeInterpolationType: {},
    KeyframeEase: function KeyframeEase() {},
  });
  vm.runInContext(source, context);
  return context;
}

test('removePropertyKeyframes removes every existing key in reverse order', () => {
  const removedIndices = [];
  const property = {
    numKeys: 3,
    removeKey(index) {
      removedIndices.push(index);
      this.numKeys -= 1;
    },
  };
  const context = createContext(property);
  context.layer = {};

  const removed = vm.runInContext(
    'removePropertyKeyframes(layer, "ADBE Transform Group.ADBE Opacity")',
    context,
  );

  assert.equal(removed, 3);
  assert.deepEqual(removedIndices, [3, 2, 1]);
  assert.equal(property.numKeys, 0);
});

test('removePropertyKeyframes accepts an already unkeyed property', () => {
  const property = {
    numKeys: 0,
    removeKey() {
      throw new Error('must not be called');
    },
  };
  const context = createContext(property);
  context.layer = {};

  assert.equal(vm.runInContext('removePropertyKeyframes(layer, "Opacity")', context), 0);
});

// Native-like numeric track: indexes change on insertion/removal, metadata belongs
// to individual keys. A host exception can be injected at any setter.
function singleKeyContext({ spatial = false, labels = true } = {}) {
  const keys = [0, 1, 2].map((time, i) => ({
    time, value: spatial ? [i * 10, i * 20] : i * 25,
    inType: 'bezier', outType: i === 1 ? 'hold' : 'linear',
    inEase: [{ speed: 12, influence: 40 }], outEase: [{ speed: 7, influence: 60 }],
    temporalContinuous: true, temporalAutoBezier: false,
    inTangent: [-3, -4], outTangent: [5, 6], spatialContinuous: true,
    spatialAutoBezier: false, roving: false, selected: i === 1, label: i + 2,
  }));
  const calls = [];
  const property = {
    propertyValueType: spatial ? 'spatial' : 'number', isSpatial: spatial,
    get numKeys() { return keys.length; },
    keyTime(i) { return keys[i - 1].time; },
    keyValue(i) { return keys[i - 1].value; },
    nearestKeyIndex(time) {
      return keys.indexOf(keys.reduce((best, key) => Math.abs(key.time - time) < Math.abs(best.time - time) ? key : best)) + 1;
    },
    addKey(time) {
      calls.push(['add', time]);
      keys.push({ time }); keys.sort((a, b) => a.time - b.time);
      return this.nearestKeyIndex(time);
    },
    removeKey(i) { calls.push(['remove', i]); keys.splice(i - 1, 1); },
    setValueAtKey(i, value) { keys[i - 1].value = value; },
    setInterpolationTypeAtKey(i, inType, outType) { Object.assign(keys[i - 1], { inType, outType }); },
    setTemporalEaseAtKey(i, inEase, outEase) { Object.assign(keys[i - 1], { inEase, outEase }); },
    setSpatialTangentsAtKey(i, inTangent, outTangent) { Object.assign(keys[i - 1], { inTangent, outTangent }); },
  };
  for (const [getter, field] of Object.entries({
    keyInInterpolationType: 'inType', keyOutInterpolationType: 'outType',
    keyInTemporalEase: 'inEase', keyOutTemporalEase: 'outEase',
    keyTemporalContinuous: 'temporalContinuous', keyTemporalAutoBezier: 'temporalAutoBezier',
    keyInSpatialTangent: 'inTangent', keyOutSpatialTangent: 'outTangent',
    keySpatialContinuous: 'spatialContinuous', keySpatialAutoBezier: 'spatialAutoBezier',
    keyRoving: 'roving', keySelected: 'selected', ...(labels ? { keyLabel: 'label' } : {}),
  })) property[getter] = (i) => keys[i - 1][field];
  for (const [setter, field] of Object.entries({
    setTemporalContinuousAtKey: 'temporalContinuous', setTemporalAutoBezierAtKey: 'temporalAutoBezier',
    setSpatialContinuousAtKey: 'spatialContinuous', setSpatialAutoBezierAtKey: 'spatialAutoBezier',
    setRovingAtKey: 'roving', setSelectedAtKey: 'selected', ...(labels ? { setLabelAtKey: 'label' } : {}),
  })) property[setter] = (i, value) => { keys[i - 1][field] = value; };
  const context = createContext(property);
  Object.assign(context, {
    ensureJSON() {}, encodePayload: JSON.stringify,
    aeResolveLayer: () => ({ layer: { index: 1, name: 'Title' } }),
    aeTryGetLayerUid: () => 42,
    app: { project: { activeItem: {} }, beginUndoGroup() { calls.push(['begin']); }, endUndoGroup() { calls.push(['end']); } },
    PropertyValueType: { OneD: 'number', TwoD_SPATIAL: 'spatial' },
    KeyframeInterpolationType: { BEZIER: 'bezier', LINEAR: 'linear', HOLD: 'hold' },
  });
  const edit = (index, action, time = null) => JSON.parse(context.editSingleKeyframe(1, null, 'Position', index, action, time));
  return { property, keys, calls, edit, context };
}

for (const time of [-1, 1.5, 3]) {
  test(`move key to ${time} preserves source metadata and untouched neighbors`, () => {
    const { keys, edit } = singleKeyContext({ spatial: true });
    const before = structuredClone(keys);
    const result = edit(2, 'move', time);
    assert.equal(result.status, 'success');
    assert.equal(keys.length, 3);
    assert.deepEqual(keys.find(k => k.time === time), { ...before[1], time });
    assert.deepEqual(keys.find(k => k.time === 0), before[0]);
    assert.deepEqual(keys.find(k => k.time === 2), before[2]);
    assert.equal(result.keyIndex, keys.findIndex(k => k.time === time) + 1);
  });
}

test('same time is a no-op without mutation', () => {
  const { edit, calls } = singleKeyContext();
  assert.equal(edit(2, 'move', 1).changed, false);
  assert.deepEqual(calls, []);
});

test('delete removes just the selected key', () => {
  const { keys, edit, calls } = singleKeyContext();
  const before = structuredClone(keys);
  assert.equal(edit(2, 'delete').status, 'success');
  assert.deepEqual(keys, [before[0], before[2]]);
  assert.deepEqual(calls, [['begin'], ['remove', 2], ['end']]);
});

for (const [index, action, time] of [[0, 'delete'], [4, 'delete'], [1.5, 'delete'], [true, 'delete'], [2, 'bad'], [2, 'move', NaN], [2, 'move', Infinity], [2, 'move', '3'], [2, 'move', 2], [2, 'move', 2.0000001]]) {
  test(`invalid edit ${index}/${action}/${time} is rejected before mutation`, () => {
    const { edit, calls } = singleKeyContext();
    assert.equal(edit(index, action, time).status, 'error');
    assert.deepEqual(calls, []);
  });
}

for (const action of ['move', 'delete']) {
  for (const field of ['temporalAutoBezier', 'spatialAutoBezier', 'roving']) {
    test(`${action} rejects ${field} even on a neighboring key`, () => {
      const { keys, edit, calls } = singleKeyContext({ spatial: true });
      keys[0][field] = true;
      assert.match(edit(2, action, 3).message, /auto-Bezier or roving/);
      assert.deepEqual(calls, []);
    });
  }
  test(`${action} rejects nonnumeric properties before mutation`, () => {
    const { property, edit, calls } = singleKeyContext();
    property.propertyValueType = 'text';
    assert.match(edit(2, action, 3).message, /numeric properties only/);
    assert.deepEqual(calls, []);
  });
}

test('move supports older hosts without key labels', () => {
  const { edit } = singleKeyContext({ labels: false });
  assert.equal(edit(2, 'move', 3).status, 'success');
});

test('missing label setter rejects before mutation', () => {
  const { property, edit, calls } = singleKeyContext();
  delete property.setLabelAtKey;
  assert.match(edit(2, 'move', 3).message, /label preservation/);
  assert.deepEqual(calls, []);
});

test('missing metadata setter rejects before mutation', () => {
  const { property, edit, calls } = singleKeyContext();
  delete property.setTemporalEaseAtKey;
  assert.match(edit(2, 'move', 3).message, /missing setTemporalEaseAtKey/);
  assert.deepEqual(calls, []);
});

test('setter failure rolls back only inserted key and preserves original track', () => {
  const { property, keys, edit, calls } = singleKeyContext();
  const before = structuredClone(keys);
  property.setTemporalEaseAtKey = () => { throw new Error('injected setter error'); };
  const result = edit(2, 'move', -1);
  assert.equal(result.status, 'error');
  assert.equal(result.mayHaveChanged, false);
  assert.deepEqual(keys, before);
  assert.deepEqual(calls.at(-1), ['end']);
});

test('rollback failure is reported with possible modification', () => {
  const { property, edit } = singleKeyContext();
  property.setTemporalEaseAtKey = () => { throw new Error('setter failed'); };
  property.removeKey = () => { throw new Error('rollback failed'); };
  const result = edit(2, 'move', 3);
  assert.equal(result.mayHaveChanged, true);
  assert.match(result.rollbackError, /rollback failed/);
});

test('uncertain source removal never deletes the prepared replacement', () => {
  const { property, edit, keys } = singleKeyContext();
  const remove = property.removeKey;
  property.removeKey = (i) => { remove(i); throw new Error('after removal'); };
  const result = edit(2, 'move', 3);
  assert.equal(result.mayHaveChanged, true);
  assert.equal(keys.length, 3);
  assert.equal(keys[2].value, 25);
});

test('locked layer is rejected before mutation', () => {
  const { context, edit, calls } = singleKeyContext();
  context.aeResolveLayer = () => ({ layer: { locked: true } });
  assert.match(edit(2, 'move', 3).message, /locked layer/);
  assert.deepEqual(calls, []);
});

test('replacement readback mismatch preserves source and rolls back only new key', () => {
  const { property, keys, edit, calls } = singleKeyContext();
  const before = structuredClone(keys);
  property.setSelectedAtKey = () => {};
  const result = edit(2, 'move', 3);
  assert.match(result.message, /metadata verification failed/);
  assert.equal(result.mayHaveChanged, false);
  assert.deepEqual(keys, before);
  assert.equal(calls.filter(c => c[0] === 'remove').length, 1);
});

test('neighbor changes are detected by readback', () => {
  const { property, keys, edit } = singleKeyContext();
  const set = property.setValueAtKey;
  property.setValueAtKey = (i, value) => { set(i, value); keys[0].value = 999; };
  const result = edit(2, 'move', 3);
  assert.equal(result.mayHaveChanged, true);
  assert.match(result.message, /metadata verification failed/);
});

test('deleting the last key verifies the retained pre-expression static value', () => {
  const { property, keys, edit } = singleKeyContext();
  keys.splice(1);
  property.valueAtTime = (time, preExpression) => {
    assert.equal(time, 0); assert.equal(preExpression, true); return 0;
  };
  assert.equal(edit(1, 'delete').status, 'success');
  assert.equal(keys.length, 0);
});

test('rollback checks neighboring metadata before claiming no change', () => {
  const { property, keys, edit } = singleKeyContext();
  property.setTemporalEaseAtKey = () => {
    keys[0].value = 999;
    throw new Error('setter failed after changing neighbor');
  };
  const result = edit(2, 'move', 3);
  assert.equal(result.mayHaveChanged, true);
  assert.match(result.rollbackError, /Rollback metadata mismatch/);
});

test('insertion throwing after adding a key rolls back the new key', () => {
  const { property, keys, edit } = singleKeyContext();
  const before = structuredClone(keys);
  const add = property.addKey;
  property.addKey = (time) => { add.call(property, time); throw new Error('after insertion'); };
  const result = edit(2, 'move', 3);
  assert.equal(result.mayHaveChanged, false);
  assert.deepEqual(keys, before);
});

for (const action of ['move', 'delete']) {
  test(`${action} allows AE to recompute derived LINEAR segment speeds`, () => {
    const { property, keys, edit } = singleKeyContext();
    for (const key of keys) { key.inType = 'linear'; key.outType = 'linear'; }
    property.keyInTemporalEase = (index) => {
      const previous = keys[index - 2], key = keys[index - 1];
      return [{ speed: previous ? (key.value - previous.value) / (key.time - previous.time) : 0, influence: 33 }];
    };
    property.keyOutTemporalEase = (index) => {
      const next = keys[index], key = keys[index - 1];
      return [{ speed: next ? (next.value - key.value) / (next.time - key.time) : 0, influence: 33 }];
    };
    property.setTemporalEaseAtKey = () => { throw new Error('must not set ease on a linear key'); };
    assert.equal(edit(2, action, 3).status, 'success');
  });
}

test('BEZIER side ease mismatch still fails verification', () => {
  const { property, keys, edit } = singleKeyContext();
  const before = structuredClone(keys);
  property.setTemporalEaseAtKey = (i, inEase, outEase) => {
    keys[i - 1].inEase = [{ speed: 999, influence: 40 }];
    keys[i - 1].outEase = outEase;
  };
  const result = edit(2, 'move', 3);
  assert.equal(result.mayHaveChanged, false);
  assert.deepEqual(keys, before);
  assert.match(result.message, /metadata verification failed/);
});

for (const offset of [0.0000005, 0.000002]) {
  test(`destination quantization by ${offset} seconds uses absolute tolerance`, () => {
    const { property, keys, edit } = singleKeyContext();
    const before = structuredClone(keys);
    const add = property.addKey;
    property.addKey = time => add.call(property, time + offset);
    const result = edit(2, 'move', 100000);
    if (offset <= 0.000001) {
      assert.equal(result.status, 'success');
      assert.equal(result.time, 100000 + offset);
    } else {
      assert.equal(result.status, 'error');
      assert.equal(result.mayHaveChanged, false);
      assert.deepEqual(keys, before);
    }
  });
}

test('long composition neighbor time corruption is not hidden by relative tolerance', () => {
  const { property, keys, edit } = singleKeyContext();
  keys[0].time = 100000; keys[1].time = 100001; keys[2].time = 100002;
  const remove = property.removeKey;
  property.removeKey = i => { remove(i); keys[0].time += 0.0001; };
  const result = edit(2, 'move', 100003);
  assert.equal(result.status, 'error');
  assert.equal(result.mayHaveChanged, true);
  assert.match(result.message, /metadata verification failed/);
});
