import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(
  path.join(root, 'client', 'lib', 'request_handlers_text.js'),
  'utf8',
);

test('get text style forwards an explicit composition selector', () => {
  const scripts = [];
  const context = vm.createContext({
    URLSearchParams,
    normalizeLayerSelector(layerId, layerName) {
      return {
        ok: true,
        layerIdLiteral: layerId === undefined ? 'null' : String(layerId),
        layerNameLiteral: layerName === undefined ? 'null' : JSON.stringify(layerName),
      };
    },
    normalizeOptionalCompQuerySelector(searchParams) {
      return {
        ok: true,
        compIdLiteral: searchParams.get('compId') || 'null',
        compNameLiteral: searchParams.get('compName')
          ? JSON.stringify(searchParams.get('compName'))
          : 'null',
      };
    },
    handleBridgeMutationCall(script) {
      scripts.push(script);
    },
    sendBadRequest() {
      throw new Error('Unexpected bad request');
    },
  });
  vm.runInContext(source, context);
  context.params = new URLSearchParams('layerName=Title&compName=TX01_Title');
  context.res = {};

  vm.runInContext('handleGetTextStyle(params, res)', context);

  assert.deepEqual(scripts, ['getTextStyle(null, "Title", null, "TX01_Title")']);
});
