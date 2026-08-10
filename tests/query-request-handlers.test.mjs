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

test('properties and bounds forward inspection options to ExtendScript', () => {
  const { context, calls } = createContext();
  context.res = {};

  vm.runInContext(
    'handleGetProperties(new URLSearchParams("layerName=Title&compName=TX01_Title&includeKeyframes=true&time=1.25"), res)',
    context,
  );
  vm.runInContext(
    'handleGetLayerBounds(new URLSearchParams("layerId=2&compId=17&time=1.25"), res)',
    context,
  );

  assert.equal(calls.length, 2);
  assert.match(calls[0], /^getProperties\(null, /);
  assert.match(calls[0], /includeKeyframes/);
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
