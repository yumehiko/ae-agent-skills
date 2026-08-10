import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  expandAgentTarget,
  getClaudeCommandInstallTarget,
  getDetectedAgents,
  getSkillInstallTargets,
  installSkills,
  parseArgs,
  setupAgentWorkspace,
} from '../bin/ae-agent-setup-lib.mjs';

test('parseArgs accepts claude and all agent values', () => {
  assert.equal(parseArgs(['--agent', 'claude']).agent, 'claude');
  assert.equal(parseArgs(['--agent', 'all']).agent, 'all');
});

test('expandAgentTarget supports individual agents and all', () => {
  assert.deepEqual(expandAgentTarget('codex'), ['codex']);
  assert.deepEqual(expandAgentTarget('claude'), ['claude']);
  assert.deepEqual(expandAgentTarget('all'), ['codex', 'gemini', 'claude']);
});

test('expandAgentTarget rejects the removed both alias', () => {
  assert.throws(() => expandAgentTarget('both'), /Invalid --agent value/);
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
    { kind: 'codex', destRoot: '/Users/example/.agents/skills' },
    { kind: 'gemini', destRoot: '/Users/example/.gemini/skills' },
    { kind: 'claude', destRoot: '/Users/example/.claude/skills' },
  ]);
  assert.equal(
    getClaudeCommandInstallTarget({ home: '/Users/example' }),
    '/Users/example/.claude/commands',
  );
});

test('installSkills copies standard skill directories and Claude slash commands', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-agent-setup-test-root-'));
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-agent-setup-test-home-'));

  try {
    const sourceRoot = path.join(tempRoot, 'skills');
    const cliSource = path.join(sourceRoot, 'aftereffects-cli');
    const declarativeSource = path.join(sourceRoot, 'aftereffects-declarative');
    fs.mkdirSync(path.join(cliSource, 'agents'), { recursive: true });
    fs.mkdirSync(declarativeSource, { recursive: true });
    fs.writeFileSync(
      path.join(cliSource, 'SKILL.md'),
      'name: aftereffects-cli\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(cliSource, 'agents', 'openai.yaml'),
      'interface:\n  display_name: "After Effects CLI"\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(declarativeSource, 'SKILL.md'),
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
      fs.readFileSync(
        path.join(claudeSkillRoot, 'aftereffects-cli', 'agents', 'openai.yaml'),
        'utf8',
      ),
      'interface:\n  display_name: "After Effects CLI"\n',
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

test('installSkills migrates Codex skills to the shared agent skill directory', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-agent-setup-test-root-'));
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-agent-setup-test-home-'));

  try {
    for (const skillName of ['aftereffects-cli', 'aftereffects-declarative']) {
      const source = path.join(tempRoot, 'skills', skillName);
      fs.mkdirSync(source, { recursive: true });
      fs.writeFileSync(path.join(source, 'SKILL.md'), `name: ${skillName}\n`, 'utf8');

      const legacy = path.join(tempHome, '.codex', 'skills', skillName);
      fs.mkdirSync(legacy, { recursive: true });
      fs.writeFileSync(path.join(legacy, 'SKILL.md'), 'legacy\n', 'utf8');
    }

    installSkills('codex', { root: tempRoot, home: tempHome, env: {} });

    for (const skillName of ['aftereffects-cli', 'aftereffects-declarative']) {
      const installed = path.join(tempHome, '.agents', 'skills', skillName, 'SKILL.md');
      const legacy = path.join(tempHome, '.codex', 'skills', skillName);
      assert.equal(fs.readFileSync(installed, 'utf8'), `name: ${skillName}\n`);
      assert.equal(fs.existsSync(legacy), false);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test('plugin manifest packages the canonical skills and matches the npm version', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const plugin = JSON.parse(
    fs.readFileSync(path.join(root, '.codex-plugin', 'plugin.json'), 'utf8'),
  );

  assert.equal(plugin.name, 'ae-agent-skills');
  assert.equal(plugin.version, pkg.version);
  assert.equal(plugin.skills, './skills/');
  assert.equal(fs.existsSync(path.join(root, 'skills', 'aftereffects-cli', 'SKILL.md')), true);
  assert.equal(
    fs.existsSync(path.join(root, 'skills', 'aftereffects-declarative', 'SKILL.md')),
    true,
  );
  assert.equal(pkg.files.includes('.codex-plugin'), true);
  assert.equal(pkg.files.includes('skills'), true);
  assert.equal(pkg.files.includes('docs'), false);
  assert.equal(pkg.files.includes('docs/cli.ja.md'), true);
  assert.equal(pkg.files.includes('docs/cli.md'), true);
  assert.equal(pkg.files.includes('scripts/signing'), false);
});

test('setupAgentWorkspace installs the footage editing example', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-agent-workspace-home-'));
  try {
    setupAgentWorkspace({ home: tempHome });
    const installed = path.join(
      tempHome,
      'ae-agent-skills',
      'references',
      'footage-edit.example.json',
    );
    assert.equal(fs.existsSync(installed), true);
    const example = JSON.parse(fs.readFileSync(installed, 'utf8'));
    assert.equal(example.assets[0].type, 'footage');
    assert.equal(example.layers[0].sourceId, example.assets[0].id);
    assert.equal(example.layers[0].audio.levelDb, -3);
    assert.equal(example.layers[0].audio.fadeIn, 0.5);
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test('setupAgentWorkspace installs the text style and layout scene example', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-agent-workspace-home-'));
  try {
    setupAgentWorkspace({ home: tempHome });
    const installed = path.join(
      tempHome,
      'ae-agent-skills',
      'references',
      'scene.example.json',
    );
    const example = JSON.parse(fs.readFileSync(installed, 'utf8'));
    const title = example.layers.find((layer) => layer.type === 'text');
    assert.equal(title.textStyle.font, 'ArialMT');
    assert.equal(title.textStyle.fontSize, 96);
    assert.equal(title.textStyle.justification, 'center');
    assert.equal(example.layout[0].type, 'align');
    assert.deepEqual(example.layout[0].layerIds, ['title']);
    assert.equal(example.layout[2].type, 'distribute');
    assert.equal(example.layout[2].mode, 'gaps');
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});
