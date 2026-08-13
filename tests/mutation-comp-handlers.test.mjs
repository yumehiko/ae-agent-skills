import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(
  path.join(root, 'host', 'lib', 'mutation_handlers.jsx'),
  'utf8',
);

function createContext() {
  const context = vm.createContext({
    ensureJSON() {},
    encodePayload(value) { return JSON.stringify(value); },
    log() {},
  });
  vm.runInContext(`
    function CompItem(name) {
      this.name = name;
      this.openInViewer = function() {
        activationLog.push(this.name);
        app.project.activeItem = this;
      };
    }
  `, context);
  vm.runInContext(source, context);
  return context;
}

test('explicit comp mutation activates only for the operation and restores previous comp', () => {
  const context = createContext();
  vm.runInContext(`
    activationLog = [];
    previousComp = new CompItem("Previous");
    targetComp = new CompItem("Target");
    app = { project: { activeItem: previousComp } };
    aeResolveQueryComp = function() { return { item: targetComp, error: null }; };
    operation = function() {
      operationActiveComp = app.project.activeItem.name;
      return "operation-result";
    };
  `, context);

  const result = vm.runInContext(
    'aeRunMutationInComp(null, "Target", operation)',
    context,
  );

  assert.equal(result, 'operation-result');
  assert.equal(context.operationActiveComp, 'Target');
  assert.deepEqual(Array.from(context.activationLog), ['Target', 'Previous']);
  assert.equal(context.app.project.activeItem.name, 'Previous');
});

test('explicit comp mutation restores previous comp after an exception', () => {
  const context = createContext();
  vm.runInContext(`
    activationLog = [];
    previousComp = new CompItem("Previous");
    targetComp = new CompItem("Target");
    app = { project: { activeItem: previousComp } };
    aeResolveQueryComp = function() { return { item: targetComp, error: null }; };
    operation = function() { throw new Error("boom"); };
  `, context);

  const result = JSON.parse(vm.runInContext(
    'aeRunMutationInComp(17, null, operation)',
    context,
  ));

  assert.equal(result.status, 'error');
  assert.match(result.message, /boom/);
  assert.deepEqual(Array.from(context.activationLog), ['Target', 'Previous']);
  assert.equal(context.app.project.activeItem.name, 'Previous');
});
