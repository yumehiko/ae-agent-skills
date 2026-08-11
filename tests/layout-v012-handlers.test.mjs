import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'host', 'lib', 'layout_handlers.jsx'), 'utf8');

function createContext() {
  const context = vm.createContext({ isFinite });
  vm.runInContext(source, context);
  return context;
}

test('visual-center layout accepts only an optional composition time', () => {
  const context = createContext();
  context.comp = { duration: 3, time: 0.5 };
  context.options = { time: 1.25 };

  const result = vm.runInContext('aeLayoutValidateVisualCenterOptions(comp, options)', context);
  assert.equal(result.time, 1.25);

  context.badOptions = { reference: 'comp' };
  assert.throws(
    () => vm.runInContext('aeLayoutValidateVisualCenterOptions(comp, badOptions)', context),
    /Unknown visual-center option/,
  );
});

test('scene layout validation recognizes visual-center operations', () => {
  const context = createContext();
  context.layoutJSON = JSON.stringify([{ type: 'visual-center', layerIds: ['title'], time: 0 }]);
  vm.runInContext(
    'errors = []; aeValidateSceneLayoutSpecs(JSON.parse(layoutJSON), { title: true }, { duration: 2 }, errors)',
    context,
  );

  assert.deepEqual(Array.from(context.errors), []);
});
