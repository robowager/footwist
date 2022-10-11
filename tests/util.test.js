import { Vector3, Quaternion } from 'three';

import {
  equal, norm, transpose, add, matrix, subset, index, sin, cos,
  identity, deepEqual,
} from 'mathjs';

import {
  equalTolerance, normalizeVector, vectorHat, equalMatrixTolerance,
  rotationMatrixFromAxisAngle, axisAngleFromRotationMatrix,
  transformHasIdentityRotation,
  transformFromRotationTranslation, mathToThreeTransform,
  setTransformTranslation, getAxisAngleToRotateVector,
  rotationMatrixFromThreeQuaternion,
} from '../src/util';

test('normalize zero vector', () => {
  expect(equal(norm(normalizeVector([0, 0, 0])), 0)).toBe(true);
});

test('normalize non-unit vector', () => {
  expect(equal(norm(normalizeVector([42, 0.01, 0])), 1.0)).toBe(true);
});

test('hat is skew-symmetric', () => {
  const hat = vectorHat([-1, 2, 3]);
  const skewSum = add(hat, transpose(hat));
  // eslint-disable-next-line no-unused-vars
  skewSum.forEach((value, indx, matrx) => {
    expect(equal(value, 0)).toBe(true);
  });
});

test('equal matrix tolerance pass', () => {
  const matrix1 = matrix([
    [1.1, 0, 0],
    [0, 1, 0],
    [0, 0, 0.9]]);
  const matrix2 = identity(3);
  expect(equalMatrixTolerance(matrix1, matrix2, 0.11)).toBe(true);
});

test('equal matrix tolerance fail', () => {
  const matrix1 = matrix([
    [1.1, 0, 0],
    [0, 1, 0],
    [0, 0, 0.9]]);
  const matrix2 = identity(3);
  expect(equalMatrixTolerance(matrix1, matrix2, 0.09)).toBe(false);
});

test('rotation matrix from z axis rotation', () => {
  const theta = 0.5;
  const R = rotationMatrixFromAxisAngle([0, 0, 1], theta);

  const RExpected = matrix([
    [cos(theta), -sin(theta), 0],
    [sin(theta), cos(theta), 0],
    [0, 0, 1]]);

  // eslint-disable-next-line no-unused-vars
  R.forEach((value, indx, matrx) => {
    expect(equal(value, subset(RExpected, index(...indx)))).toBe(true);
  });
});

test('rotation matrix from arbitrary axis rotation', () => {
  // Arbitrary values from https://www.andre-gaschler.com/rotationconverter/
  const vector = [0.1, -0.4, 2.0];
  const theta = 0.42;
  const R = rotationMatrixFromAxisAngle(vector, theta);

  const RExpected = matrix([
    [0.9132974, -0.4001960, -0.0757041],
    [0.3985286, 0.9164237, -0.0366417],
    [0.0840409, 0.0032945, 0.9964569]]);

  // The asserts fail with a threshold of 1e-8, since values on the converter
  // website are upto seven figits.
  // eslint-disable-next-line no-unused-vars
  R.forEach((value, indx, matrx) => {
    expect(
      equalTolerance(value, subset(RExpected, index(...indx)), 1e-7),
    ).toBe(true);
  });
});

test('axis angle from identity rotation matrix', () => {
  const vector = axisAngleFromRotationMatrix(identity(3));
  expect(equal(norm(vector), 0)).toBe(true);
});

test('axis angle from arbitrary rotation matrix', () => {
  // Arbitrary values from https://www.andre-gaschler.com/rotationconverter/
  const R = matrix([
    [0.9950591, -0.0943532, -0.0309021],
    [0.0940238, 0.9954982, -0.0119477],
    [0.0318903, 0.0089831, 0.9994510],
  ]);

  const vector = axisAngleFromRotationMatrix(R);

  // TODO why did tolerance 1e-7 fail here
  const tolerance = 1e-6;
  const angle = norm(vector);
  expect(equalTolerance(angle, 0.1, tolerance)).toBe(true);

  expect(equalTolerance(vector[0] / angle, 0.1048285, tolerance)).toBe(true);
  expect(equalTolerance(vector[1] / angle, -0.3144855, tolerance)).toBe(true);
  expect(equalTolerance(vector[2] / angle, 0.9434564, tolerance)).toBe(true);
});

test('transform has identity rotation', () => {
  let g = identity(4);
  // set some transation
  g = setTransformTranslation(g, [1, -2, 3]);
  expect(transformHasIdentityRotation(g)).toBe(true);
});

test('get axis angle to rotate vector', () => {
  const vector1 = [0, 0, 1];
  const vector2 = [0, 1, 0];
  const axisAngle = getAxisAngleToRotateVector(vector1, vector2);

  const theta = norm(axisAngle);
  expect(equal(theta, Math.PI * 0.5)).toBe(true);
  const direction = normalizeVector(axisAngle);
  expect(equal(direction[0], -1)).toBe(true);
  expect(equal(direction[1], 0)).toBe(true);
  expect(equal(direction[2], 0)).toBe(true);
});

test('math to three transform', () => {
  // arbitrary rotation
  const vector = [0.3, 0, -0.4];
  const theta = 2.3;
  const R = rotationMatrixFromAxisAngle(vector, theta);
  // arbitrary translation
  const t = [0.1, 0.2, 0.3];
  const g = transformFromRotationTranslation(R, t);

  const gThree = mathToThreeTransform(g);
  const position = new Vector3();
  position.setFromMatrixPosition(gThree);
  const quaternion = new Quaternion();
  quaternion.setFromRotationMatrix(gThree);

  expect(equal(t[0], position.x)).toBe(true);
  expect(equal(t[1], position.y)).toBe(true);
  expect(equal(t[2], position.z)).toBe(true);

  const quaternionExpected = new Quaternion();
  // From https://www.andre-gaschler.com/rotationconverter/
  quaternionExpected.set(0.5476584, 0, -0.7302112, 0.4084874);
  const threshold = 1e-7;
  const valuesEqual = (
    equalTolerance(quaternion.x, quaternionExpected.x, threshold)
      && equalTolerance(quaternion.y, quaternionExpected.y, threshold)
      && equalTolerance(quaternion.z, quaternionExpected.z, threshold)
      && equalTolerance(quaternion.w, quaternionExpected.w, threshold)
  );
  const flippedEqual = (
    equalTolerance(quaternion.x, -quaternionExpected.x, threshold)
      && equalTolerance(quaternion.y, -quaternionExpected.y, threshold)
      && equalTolerance(quaternion.z, -quaternionExpected.z, threshold)
      && equalTolerance(quaternion.w, -quaternionExpected.w, threshold)
  );
  expect(valuesEqual || flippedEqual).toBe(true);
});

test('rotation matrix from identity quaternion', () => {
  expect(
    deepEqual(
      rotationMatrixFromThreeQuaternion(new Quaternion()),
      identity(3),
    ),
  ).toBe(true);
});
