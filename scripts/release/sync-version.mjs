#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const packageJsonPath = path.join(rootDir, 'package.json');
const manifestPath = path.join(rootDir, 'CSXS', 'manifest.xml');
const pluginManifestPath = path.join(rootDir, '.codex-plugin', 'plugin.json');
const pyprojectPath = path.join(rootDir, 'pyproject.toml');
const pyAepSkillPath = path.join(rootDir, 'skills', 'aftereffects-py-aep', 'SKILL.md');
const pyAepAgentPath = path.join(
  rootDir,
  'skills',
  'aftereffects-py-aep',
  'agents',
  'openai.yaml',
);

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = pkg.version;

if (!version) {
  throw new Error('package.json version is missing');
}

const stableMatch = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
const previewMatch = version.match(/^(\d+)\.(\d+)\.(\d+)-pyaep\.(\d+)$/);
if (!stableMatch && !previewMatch) {
  throw new Error(`Unsupported release version: ${version}`);
}

const match = stableMatch || previewMatch;
const baseVersion = `${match[1]}.${match[2]}.${match[3]}`;
const pythonVersion = previewMatch ? `${baseVersion}.dev${previewMatch[4]}` : baseVersion;
const cepVersion = previewMatch ? `${baseVersion}.pyaep-${previewMatch[4]}` : baseVersion;

let manifest = fs.readFileSync(manifestPath, 'utf8');

manifest = manifest.replace(
  /ExtensionBundleVersion="[^"]+"/g,
  `ExtensionBundleVersion="${cepVersion}"`
);
manifest = manifest.replace(
  /(<Extension Id="com\.yumehiko\.aeagentskill\.panel" Version=")[^"]+("\s*\/?>)/g,
  `$1${cepVersion}$2`
);

fs.writeFileSync(manifestPath, manifest, 'utf8');

const pluginManifest = JSON.parse(fs.readFileSync(pluginManifestPath, 'utf8'));
pluginManifest.version = version;
fs.writeFileSync(pluginManifestPath, `${JSON.stringify(pluginManifest, null, 2)}\n`, 'utf8');

let pyproject = fs.readFileSync(pyprojectPath, 'utf8');
pyproject = pyproject.replace(
  /^(version\s*=\s*")[^"]+("\s*)$/m,
  `$1${pythonVersion}$2`,
);
fs.writeFileSync(pyprojectPath, pyproject, 'utf8');

let pyAepSkill = fs.readFileSync(pyAepSkillPath, 'utf8');
pyAepSkill = pyAepSkill.replace(
  /Preview release: `ae-agent-skills@[^`]+`/,
  `Preview release: \`ae-agent-skills@${version}\``,
);
fs.writeFileSync(pyAepSkillPath, pyAepSkill, 'utf8');

let pyAepAgent = fs.readFileSync(pyAepAgentPath, 'utf8');
pyAepAgent = pyAepAgent.replace(
  /display_name: "After Effects py-aep Preview(?: [^"]+)?"/,
  `display_name: "After Effects py-aep Preview ${version}"`,
);
fs.writeFileSync(pyAepAgentPath, pyAepAgent, 'utf8');

console.log(
  `Synced package=${version} plugin=${version} python=${pythonVersion} cep=${cepVersion}`,
);
