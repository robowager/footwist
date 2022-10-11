import {
  getLeafNodePaths, joinTokensCamelCase,
  REPRESENTATION_LEAF_PATHS, componentsToField,
  cleanQuaternion, GuiHelper,
} from '../src/gui_helper';
import {
  equalTolerance,
} from '../src/util';
import Screw from '../src/screw';
import Axis from '../src/axis';

function arrayEqualDepthOne(array1, array2) {
  if (!(array1.length === array2.length)) {
    return false;
  }

  let i = 0;
  while (i < array1.length) {
    if (!(array1[i] === array2[i])) {
      return false;
    }
    i += 1;
  }

  return true;
}

test('get leaf node paths', () => {
  const map = new Map([
    // key, value pair
    ['a', true],
    // key, value pair
    [
      'b',
      new Map([
        // key, value pair
        ['c', true],
        // key, value pair
        ['d', new Map([['e', true]])],
      ]),
    ],
  ]);
  const paths = getLeafNodePaths(map);
  // three leaves
  expect(paths.length).toBe(3);
  // no ordering, so check individually
  const expected = [['a'], ['b', 'c'], ['b', 'd', 'e']];
  let i = 0;
  while (i < 3) {
    expect(arrayEqualDepthOne(paths[i], expected[i])).toBe(true);
    i += 1;
  }
});

test('join tokens camel case', () => {
  expect(joinTokensCamelCase('foo')).toBe('foo');
  expect(joinTokensCamelCase('foo', 'bar')).toBe('fooBar');
  expect(joinTokensCamelCase('foo', 'bar', 'baz')).toBe('fooBarBaz');
});

test('clean quaternion w 1', () => {
  // doesn't matter what the x, y, z inputs are if w = 1
  const quaternion = cleanQuaternion(1, 0.2, -0.3, 1);
  expect(quaternion.x).toBe(0);
  expect(quaternion.y).toBe(0);
  expect(quaternion.z).toBe(0);
  expect(quaternion.w).toBe(1);
});

test('clean quaternion w -1', () => {
  // doesn't matter what the x, y, z inputs are if w = -1
  const quaternion = cleanQuaternion(0, -1, 0.4, -1);
  expect(quaternion.x).toBe(0);
  expect(quaternion.y).toBe(0);
  expect(quaternion.z).toBe(0);
  expect(quaternion.w).toBe(1);
});

test('clean quaternion xyz zero', () => {
  // doesn't matter what q is if x, y, z is 0
  const quaternion = cleanQuaternion(0, 0, 0, -0.3);
  expect(quaternion.x).toBe(0);
  expect(quaternion.y).toBe(0);
  expect(quaternion.z).toBe(0);
  expect(quaternion.w).toBe(1);
});

test('clean quaternion scale', () => {
  const quaternion = cleanQuaternion(1, 2, -0.3, 0.5);
  expect(equalTolerance(quaternion.x, 0.3838590, 1e-7)).toBe(true);
  expect(equalTolerance(quaternion.y, 0.7677180, 1e-7)).toBe(true);
  expect(equalTolerance(quaternion.z, -0.1151577, 1e-7)).toBe(true);
  expect(quaternion.w).toBe(0.5);
});

test('representation fields defined', () => {
  const screw = new Screw(new Axis([0, 0, 0], [0, 0, 1]), 1, 0);

  const guiHelper = new GuiHelper(screw);
  // none of the representation fields should be undefined
  REPRESENTATION_LEAF_PATHS.forEach(
    (path) => {
      expect(guiHelper[componentsToField(...path)] === undefined).toBe(false);
    },
  );
});
