import { equal } from 'mathjs';

import Axis from '../src/axis';

test('constructor throws on zero direction norm', () => {
  expect(() => new Axis([0, 0, 0], [0, 0, 0])).toThrow(
    'Input direction has zero norm',
  );
});

test('contains own point', () => {
  // arbitrary axis
  const axis = new Axis([-1, 0, 2], [1, 1, -0.5]);
  expect(axis.containsPoint(axis.point)).toBe(true);
});

test('contains point ahead and before', () => {
  // x-axis
  const axis = new Axis([0, 0, 0], [1, 0, 0]);
  // a point along +ve x
  expect(axis.containsPoint([2, 0, 0])).toBe(true);
  // a point along -ve x
  expect(axis.containsPoint([-1.5, 0, 0])).toBe(true);
});

test('get axis closest point', () => {
  const axis = new Axis([1, 0, 1], [0, 0, 1]);
  const closest = axis.getClosestPointToOrigin(axis);
  const expected = [1, 0, 0];
  expect(equal(closest[0], expected[0])).toBe(true);
  expect(equal(closest[1], expected[1])).toBe(true);
  expect(equal(closest[2], expected[2])).toBe(true);
});
