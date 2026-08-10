import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(
  new URL('../client/lib/security.js', import.meta.url),
  'utf8',
);

function loadSecurity(overrides = {}) {
  const context = {
    Buffer,
    crypto,
    fs,
    os,
    path,
    process,
    sendJson(res, statusCode, payload) {
      res.statusCode = statusCode;
      res.payload = payload;
    },
    ...overrides,
  };
  vm.runInNewContext(source, context);
  return context;
}

function request(headers = {}) {
  return { headers: { host: '127.0.0.1:8080', ...headers } };
}

test('bridge authorization accepts the correct token from a loopback host', () => {
  const security = loadSecurity();
  const token = security.createBridgeToken();
  const req = request({ 'x-ae-bridge-token': token });
  const res = {};

  assert.equal(security.authorizeBridgeRequest(req, res, token), true);
  assert.equal(res.statusCode, undefined);
});

test('bridge authorization rejects missing tokens', () => {
  const security = loadSecurity();
  const res = {};

  assert.equal(security.authorizeBridgeRequest(request(), res, 'ab'.repeat(32)), false);
  assert.equal(res.statusCode, 401);
});

test('bridge authorization rejects browser origins even with a valid token', () => {
  const security = loadSecurity();
  const token = 'ab'.repeat(32);
  const req = request({ origin: 'https://example.com', 'x-ae-bridge-token': token });
  const res = {};

  assert.equal(security.authorizeBridgeRequest(req, res, token), false);
  assert.equal(res.statusCode, 403);
});

test('bridge authorization rejects non-loopback Host headers', () => {
  const security = loadSecurity();
  const token = 'ab'.repeat(32);
  const req = request({ host: 'attacker.example:8080', 'x-ae-bridge-token': token });
  const res = {};

  assert.equal(security.authorizeBridgeRequest(req, res, token), false);
  assert.equal(res.statusCode, 403);
});

test('bridge token file is written with owner-only permissions', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-bridge-security-'));
  const security = loadSecurity({ os: { homedir: () => tempHome } });

  try {
    const token = security.createBridgeToken();
    const tokenPath = security.writeBridgeTokenFile(token);
    assert.equal(fs.readFileSync(tokenPath, 'utf8').trim(), token);
    assert.equal(fs.statSync(tokenPath).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});
