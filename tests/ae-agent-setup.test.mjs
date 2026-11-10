import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  AGENT_WORKSPACE_NAME,
  PACKAGE_VERSION,
  cliInstallSpec,
  expandAgentTarget,
  getDetectedAgents,
  getSkillInstallTargets,
  installSkills,
  printHelp,
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

test('plugin and npm package expose the py-aep skill only', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const plugin = JSON.parse(
    fs.readFileSync(path.join(root, '.codex-plugin', 'plugin.json'), 'utf8'),
  );

  assert.equal(PACKAGE_VERSION, pkg.version);
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
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
  for (const relativePath of [
    ['scripts', 'editorial.py'],
    ['scripts', 'edit_edl.py'],
    ['scripts', 'render_editorial_proxy.py'],
    ['references', 'editorial-workflow.md'],
  ]) {
    assert.equal(
      fs.existsSync(
        path.join(root, 'skills', 'aftereffects-py-aep', ...relativePath),
      ),
      true,
    );
  }
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

test('installer resolves Python and ZXP from its immutable release tag', () => {
  assert.equal(
    cliInstallSpec('yumehiko/ae-agent-skills'),
    `git+https://github.com/yumehiko/ae-agent-skills.git@v${PACKAGE_VERSION}`,
  );
  assert.equal(
    releaseApiUrl('yumehiko/ae-agent-skills'),
    `https://api.github.com/repos/yumehiko/ae-agent-skills/releases/tags/v${PACKAGE_VERSION}`,
  );
});

test('workspace contains only the feedback template', () => {
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
      new RegExp(`バージョン: ae-agent-skills@${PACKAGE_VERSION}`),
    );
    assert.equal(fs.existsSync(path.join(workspace, 'scene.schema.json')), false);
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});

test('stable Python and CEP versions are synchronized from npm version', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const match = PACKAGE_VERSION.match(/^(\d+)\.(\d+)\.(\d+)$/);
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
  assert.match(pyproject, new RegExp(`version = "${base}"`));
  assert.match(manifest, new RegExp(`ExtensionBundleVersion="${base}"`));
  assert.match(skill, new RegExp(`ae-agent-skills@${PACKAGE_VERSION}`));
  assert.match(agentMetadata, new RegExp(`After Effects py-aep ${PACKAGE_VERSION}`));
});


test('skip-cli keeps its flag and documents skipped browser prerequisites', () => {
  assert.equal(parseArgs(['--skip-cli']).skipCli, true);
  let help = '';
  printHelp((text) => { help += text; });
  assert.match(help, /--skip-cli\s+Skip Python CLIs and generative runtime\/browser prerequisites/);
});

const generativeFiles = [
  'scripts/render_generative.py',
  'scripts/ae_generative/__init__.py',
  'scripts/ae_generative/cli.py',
  'scripts/ae_generative/renderer.py',
  'scripts/ae_generative/aep.py',
  'references/generative-workflow.md',
  'assets/generative/floating-icons/index.html',
  'assets/generative/floating-icons/scene.js',
  'assets/generative/floating-icons/scene.json',
  'assets/generative/floating-icons/star.svg',
];

test('default skill copies carry the core generative runtime for every agent', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-generative-install-'));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    installSkills('all', { root, home, env: {} });
    for (const { destRoot } of getSkillInstallTargets('all', { home, env: {} })) {
      for (const relative of generativeFiles) {
        const source = path.join(root, 'skills', 'aftereffects-py-aep', relative);
        const installed = path.join(destRoot, 'aftereffects-py-aep', relative);
        assert.equal(fs.readFileSync(installed, 'utf8'), fs.readFileSync(source, 'utf8'), relative);
      }
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('npm archive includes the canonical generative runtime and guide', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: root, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const packed = new Set(JSON.parse(result.stdout)[0].files.map((file) => file.path));
  for (const relative of generativeFiles) {
    assert.ok(packed.has(`skills/aftereffects-py-aep/${relative}`), relative);
  }
  assert.ok(![...packed].some((file) => file.includes('__pycache__') || file.endsWith('.pyc')));
});
