import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(
  path.join(root, 'client', 'lib', 'request_handlers_scene.js'),
  'utf8',
);

function createContext(body) {
  const scripts = [];
  const errors = [];
  const context = vm.createContext({
    readJsonBody(_req, _res, callback) {
      callback(body);
    },
    toExtendScriptStringLiteral(value) {
      return JSON.stringify(String(value));
    },
    handleBridgeMutationCall(script) {
      scripts.push(script);
    },
    sendBadRequest(_res, message) {
      errors.push(message);
    },
    log() {},
  });
  vm.runInContext(source, context);
  return { context, scripts, errors };
}

test('apply scene forwards the expected project into host options', () => {
  const { context, scripts, errors } = createContext({
    scene: { layers: [] },
    validateOnly: true,
    mode: 'merge',
    expectProject: '/projects/main.aep',
  });
  context.req = {};
  context.res = {};

  vm.runInContext('handleApplyScene(req, res)', context);

  assert.deepEqual(errors, []);
  assert.equal(scripts.length, 1);
  assert.match(scripts[0], /applyScene/);
  assert.match(scripts[0], /expectProject/);
  assert.ok(scripts[0].includes('/projects/main.aep'));
});

test('apply scene rejects an empty expected project', () => {
  const { context, scripts, errors } = createContext({
    scene: { layers: [] },
    expectProject: '   ',
  });
  context.req = {};
  context.res = {};

  vm.runInContext('handleApplyScene(req, res)', context);

  assert.equal(scripts.length, 0);
  assert.match(errors[0], /non-empty absolute path/);
});
