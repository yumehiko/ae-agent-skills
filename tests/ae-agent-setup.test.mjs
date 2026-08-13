import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  AGENT_WORKSPACE_NAME,
  PACKAGE_VERSION,
  cliInstallSpec,
  expandAgentTarget,
  getDetectedAgents,
  getSkillInstallTargets,
  installSkills,
  parseArgs,
  releaseApiUrl,
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
  assert.throws(() => expandAgentTarget('both'), /Invalid --agent value/);
});

test('getDetectedAgents detects configured agent homes', () => {
  const home = '/Users/example';
  const existing = new Set([path.join(home, '.gemini'), path.join(home, '.claude')]);
  const fsModule = { existsSync(candidate) { return existing.has(candidate); } };
  assert.deepEqual(
    getDetectedAgents({ home, env: { CODEX_HOME: '/custom/codex' }, fsModule }),
    ['codex', 'gemini', 'claude'],
  );
});

test('getSkillInstallTargets resolves personal skill directories', () => {
  assert.deepEqual(
    getSkillInstallTargets('all', {
      home: '/Users/example',
      env: { CODEX_HOME: '/custom/codex' },
    }),
    [
      { kind: 'codex', destRoot: '/Users/example/.agents/skills' },
      { kind: 'gemini', destRoot: '/Users/example/.gemini/skills' },
      { kind: 'claude', destRoot: '/Users/example/.claude/skills' },
    ],
  );
});

test('preview installs only py-aep skill and removes stable skills', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-agent-preview-root-'));
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-agent-preview-home-'));
  try {
    const source = path.join(tempRoot, 'skills', 'aftereffects-py-aep');
    fs.mkdirSync(path.join(source, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(source, 'SKILL.md'), 'name: aftereffects-py-aep\n', 'utf8');
    fs.writeFileSync(path.join(source, 'agents', 'openai.yaml'), 'interface: {}\n', 'utf8');

    const destination = path.join(tempHome, '.agents', 'skills');
    for (const stableName of ['aftereffects-cli', 'aftereffects-declarative']) {
      fs.mkdirSync(path.join(destination, stableName), { recursive: true });
      fs.writeFileSync(path.join(destination, stableName, 'SKILL.md'), 'stable\n');
    }

    installSkills('codex', { root: tempRoot, home: tempHome, env: {} });

    assert.equal(
      fs.readFileSync(
        path.join(destination, 'aftereffects-py-aep', 'SKILL.md'),
        'utf8',
      ),
      'name: aftereffects-py-aep\n',
    );
    assert.equal(fs.existsSync(path.join(destination, 'aftereffects-cli')), false);
    assert.equal(fs.existsSync(path.join(destination, 'aftereffects-declarative')), false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test('plugin and npm package expose the preview skill only', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const plugin = JSON.parse(
    fs.readFileSync(path.join(root, '.codex-plugin', 'plugin.json'), 'utf8'),
  );

  assert.equal(PACKAGE_VERSION, pkg.version);
  assert.match(pkg.version, /^\d+\.\d+\.\d+-pyaep\.\d+$/);
  assert.equal(plugin.version, pkg.version);
  assert.equal(plugin.skills, './skills/');
  assert.equal(
    fs.existsSync(path.join(root, 'skills', 'aftereffects-py-aep', 'SKILL.md')),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(
        root,
        'skills',
        'aftereffects-py-aep',
        'assets',
        'new_project_template.py',
      ),
    ),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(
        root,
        'skills',
        'aftereffects-py-aep',
        'references',
        'new-project.md',
      ),
    ),
    true,
  );
  assert.equal(pkg.files.includes('skills/aftereffects-py-aep'), true);
  assert.equal(pkg.files.includes('!skills/aftereffects-py-aep/**/__pycache__'), true);
  assert.equal(pkg.files.includes('!skills/aftereffects-py-aep/**/*.pyc'), true);
  assert.equal(pkg.files.includes('skills'), false);
  assert.equal(pkg.files.includes('schemas'), false);
  assert.equal(pkg.files.includes('src'), false);
  assert.equal(pkg.files.includes('pyproject.toml'), false);
});

test('preview installer resolves Python and ZXP from its immutable release tag', () => {
  assert.equal(
    cliInstallSpec('yumehiko/ae-agent-skills'),
    `git+https://github.com/yumehiko/ae-agent-skills.git@v${PACKAGE_VERSION}`,
  );
  assert.equal(
    releaseApiUrl('yumehiko/ae-agent-skills'),
    `https://api.github.com/repos/yumehiko/ae-agent-skills/releases/tags/v${PACKAGE_VERSION}`,
  );
});

test('preview workspace contains only the feedback template', () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-agent-preview-home-'));
  try {
    setupAgentWorkspace({ home: tempHome });
    const workspace = path.join(tempHome, AGENT_WORKSPACE_NAME);
    assert.equal(
      fs.existsSync(path.join(workspace, 'feedback-template.ja.md')),
      true,
    );
    assert.match(
      fs.readFileSync(path.join(workspace, 'feedback-template.ja.md'), 'utf8'),
      new RegExp(`検証版: ae-agent-skills@${PACKAGE_VERSION}`),
    );
    assert.equal(fs.existsSync(path.join(workspace, 'scene.schema.json')), false);
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test('preview Python and CEP versions are synchronized from npm version', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const match = PACKAGE_VERSION.match(/^(\d+)\.(\d+)\.(\d+)-pyaep\.(\d+)$/);
  assert.ok(match);
  const base = `${match[1]}.${match[2]}.${match[3]}`;
  const pyproject = fs.readFileSync(path.join(root, 'pyproject.toml'), 'utf8');
  const manifest = fs.readFileSync(path.join(root, 'CSXS', 'manifest.xml'), 'utf8');
  const skill = fs.readFileSync(
    path.join(root, 'skills', 'aftereffects-py-aep', 'SKILL.md'),
    'utf8',
  );
  const agentMetadata = fs.readFileSync(
    path.join(root, 'skills', 'aftereffects-py-aep', 'agents', 'openai.yaml'),
    'utf8',
  );
  assert.match(pyproject, new RegExp(`version = "${base}\\.dev${match[4]}"`));
  assert.match(manifest, new RegExp(`ExtensionBundleVersion="${base}\\.pyaep-${match[4]}"`));
  assert.match(skill, new RegExp(`ae-agent-skills@${PACKAGE_VERSION}`));
  assert.match(agentMetadata, new RegExp(`Preview ${PACKAGE_VERSION}`));
});
