import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'host', 'lib', 'text_handlers.jsx'), 'utf8');

function createContext() {
  const context = vm.createContext({
    isFinite,
    ParagraphJustification: {
      LEFT_JUSTIFY: 1,
      CENTER_JUSTIFY: 2,
      RIGHT_JUSTIFY: 3,
      FULL_JUSTIFY_LASTLINE_LEFT: 4,
      FULL_JUSTIFY_LASTLINE_CENTER: 5,
      FULL_JUSTIFY_LASTLINE_RIGHT: 6,
      FULL_JUSTIFY_LASTLINE_FULL: 7,
    },
  });
  vm.runInContext(source, context);
  return context;
}

test('range styles use half-open integer ranges and reject paragraph settings', () => {
  const context = createContext();
  context.validRangesJSON = JSON.stringify([
    { start: 0, end: 3, style: { fillColor: [255, 0, 0], fontSize: 90 } },
  ]);
  vm.runInContext('aeValidateTextStyleRanges(JSON.parse(validRangesJSON))', context);

  context.invalidRangesJSON = JSON.stringify([
    { start: 0, end: 3, style: { justification: 'center' } },
  ]);
  assert.throws(
    () => vm.runInContext('aeValidateTextStyleRanges(JSON.parse(invalidRangesJSON))', context),
    /character settings only/,
  );
});

test('text animator validation accepts selector keyframes and rejects duplicate ids', () => {
  const context = createContext();
  context.animatorsJSON = JSON.stringify([
    {
      id: 'reveal',
      properties: { position: [0, 80], scale: [90, 90], opacity: 0, rotation: -5 },
      selector: {
        start: 0,
        end: 100,
        units: 2,
        basedOn: 2,
        shape: 2,
        smoothness: 75,
        easeHigh: 70,
        easeLow: -20,
        animations: [
          {
            property: 'start',
            keyframes: [{ time: 0, value: 0 }, { time: 0.5, value: 100 }],
          },
        ],
      },
    },
  ]);
  vm.runInContext('aeValidateTextAnimators(JSON.parse(animatorsJSON))', context);

  context.invalidAdvancedJSON = JSON.stringify([
    { id: 'invalid', properties: { opacity: 0 }, selector: { shape: 7 } },
  ]);
  assert.throws(
    () => vm.runInContext('aeValidateTextAnimators(JSON.parse(invalidAdvancedJSON))', context),
    /shape must be an integer from 1 to 6/,
  );

  context.duplicatesJSON = JSON.stringify([
    { id: 'same', properties: { opacity: 0 } },
    { id: 'same', properties: { rotation: 10 } },
  ]);
  assert.throws(
    () => vm.runInContext('aeValidateTextAnimators(JSON.parse(duplicatesJSON))', context),
    /duplicated/,
  );
});

test('advanced selector fields resolve to their AE match names', () => {
  const context = createContext();
  const matchNames = [
    'ADBE Text Range Units',
    'ADBE Text Range Type2',
    'ADBE Text Range Shape',
    'ADBE Text Selector Smoothness',
    'ADBE Text Levels Max Ease',
    'ADBE Text Levels Min Ease',
  ];
  context.selector = {
    numProperties: matchNames.length,
    property(index) {
      return { matchName: matchNames[index - 1], numProperties: 0 };
    },
  };

  for (const [name, expected] of [
    ['units', matchNames[0]],
    ['basedOn', matchNames[1]],
    ['shape', matchNames[2]],
    ['smoothness', matchNames[3]],
    ['easeHigh', matchNames[4]],
    ['easeLow', matchNames[5]],
  ]) {
    context.selectorName = name;
    assert.equal(
      vm.runInContext('aeTextSelectorProperty(selector, selectorName).matchName', context),
      expected,
    );
  }
});

test('text animator properties are activated instead of using hidden placeholders', () => {
  const context = createContext();
  let addCalls = 0;
  let appliedValue = null;
  const hidden = {
    matchName: 'ADBE Text Opacity',
    setValue() {
      throw new Error('hidden placeholder must not be used');
    },
  };
  const active = {
    matchName: 'ADBE Text Opacity',
    propertyIndex: 2,
    setValue(value) {
      appliedValue = value;
    },
  };
  const properties = {
    numProperties: 1,
    property(index) {
      return index === 2 ? active : hidden;
    },
    addProperty(matchName) {
      assert.equal(matchName, 'ADBE Text Opacity');
      addCalls += 1;
      this.numProperties = 2;
      return active;
    },
  };
  const animator = {
    property(matchName) {
      assert.equal(matchName, 'ADBE Text Animator Properties');
      return properties;
    },
  };
  context.animatorGroup = { property: () => animator };
  context.getPropertyValueDimensions = () => 1;
  context.getValueDimensions = () => 1;
  context.normalizeValueDimensions = (value) => value;

  vm.runInContext(
    'aeTextSetAnimatorProperty(animatorGroup, 1, "ADBE Text Opacity", "ADBE Text Opacity", 0)',
    context,
  );

  assert.equal(addCalls, 1);
  assert.equal(appliedValue, 0);
});
