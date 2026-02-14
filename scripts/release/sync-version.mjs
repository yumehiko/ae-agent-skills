#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const packageJsonPath = path.join(rootDir, 'package.json');
const manifestPath = path.join(rootDir, 'CSXS', 'manifest.xml');

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = pkg.version;

if (!version) {
  throw new Error('package.json version is missing');
}

let manifest = fs.readFileSync(manifestPath, 'utf8');

manifest = manifest.replace(
  /ExtensionBundleVersion="[^"]+"/g,
  `ExtensionBundleVersion="${version}"`
);
manifest = manifest.replace(
  /(<Extension Id="com\.yumehiko\.aeagentskill\.panel" Version=")[^"]+("\s*\/?>)/g,
  `$1${version}$2`
);

fs.writeFileSync(manifestPath, manifest, 'utf8');
console.log(`Synced manifest version to ${version}`);
