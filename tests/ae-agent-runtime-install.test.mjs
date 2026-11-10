import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { cliInstallSpec, getRuntimePaths, installCli, installSkills } from '../bin/ae-agent-setup-lib.mjs';

function fixture(t, overrides = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ae runtime 'space-"));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const calls = [];
  const messages = [];
  const options = {
    home,
    env: { HOME: home, PATH: process.env.PATH },
    commandExistsFn: () => true,
    spawnSyncFn: () => ({ status: 0, stdout: JSON.stringify({ version: [3, 13], executable: '/opt/homebrew/bin/python3.13' }) }),
    runFn: (cmd, args, opts) => calls.push({ cmd, args, opts }),
    output: (message) => messages.push(message),
    ...overrides,
  };
  return { home, calls, messages, options, install: () => installCli('example/repo', '1.2.3', options) };
}

test('clean install creates stable launchers, isolated pip, and verifies browser launch', (t) => {
  const f = fixture(t);
  const result = f.install();
  assert.equal(result.browserReady, true);
  assert.equal(fs.realpathSync(result.current), fs.realpathSync(path.dirname(path.dirname(result.interpreter))));
  assert.deepEqual(f.calls[0].args.slice(0, 3), ['-I', '-m', 'venv']);
  assert.equal(f.calls[0].cmd, '/opt/homebrew/bin/python3.13');
  assert.deepEqual(f.calls[1].args, ['-I', '-m', 'pip', 'install', '--upgrade', 'git+https://github.com/example/repo.git@v1.2.3']);
  for (const call of f.calls.slice(1)) assert.equal(call.cmd, result.interpreter);
  assert.ok(f.calls.at(-1).args.at(-1).includes('chromium.launch(headless=True)'));
  for (const command of ['ae-cli', 'ae-generative', 'python']) {
    assert.ok(fs.statSync(path.join(result.bin, command)).mode & 0o111);
    assert.match(fs.readFileSync(path.join(result.bin, command), 'utf8'), /export PLAYWRIGHT_SKIP_BROWSER_GC=1/);
  }
});

test('active venv and Homebrew PEP668 use base interpreter without --user or break-system-packages', (t) => {
  const f = fixture(t);
  Object.assign(f.options.env, { VIRTUAL_ENV: '/active/venv', PYTHONHOME: '/bad', PYTHONPATH: '/bad', PIP_USER: 'true', PIP_TARGET: '/bad', PIP_PREFIX: '/bad', PIP_CONFIG_FILE: '/bad' });
  f.install();
  for (const { args, opts } of f.calls) {
    assert.ok(!args.includes('--user'));
    assert.ok(!args.includes('--break-system-packages'));
    for (const name of ['VIRTUAL_ENV', 'PYTHONHOME', 'PYTHONPATH', 'PIP_USER', 'PIP_TARGET', 'PIP_PREFIX']) assert.equal(opts.env[name], undefined);
    assert.equal(opts.env.PIP_CONFIG_FILE, os.devNull);
  }
});

test('legacy installation is untouched and reruns atomically upgrade without moving venvs', (t) => {
  const f = fixture(t);
  const legacy = path.join(f.home, 'Library/Python/3.13/bin/ae-cli');
  fs.mkdirSync(path.dirname(legacy), { recursive: true });
  fs.writeFileSync(legacy, 'legacy');
  const first = f.install();
  const old = fs.realpathSync(first.current);
  const second = f.install();
  assert.notEqual(fs.realpathSync(second.current), old);
  assert.ok(fs.existsSync(old));
  assert.equal(fs.readFileSync(legacy, 'utf8'), 'legacy');
});

test('failed pip preserves old current and removes only the unsuccessful candidate', (t) => {
  const f = fixture(t);
  const first = f.install();
  const old = fs.realpathSync(first.current);
  const launcher = fs.readFileSync(path.join(first.bin, 'ae-cli'), 'utf8');
  f.options.runFn = (_cmd, args) => { if (args.includes('pip')) throw new Error('pip failed'); };
  assert.throws(f.install, /previous runtime was not changed.*pip failed[\s\S]*Retry:/);
  assert.equal(fs.realpathSync(first.current), old);
  assert.equal(fs.readFileSync(path.join(first.bin, 'ae-cli'), 'utf8'), launcher);
  assert.deepEqual(fs.readdirSync(first.envs), [path.basename(old)]);
});

test('browser failure still permits skills and CLIs; setup rerun recovers browser readiness', (t) => {
  const f = fixture(t);
  const record = f.options.runFn;
  f.options.runFn = (...args) => { record(...args); if (args[1].includes('playwright')) throw new Error('offline'); };
  const result = f.install();
  assert.equal(result.browserReady, false);
  assert.ok(fs.existsSync(result.current));
  assert.match(f.messages.join('\n'), /rendering is NOT ready/);
  assert.match(f.messages.join('\n'), /Retry browser setup:.*playwright install chromium/);
  installSkills('codex', { home: f.home, env: {} });
  assert.ok(fs.existsSync(path.join(f.home, '.agents/skills/aftereffects-py-aep/SKILL.md')));
  f.options.runFn = record;
  assert.equal(f.install().browserReady, true);
});

test('browser launch failure is a warning even after a successful download', (t) => {
  const f = fixture(t, { runFn: (_cmd, args) => { if (args.some((arg) => arg.includes('chromium.launch'))) throw new Error('cannot launch'); } });
  assert.equal(f.install().browserReady, false);
  assert.match(f.messages.join('\n'), /cannot launch/);
});

test('launchers quote spaces and apostrophes, preserve arguments, and use the managed Python', (t) => {
  const f = fixture(t);
  const result = f.install();
  fs.mkdirSync(path.dirname(result.interpreter), { recursive: true });
  // A stand-in for Python records precisely what the generated POSIX launcher execs.
  fs.writeFileSync(result.interpreter, '#!/bin/sh\nprintf "%s\\n" "$PLAYWRIGHT_BROWSERS_PATH" "${PYTHONHOME-unset}" "${PYTHONPATH-unset}" "$@"\n', { mode: 0o755 });
  for (const command of ['ae-cli', 'ae-generative', 'python']) {
    const run = spawnSync(path.join(result.bin, command), ['a file.py', "a'b", '$literal'], {
      encoding: 'utf8', env: { ...process.env, PYTHONHOME: '/bad', PYTHONPATH: '/bad' },
    });
    assert.equal(run.status, 0, run.stderr);
    const lines = run.stdout.trimEnd().split('\n');
    assert.deepEqual(lines.slice(0, 3), [result.browsers, 'unset', 'unset']);
    assert.deepEqual(lines.slice(-3), ['a file.py', "a'b", '$literal']);
    if (command !== 'python') assert.match(lines[5], /import run; raise SystemExit\(run\(\)\)/);
  }
});

test('missing/old/broken Python fails before creating a runtime with actionable recovery', (t) => {
  for (const overrides of [
    { commandExistsFn: () => false },
    { spawnSyncFn: () => ({ status: 0, stdout: '{"version":[3,9],"executable":"/usr/bin/python3"}' }) },
    { spawnSyncFn: () => ({ status: 1, stdout: '' }) },
  ]) {
    const f = fixture(t, overrides);
    assert.throws(f.install, /Python 3.10\+.*[Rr]etry:/);
    assert.ok(!fs.existsSync(getRuntimePaths(f.home).root));
    assert.equal(f.calls.length, 0);
  }
});

test('unsafe repo/version values never reach pip or filesystem paths', () => {
  for (const repo of ['owner/repo@branch', 'https://host/repo', '../repo', 'owner/repo;touch bad']) {
    assert.throws(() => cliInstallSpec(repo, '1.2.3'), /Invalid repository/);
  }
  for (const version of ['../../other', '1.2.3; bad', '1.2.3\n', '-rfile']) {
    assert.throws(() => cliInstallSpec('owner/repo', version), /Invalid release version/);
  }
  assert.equal(cliInstallSpec('owner/repo', '1.2.3-pyaep.1'), 'git+https://github.com/owner/repo.git@v1.2.3-pyaep.1');
});

test('Windows is rejected before invoking Python or writing files', (t) => {
  const f = fixture(t, { platform: 'win32' });
  assert.throws(f.install, /does not support Windows/);
  assert.equal(f.calls.length, 0);
  assert.ok(!fs.existsSync(getRuntimePaths(f.home).root));
});


test('CLI launcher preserves module return status and output', (t) => {
  const f = fixture(t);
  const result = f.install();
  fs.mkdirSync(path.dirname(result.interpreter), { recursive: true });
  // Substitute only the module import with a stand-in run() and execute the
  // launcher's exact remaining Python expression using a real interpreter.
  fs.writeFileSync(path.join(path.dirname(result.interpreter), 'launcher-test.py'), `import sys
code = sys.argv[3].replace('from ae_cli.main import run', 'run = lambda: (print("handled failure"), 1)[1]')
exec(code)
`);
  fs.writeFileSync(result.interpreter, '#!/bin/sh\nexec python3 -I "${0%/*}/launcher-test.py" "$@"\n', { mode: 0o755 });
  const executed = spawnSync(path.join(result.bin, 'ae-cli'), [], {
    encoding: 'utf8', env: { HOME: f.home, PATH: process.env.PATH },
  });
  assert.equal(executed.status, 1, executed.stderr);
  assert.equal(executed.stdout.trim(), 'handled failure');
});
