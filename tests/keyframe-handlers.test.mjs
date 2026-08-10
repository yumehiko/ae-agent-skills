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
