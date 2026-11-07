import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'client', 'lib', 'request_handlers.js'), 'utf8');

function createContext(hostResult = []) {
  const calls = [];
  const responses = [];
  const context = vm.createContext({
    URLSearchParams,
    authorizeBridgeRequest() {
      return true;
    },
    evalHostScript(script, callback) {
      calls.push(script);
      callback(JSON.stringify(hostResult));
    },
    parseBridgeResult(result) {
      return JSON.parse(result);
    },
    sendJson(_res, status, payload) {
      responses.push({ status, payload });
    },
    sendBadRequest(_res, message) {
      responses.push({ status: 400, payload: { status: 'error', message } });
    },
    sendBridgeParseError() {
      throw new Error('Unexpected parse error');
    },
    toExtendScriptStringLiteral(value) {
      return JSON.stringify(String(value));
    },
    escapeForExtendScript(value) {
      return String(value);
    },
    applyCommonResponseHeaders() {},
    log() {},
    isFinite,
  });
  vm.runInContext(source, context);
  return { context, calls, responses };
}

test('query handlers generate explicit composition selectors', () => {
  const { context, calls } = createContext();
  const res = {};
  context.res = res;

  vm.runInContext(
    'handleGetLayers(new URLSearchParams("compName=TX01_Title"), res)',
    context,
  );
  vm.runInContext(
    'handleGetExpressionErrors(new URLSearchParams("compId=17"), res)',
    context,
  );

  assert.deepEqual(calls, [
    'getLayers(null, "TX01_Title")',
    'getExpressionErrors(17, null)',
  ]);
});

test('health reports the project currently open in After Effects', () => {
  const project = {
    path: '/projects/main.aep',
    name: 'main.aep',
    dirty: true,
    saved: true,
  };
  const { context, calls, responses } = createContext(project);
  context.res = {};

  vm.runInContext('handleHealth(res)', context);

  assert.deepEqual(calls, ['getProjectState()']);
  assert.deepEqual(JSON.parse(JSON.stringify(responses)), [{
    status: 200,
    payload: { status: 'ok', project },
  }]);
});

test('purge calls the all-cache host operation', () => {
  const { context, calls, responses } = createContext({
    status: 'success',
    target: 'all-caches',
  });
  context.res = {};

  vm.runInContext('handlePurge(res)', context);

  assert.deepEqual(calls, ['purgeAllCaches()']);
  assert.deepEqual(JSON.parse(JSON.stringify(responses)), [{
    status: 200,
    payload: {
      status: 'success',
      data: { status: 'success', target: 'all-caches' },
    },
  }]);
});

test('mutation bridge errors preserve rollback diagnostics', () => {
  const rollback = {
    attempted: true,
    succeeded: true,
    dirtyRestored: false,
  };
  const { context, responses } = createContext({
    status: 'error',
    message: 'mutation failed',
    rollback,
  });
  context.res = {};

  vm.runInContext(
    'handleBridgeMutationCall("applyScene()", res, "applyScene", "failed")',
    context,
  );

  assert.equal(responses.length, 1);
  assert.equal(responses[0].status, 500);
  assert.deepEqual(
    JSON.parse(JSON.stringify(responses[0].payload.rollback)),
    rollback,
  );
});

test('mutation calls wrap explicit composition selectors and preserve legacy active mode', () => {
  const { context, calls } = createContext({ status: 'success' });
  context.res = {};

  vm.runInContext(
    'handleBridgeMutationCall("setCTI(1)", res, "setCTI()", "failed", 17, null)',
    context,
  );
  vm.runInContext(
    'handleBridgeMutationCall("setCTI(2)", res, "setCTI()", "failed")',
    context,
  );

  assert.match(calls[0], /^aeRunMutationInComp\(17, null, function/);
  assert.match(calls[0], /return setCTI\(1\)/);
  assert.equal(calls[1], 'setCTI(2)');
});

test('properties and bounds forward inspection options to ExtendScript', () => {
  const { context, calls } = createContext();
  context.res = {};

  vm.runInContext(
    'handleGetProperties(new URLSearchParams("layerName=Title&compName=TX01_Title&propertyPath=ADBE%20Transform%20Group.ADBE%20Opacity&includeKeyframes=true&includeExpression=true&includeDisabled=true&time=1.25"), res)',
    context,
  );
  vm.runInContext(
    'handleGetLayerBounds(new URLSearchParams("layerId=2&compId=17&time=1.25"), res)',
    context,
  );

  assert.equal(calls.length, 2);
  assert.match(calls[0], /^getProperties\(null, /);
  assert.match(calls[0], /includeKeyframes/);
  assert.match(calls[0], /includeExpression/);
  assert.match(calls[0], /includeDisabled/);
  assert.match(calls[0], /propertyPath/);
  assert.match(calls[0], /TX01_Title/);
  assert.match(calls[1], /^getLayerBounds\(2, /);
  assert.match(calls[1], /compId/);
  assert.match(calls[1], /1\.25/);
});

test('bridge data calls surface host query errors instead of wrapping success', () => {
  const { context, responses } = createContext({
    status: 'Error',
    message: 'Composition not found.',
  });
  context.res = {};

  vm.runInContext('handleGetLayers(new URLSearchParams("compId=999"), res)', context);

  assert.deepEqual(JSON.parse(JSON.stringify(responses)), [{
    status: 400,
    payload: { status: 'error', message: 'Composition not found.' },
  }]);
});

test('query handlers reject conflicting composition selectors', () => {
  const { context, calls, responses } = createContext();
  context.res = {};

  vm.runInContext(
    'handleGetLayers(new URLSearchParams("compId=17&compName=TX01_Title"), res)',
    context,
  );

  assert.equal(calls.length, 0);
  assert.equal(responses[0].status, 400);
  assert.match(responses[0].payload.message, /at most one/);
});
