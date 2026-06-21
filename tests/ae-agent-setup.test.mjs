import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  expandAgentTarget,
  getClaudeCommandInstallTarget,
  getDetectedAgents,
  getSkillInstallTargets,
  installSkills,
  parseArgs,
} from '../bin/ae-agent-setup-lib.mjs';

test('parseArgs accepts claude and all agent values', () => {
  assert.equal(parseArgs(['--agent', 'claude']).agent, 'claude');
  assert.equal(parseArgs(['--agent', 'all']).agent, 'all');
});

test('expandAgentTarget preserves both compatibility and adds all', () => {
  assert.deepEqual(expandAgentTarget('codex'), ['codex']);
  assert.deepEqual(expandAgentTarget('claude'), ['claude']);
  assert.deepEqual(expandAgentTarget('both'), ['codex', 'gemini']);
  assert.deepEqual(expandAgentTarget('all'), ['codex', 'gemini', 'claude']);
});

test('expandAgentTarget rejects unknown agents', () => {
  assert.throws(() => expandAgentTarget('cursor'), /Invalid --agent value/);
});

test('getDetectedAgents detects codex, gemini, and claude homes', () => {
  const home = '/Users/example';
  const existing = new Set([
    path.join(home, '.gemini'),
    path.join(home, '.claude'),
  ]);
  const fsModule = {
    existsSync(candidate) {
      return existing.has(candidate);
    },
  };

  assert.deepEqual(
    getDetectedAgents({ home, env: { CODEX_HOME: '/custom/codex' }, fsModule }),
    ['codex', 'gemini', 'claude'],
  );
});

test('getSkillInstallTargets resolves personal skill directories', () => {
  const targets = getSkillInstallTargets('all', {
    home: '/Users/example',
    env: { CODEX_HOME: '/custom/codex' },
  });

  assert.deepEqual(targets, [
    { kind: 'codex', destRoot: '/custom/codex/skills' },
    { kind: 'gemini', destRoot: '/Users/example/.gemini/skills' },
    { kind: 'claude', destRoot: '/Users/example/.claude/skills' },
  ]);
  assert.equal(
    getClaudeCommandInstallTarget({ home: '/Users/example' }),
    '/Users/example/.claude/commands',
  );
});

test('installSkills installs Claude user skills and slash commands', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-agent-setup-test-root-'));
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-agent-setup-test-home-'));

  try {
    const sourceRoot = path.join(tempRoot, 'templates', 'skills');
    fs.mkdirSync(sourceRoot, { recursive: true });
    fs.writeFileSync(
      path.join(sourceRoot, 'aftereffects-cli.SKILL.md'),
      'name: aftereffects-cli\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(sourceRoot, 'aftereffects-declarative.SKILL.md'),
      'name: aftereffects-declarative\n',
      'utf8',
    );
    const commandRoot = path.join(tempRoot, 'templates', 'claude', 'commands');
    fs.mkdirSync(commandRoot, { recursive: true });
    fs.writeFileSync(
      path.join(commandRoot, 'aftereffects-cli.md'),
      'Use aftereffects-cli\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(commandRoot, 'aftereffects-declarative.md'),
      'Use aftereffects-declarative\n',
      'utf8',
    );

    installSkills('claude', { root: tempRoot, home: tempHome, env: {} });

    const claudeSkillRoot = path.join(tempHome, '.claude', 'skills');
    const claudeCommandRoot = path.join(tempHome, '.claude', 'commands');
    assert.equal(
      fs.readFileSync(path.join(claudeSkillRoot, 'aftereffects-cli', 'SKILL.md'), 'utf8'),
      'name: aftereffects-cli\n',
    );
    assert.equal(
      fs.readFileSync(path.join(claudeSkillRoot, 'aftereffects-declarative', 'SKILL.md'), 'utf8'),
      'name: aftereffects-declarative\n',
    );
    assert.equal(
      fs.readFileSync(path.join(claudeCommandRoot, 'aftereffects-cli.md'), 'utf8'),
      'Use aftereffects-cli\n',
    );
    assert.equal(
      fs.readFileSync(path.join(claudeCommandRoot, 'aftereffects-declarative.md'), 'utf8'),
      'Use aftereffects-declarative\n',
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});
