import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'host', 'lib', 'common.jsx'), 'utf8');

function createContext(project) {
  function File(value) {
    if (!(this instanceof File)) return new File(value);
    this.fsName = path.resolve(String(value));
    this.name = path.basename(this.fsName);
  }
  const context = vm.createContext({
    app: { project },
    File,
    Folder: { fs: 'Macintosh' },
    encodePayload(value) {
      return JSON.stringify(value);
    },
    log() {},
  });
  vm.runInContext(source, context);
  return context;
}

test('project state includes absolute file identity and dirty state', () => {
  const context = createContext({
    file: { fsName: '/projects/main.aep', name: 'main.aep' },
    name: 'main.aep',
    dirty: true,
  });

  const state = vm.runInContext('aeGetProjectState()', context);

  assert.deepEqual(JSON.parse(JSON.stringify(state)), {
    path: '/projects/main.aep',
    name: 'main.aep',
    dirty: true,
    saved: true,
  });
});

test('project state marks an unsaved project without inventing a path', () => {
  const context = createContext({ file: null, name: 'Untitled Project.aep', dirty: false });

  const state = vm.runInContext('aeGetProjectState()', context);

  assert.equal(state.path, null);
  assert.equal(state.name, 'Untitled Project.aep');
  assert.equal(state.saved, false);
});

test('project state reports unknown dirty state as null', () => {
  const context = createContext({ file: null, name: 'Untitled' });

  const state = vm.runInContext('aeGetProjectState()', context);

  assert.equal(state.dirty, null);
});

test('project path comparison normalizes relative expected paths', () => {
  const context = createContext({ file: null, name: 'Untitled', dirty: false });
  context.projectState = { path: path.resolve('/projects/main.aep') };

  assert.equal(
    vm.runInContext('aeProjectPathMatches("/projects/../projects/main.aep", projectState)', context),
    true,
  );
});
