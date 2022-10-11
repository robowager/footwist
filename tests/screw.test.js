import {
  equal, subset, index, identity, cross, det,
} from 'mathjs';

import {
  setTransformTranslation, setTransformRotation, rotationMatrixFromAxisAngle,
  rotationMatrixFromTransform, normalizeVector,
} from '../src/util';

import Screw from '../src/screw';
import Axis from '../src/axis';
import Twist from '../src/twist';

test('screw raise on negative magnitude', () => {
  expect(() => new Screw(new Axis([0, 0, 0], [1, 0, 0]), 1, -1)).toThrow(
    'Screw magnitude cannot be negative',
  );
});

test('screw is pure rotation', () => {
  const screw = new Screw(new Axis([0, 0, 0], [1, 0, 0]), 0, 0);
  expect(screw.isPureRotation).toBe(true);
});

test('screw is pure translation', () => {
  const screw = new Screw(new Axis([0, 0, 0], [1, 0, 0]), Infinity, 0);
  expect(screw.isPureTranslation).toBe(true);
});

test('screw equal to itself', () => {
  // arbitrary screw
  const screw = new Screw(new Axis([0, -0.1, 0.3], [1, 0.4, -2]), 0.5, 1.0);
  expect(screw.valuesEqualTo(screw)).toBe(true);
});

test('screw transform at negative magnitude', () => {
  const screw = new Screw(new Axis([0, 0, 0], [1, 0, 0]), 0, 1);
  expect(() => screw.getTransformAtMagnitude(-1)).toThrow(
    'Magnitude cannot be negative',
  );
});

test('screw transform at excess magnitude', () => {
  const screw = new Screw(new Axis([0, 0, 0], [1, 0, 0]), 0, 1);
  expect(() => screw.getTransformAtMagnitude(1.1)).toThrow(
    'cannot be greater than screw magnitude',
  );
});

test('zero twist to screw', () => {
  // Test added due to a bug discovered when trying to move axes that were at
  // identity transform.
  const zeroTwist = new Twist([0, 0, 0], [0, 0, 0]);
  Screw.fromTwist(zeroTwist);
});

test('pure translation transform to screw', () => {
  let g = identity(4);
  g = setTransformTranslation(g, [1.0, -2.12, 4.73]);

  const screw = Screw.fromTransform(g);
  expect(screw.isPureTranslation).toBe(true);

  const gFromScrew = screw.getTransform();
  // eslint-disable-next-line no-unused-vars
  gFromScrew.forEach((value, indx, matrx) => {
    expect(equal(value, subset(g, index(...indx)))).toBe(true);
  });
});

test('pure rotation transform to screw', () => {
  let g = identity(4);
  const vector = [0, 1, 0];
  const theta = 0.1;
  g = setTransformRotation(g, rotationMatrixFromAxisAngle(vector, theta));

  const screw = Screw.fromTransform(g);
  expect(screw.isPureRotation).toBe(true);

  const gFromScrew = screw.getTransform();
  // eslint-disable-next-line no-unused-vars
  gFromScrew.forEach((value, indx, matrx) => {
    expect(equal(value, subset(g, index(...indx)))).toBe(true);
  });
});

test('arbitrary transform to screw pure rotation', () => {
  let g = identity(4);
  g = setTransformTranslation(g, [0.231, -4.312, 0.063]);
  g = setTransformRotation(g, rotationMatrixFromAxisAngle([2.012, 1.044, -0.569], -0.513));

  const screw = Screw.fromTransform(g);
  expect(screw.axis.point instanceof Array).toBe(true);

  const gFromScrew = screw.getTransform();
  // eslint-disable-next-line no-unused-vars
  gFromScrew.forEach((value, indx, matrx) => {
    expect(equal(value, subset(g, index(...indx)))).toBe(true);
  });
});

test('screw viz transform identity', () => {
  // A screw which is pure rotation, along z, at the origin.
  const screw = new Screw(new Axis([0, 0, 0], [0, 0, 1]), 0, 0.1);
  const g = screw.getVizTransform();
  const gExpected = identity(4);
  // eslint-disable-next-line no-unused-vars
  g.forEach((value, indx, matrx) => {
    expect(equal(value, subset(gExpected, index(...indx)))).toBe(true);
  });

  // should not clobber axis
  expect(screw.axis.direction instanceof Array).toBe(true);
  expect(typeof (screw.axis.direction[0])).toBe('number');
});

test('screw viz transform zero offset', () => {
  // A screw which passes through origin. Discovered this was wrong from the
  // interactive viz.
  // Choosing a pure translation here, pure rotation through origin would also
  // work.
  const axis = new Axis([0, 0, 0], [1, 1, 1]);
  const screw = new Screw(axis, Infinity, 1);
  const g = screw.getVizTransform();

  const zExpected = normalizeVector([1, 1, 1]);

  // only requiring z to match expected, we don't care about x, y
  expect(equal(zExpected[0], subset(g, index(0, 2)))).toBe(true);
  expect(equal(zExpected[1], subset(g, index(1, 2)))).toBe(true);
  expect(equal(zExpected[2], subset(g, index(2, 2)))).toBe(true);
});

test('screw viz transform zero offset x axis direction', () => {
  // A related edge case, when the axis is along x. Also discovered from
  // interactive viz.
  const axis = new Axis([0, 0, 0], [1, 0, 0]);
  const screw = new Screw(axis, Infinity, 1);
  const g = screw.getVizTransform();
  const R = rotationMatrixFromTransform(g);
  expect(equal(det(R), 1)).toBe(true);
});

test('screw viz transform off-center', () => {
  // A screw which is pure rotation, along z, offset from origin.
  const axis = new Axis([0.5, 0.5, 0], [0, 0, 1]);
  const screw = new Screw(axis, 0, 0.1);
  const g = screw.getVizTransform();

  const x = normalizeVector([-0.5, -0.5, 0]);
  const y = cross([0, 0, 1], x);
  let gExpected = identity(4);
  gExpected = setTransformTranslation(gExpected, [0.5, 0.5, 0]);
  gExpected = subset(gExpected, index([0, 1, 2], 0), x);
  gExpected = subset(gExpected, index([0, 1, 2], 1), y);

  // eslint-disable-next-line no-unused-vars
  g.forEach((value, indx, matrx) => {
    expect(equal(value, subset(gExpected, index(...indx)))).toBe(true);
  });

  // should not clobber axis
  expect(screw.axis.direction instanceof Array).toBe(true);
  expect(typeof (screw.axis.direction[0])).toBe('number');
});

test('to three viz', () => {
  let g = identity(4);
  g = setTransformTranslation(g, [0.231, -4.312, 0.063]);
  g = setTransformRotation(g, rotationMatrixFromAxisAngle([2.012, 1.044, -0.569], -0.513));

  const screw = Screw.fromTransform(g);
  // TODO: needs asserts, right now just checks that no errors thrown.
  screw.getAxisThreeViz();
  screw.getHelixThreeViz();
  screw.getVizThreeTransform();
});
