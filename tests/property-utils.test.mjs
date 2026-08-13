import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'host', 'lib', 'property_utils.jsx'), 'utf8');

function createContext() {
  const context = vm.createContext({
    AE_PROPERTY_TYPE_PROPERTY: 1,
    AE_PROPERTY_TYPE_GROUP: 2,
  });
  vm.runInContext(source, context);
  return context;
}

test('query exposure includes value properties that cannot host expressions', () => {
  const context = createContext();
  context.propertyUnderTest = {
    propertyType: 1,
    enabled: true,
    canSetExpression: false,
    canSetValue: true,
  };

  assert.equal(vm.runInContext('aeCanExposeProperty(propertyUnderTest)', context), true);
});

test('query exposure still rejects disabled and wholly immutable properties', () => {
  const context = createContext();
  context.disabledProperty = {
    propertyType: 1,
    enabled: false,
    canSetExpression: true,
    canSetValue: true,
  };
  context.immutableProperty = {
    propertyType: 1,
    enabled: true,
    canSetExpression: false,
    canSetValue: false,
  };

  assert.equal(vm.runInContext('aeCanExposeProperty(disabledProperty)', context), false);
  assert.equal(vm.runInContext('aeCanExposeProperty(immutableProperty)', context), false);
});
