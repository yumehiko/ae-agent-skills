import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(
  path.join(root, 'client', 'lib', 'request_handlers_snapshot.js'),
  'utf8',
);

function createContext(payload, hostResult = { status: 'success', width: 540, height: 960 }) {
  const responses = [];
  const scripts = [];
  const context = vm.createContext({
    crypto,
    fs,
    path,
    Buffer,
    setTimeout,
    isFinite,
    log() {},
    readJsonBody(_req, _res, callback) {
      callback(payload);
    },
    sendBadRequest(_res, message) {
      responses.push({ status: 400, payload: { status: 'error', message } });
    },
    sendJson(_res, status, responsePayload) {
      responses.push({ status, payload: responsePayload });
    },
    toExtendScriptStringLiteral(value) {
      return JSON.stringify(String(value));
    },
    parseBridgeResult(result) {
      return JSON.parse(result);
    },
    evalHostScript(script, callback) {
      scripts.push(script);
      if (script.startsWith('cleanupCompSnapshot(')) {
        callback(JSON.stringify({ status: 'success', removed: true }));
        return;
      }
      const tempPathMatch = script.match(/"([^"\\]*(?:\\.[^"\\]*)*\.part\.png)"/);
      if (hostResult.status === 'success' && tempPathMatch) {
        fs.writeFileSync(
          JSON.parse(`"${tempPathMatch[1]}"`),
          Buffer.from([137, 80, 78, 71, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]),
        );
      }
      callback(JSON.stringify(hostResult));
    },
  });
  vm.runInContext(source, context);
  return { context, responses, scripts };
}

test('snapshot request atomically promotes a completed temporary PNG', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-snapshot-test-'));
  try {
    const outPath = path.join(tempDir, 'frame.png');
    const { context, responses } = createContext({
      compName: 'TX01_Title',
      time: 1.25,
      scale: 0.5,
      outPath,
    });
    context.req = {};
    context.res = {};

    vm.runInContext('handleCreateSnapshot(req, res)', context);

    await new Promise((resolve) => setTimeout(resolve, 80));

    assert.equal(responses[0].status, 200);
    assert.equal(responses[0].payload.data.outPath, outPath);
    assert.equal(fs.readFileSync(outPath).subarray(-8).toString('hex'), '49454e44ae426082');
    assert.deepEqual(fs.readdirSync(tempDir), ['frame.png']);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('snapshot request removes its temporary file after a host error', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-snapshot-test-'));
  try {
    const outPath = path.join(tempDir, 'frame.png');
    const { context, responses } = createContext(
      { compId: 7, outPath },
      { status: 'error', message: 'render failed' },
    );
    context.req = {};
    context.res = {};

    vm.runInContext('handleCreateSnapshot(req, res)', context);

    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(responses[0].status, 400);
    assert.equal(fs.existsSync(outPath), false);
    assert.deepEqual(fs.readdirSync(tempDir), []);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('snapshot request refuses to overwrite an existing output', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-snapshot-test-'));
  try {
    const outPath = path.join(tempDir, 'frame.png');
    fs.writeFileSync(outPath, 'existing');
    const { context, responses, scripts } = createContext({ compId: 7, outPath });
    context.req = {};
    context.res = {};

    vm.runInContext('handleCreateSnapshot(req, res)', context);

    assert.equal(responses[0].status, 400);
    assert.match(responses[0].payload.message, /already exists/);
    assert.equal(scripts.length, 0);
    assert.equal(fs.readFileSync(outPath, 'utf8'), 'existing');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
