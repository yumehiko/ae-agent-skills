import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../client/lib/request_handlers.js', import.meta.url), 'utf8');
function request(body, action = 'move') {
  const scripts = [], errors = [];
  const context = vm.createContext({
    readJsonBody: (_req, _res, callback) => callback(body),
    toExtendScriptStringLiteral: JSON.stringify,
    sendBadRequest: (_res, message) => errors.push(message),
    log() {},
  });
  vm.runInContext(source, context);
  context.handleBridgeMutationCall = (...args) => scripts.push(args);
  context.handleEditKeyframe({}, {}, action);
  return { scripts, errors };
}
const valid = { layerName: 'Title', compName: 'Main', propertyPath: 'Transform.Opacity', keyIndex: 2, time: 1.5 };
test('move forwards explicit comp and quoted path using the AE 1-based index', () => {
  const { scripts, errors } = request(valid);
  assert.deepEqual(errors, []);
  assert.equal(scripts[0][0], 'editSingleKeyframe(null, "Title", "Transform.Opacity", 2, "move", 1.5)');
  assert.equal(scripts[0][5], 'Main');
});
test('delete forwards no destination time', () => {
  const { scripts } = request(valid, 'delete');
  assert.match(scripts[0][0], /2, "delete", null\)$/);
});
for (const invalid of [{ keyIndex: 0 }, { keyIndex: 1.5 }, { keyIndex: '1' }, { keyIndex: true }, { time: Infinity }, { time: '1' }, { propertyPath: '' }, { propertyPath: {} }, { layerId: 2 }]) {
  test(`reject invalid payload ${JSON.stringify(invalid)}`, () => {
    const { scripts, errors } = request({ ...valid, ...invalid });
    assert.equal(scripts.length, 0);
    assert.equal(errors.length, 1);
  });
}
test('mutation errors preserve rollback and uncertainty information', () => {
  let response;
  const context = vm.createContext({
    log() {}, toExtendScriptStringLiteral: JSON.stringify,
    evalHostScript: (_script, cb) => cb({ status: 'error', message: 'failed', mayHaveChanged: true, rollbackError: 'rollback failed' }),
    parseBridgeResult: value => value,
    sendJson: (_res, code, payload) => { response = { code, payload }; },
  });
  vm.runInContext(source, context);
  context.handleBridgeMutationCall('edit()', {}, 'edit', 'failed');
  assert.equal(response.code, 500);
  assert.equal(response.payload.mayHaveChanged, true);
  assert.equal(response.payload.rollbackError, 'rollback failed');
});
