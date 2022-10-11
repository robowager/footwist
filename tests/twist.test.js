import {
  equal, subset, index, identity,
} from 'mathjs';

import {
  setTransformTranslation, setTransformRotation, rotationMatrixFromAxisAngle,
} from '../src/util';

import Twist from '../src/twist';

test('zero twist norm', () => {
  const twist = new Twist([0, 0, 0], [0, 0, 0]);
  expect(equal(twist.norm(), 0)).toBe(true);
});

test('pure translation transform to twist', () => {
  let g = identity(4);
  g = setTransformTranslation(g, [1.0, -2.12, 4.73]);

  const twist = Twist.fromTransform(g);
  expect(twist.isPureTranslation).toBe(true);

  const gFromTwist = twist.getTransform();
  // eslint-disable-next-line no-unused-vars
  gFromTwist.forEach((value, indx, matrx) => {
    expect(equal(value, subset(g, index(...indx)))).toBe(true);
  });
});

test('pure rotation transform to twist', () => {
  let g = identity(4);
  const vector = [0, 1, 0];
  const theta = 0.1;
  g = setTransformRotation(g, rotationMatrixFromAxisAngle(vector, theta));

  const twist = Twist.fromTransform(g);
  expect(twist.isPureRotation).toBe(true);

  const gFromTwist = twist.getTransform();
  // eslint-disable-next-line no-unused-vars
  gFromTwist.forEach((value, indx, matrx) => {
    expect(equal(value, subset(g, index(...indx)))).toBe(true);
  });
});

test('arbitrary transform to twist pure rotation', () => {
  let g = identity(4);
  g = setTransformTranslation(g, [0.231, -4.312, 0.063]);
  g = setTransformRotation(g, rotationMatrixFromAxisAngle([2.012, 1.044, -0.569], -0.513));

  const twist = Twist.fromTransform(g);
  const gFromTwist = twist.getTransform();
  // eslint-disable-next-line no-unused-vars
  gFromTwist.forEach((value, indx, matrx) => {
    expect(equal(value, subset(g, index(...indx)))).toBe(true);
  });
});
