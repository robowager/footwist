import {
  equal, norm, matrix, identity, sin, cos, multiply, add,
  subset, index, deepEqual, acos, asin, trace, cross,
  max, min,
} from 'mathjs';
import {
  Matrix4, Vector3, Quaternion,
  LineCurve3, BufferGeometry, Float32BufferAttribute,
  TubeGeometry, SphereGeometry,
  LineBasicMaterial, MeshBasicMaterial,
  LineSegments, Mesh,
} from 'three';

export function equalTolerance(value, target, tolerance) {
  return Math.abs(value - target) < tolerance;
}

export function deg2rad(angle) {
  return angle * (Math.PI / 180);
}

export function rad2deg(angle) {
  return angle * (180 / Math.PI);
}

export function normalizeVector(vector) {
  const vectorNorm = norm(vector);
  if (equal(vectorNorm, 0)) {
    return vector;
  }
  return vector.map((element) => element / vectorNorm);
}

export function vectorHat(vector) {
  return matrix([
    [0, -vector[2], vector[1]],
    [vector[2], 0, -vector[0]],
    [-vector[1], vector[0], 0],
  ]);
}

/**
* @param {mathjs.Matrix} matrix1
* @param {mathjs.Matrix} matrix2
* @param {number} tolerance
* @returns {bool}
*/
export function equalMatrixTolerance(matrix1, matrix2, tolerance) {
  let result = true;
  // eslint-disable-next-line no-unused-vars
  matrix1.forEach((value, indx, matrx) => {
    if (!(equalTolerance(value, subset(matrix2, index(...indx)), tolerance))) {
      result = false;
    }
  });
  return result;
}

/**
* From MLS Eq (2.14), page 28.
* @param {Array} axis - will be normalized
* @param {Number} angle - in rad
* @param {mathjs.Matrix} 3x3 rotation matrix
*/
export function rotationMatrixFromAxisAngle(axis, angle) {
  if (equal(norm(axis), 0)) {
    throw new Error(`rotation axis: ${axis} has zero norm: ${norm}`);
  }

  if (equal(angle, 0)) {
    // just return identity
    return identity(3);
  }

  // Rodrigues formula
  const axisHat = vectorHat(normalizeVector(axis));
  return add(
    identity(3),
    multiply(matrix(axisHat), sin(angle)),
    multiply(multiply(axisHat, axisHat), 1 - cos(angle)),
  );
}

/**
* From MLS Proposition 2.5, pg 29.
* @param {mathjs.Matrix or Array} R
* @return {Array} length 3 vector, the norm is the angle
*/
export function axisAngleFromRotationMatrix(R) {
  const RMatrix = matrix(R);
  if (deepEqual(RMatrix, identity(3))) {
    return [0, 0, 0];
  }

  const angle = acos((trace(RMatrix) - 1) * 0.5);

  const vector = [
    subset(RMatrix, index(2, 1)) - subset(RMatrix, index(1, 2)),
    subset(RMatrix, index(0, 2)) - subset(RMatrix, index(2, 0)),
    subset(RMatrix, index(1, 0)) - subset(RMatrix, index(0, 1)),
  ];

  // Since norm of return can only be positive, take sign angle into account.
  return vector.map((element) => element * (
    (Math.sign(angle) * angle) / (2 * sin(angle))));
}

/**
* @param {mathjs.Matrix or Array} R - 3x3 rotation matrix
* @param {array} t - length 3 translation
* @return {mathjs.Matrix} 4x4 transformation
*/
export function transformFromRotationTranslation(R, t) {
  let g = identity(4);
  // set rotation
  g = subset(g, index([0, 1, 2], [0, 1, 2]), R);
  // set translation
  // Give subset a copy of the translation, because it reshapes it
  // to have dimensions 3 x 1 instead of 3.
  g = subset(g, index([0, 1, 2], 3), t.slice());
  return g;
}

/**
 * @param {mathjs.Matrix} transform
 * @return {mathjs.Matrix} rotation sub-matrix
 */
export function rotationMatrixFromTransform(transform) {
  return subset(transform, index([0, 1, 2], [0, 1, 2]));
}

/**
* Convenience function
* @param {mathjs.Matrix or Array} transform
* @return {Array} length 3 vector, the norm is the angle
*/
export function axisAngleFromTransform(transform) {
  return axisAngleFromRotationMatrix(
    rotationMatrixFromTransform(transform),
  );
}

/**
 * @param {mathjs.Matrix} transform
 * @return {bool}
 */
export function transformHasIdentityRotation(transform) {
  return deepEqual(identity(3), rotationMatrixFromTransform(transform));
}

/**
 * @param {mathjs.Matrix} transform
 * @return {Array} translation
 */
export function translationFromTransform(transform) {
  return [
    subset(transform, index(0, 3)),
    subset(transform, index(1, 3)),
    subset(transform, index(2, 3)),
  ];
}

/**
* @param {mathjs.Matrix} transform
* @param {Array} t - translation
* @return {mathjs.Matrix} transform with translation set
*/
export function setTransformTranslation(transform, t) {
  return subset(transform, index([0, 1, 2], 3), t);
}

/**
* @param {mathjs.Matrix} transform
* @param {mathjs.Matrix} R - rotation matrix
* @return {mathjs.Matrix} transform with rotation set
*/
export function setTransformRotation(transform, R) {
  return subset(transform, index([0, 1, 2], [0, 1, 2]), R);
}

/**
* @param {Array} vector1
* @param {Array} vector2
* @return {Array} norm is the angle
*/
export function getAxisAngleToRotateVector(vector1, vector2) {
  const vec1 = normalizeVector(vector1);
  const vec2 = normalizeVector(vector2);
  const crossProduct = cross(vec1, vec2);
  if (equal(norm(crossProduct), 0)) {
    return [0, 0, 0];
  }
  const direction = normalizeVector(crossProduct);
  const theta = asin(norm(crossProduct));
  return direction.map((element) => element * theta);
}

/**
* @param {Matrix} transform - mathjs Matrix
* @return {Matrix4} threejs Matrix4
*/
export function mathToThreeTransform(transform) {
  // Elements will be stored in row-major order, which is also what Matrix4.set
  // wants.
  const elements = [];
  // eslint-disable-next-line no-unused-vars
  transform.forEach((value, indx, matrx) => {
    elements.push(value);
  });

  const result = new Matrix4();
  result.set(...elements);

  return result;
}

/**
* The created points are in local frame.
* @param {float} pitch
* @param {float} radius
* @param {float} magnitude
* @param {float} delta - the angle resolution
* @return {Array} array of Vector3
*/
export function getHelixPoints(pitch, radius, magnitude, delta) {
  // First point at magnitude = 0.
  const points = [new Vector3(radius, 0, 0)];
  let currentMagnitude = 0;
  let translation = 0;
  // Half length above 0, half below.
  while (currentMagnitude < magnitude) {
    currentMagnitude += delta;
    translation += pitch * delta;
    points.push(
      new Vector3(radius * cos(currentMagnitude), radius * sin(currentMagnitude), translation),
    );
    points.unshift(
      new Vector3(radius * cos(-currentMagnitude), radius * sin(-currentMagnitude), -translation),
    );
  }

  return points;
}

/**
* From https://www.songho.ca/opengl/gl_quaternion.html
* @param {three.Quaternion} quaternion
* @return {mathjs.Matrix} rotation matrix
*/
export function rotationMatrixFromThreeQuaternion(quaternion) {
  return matrix([
    // row 1
    [1 - 2 * quaternion.y ** 2 - 2 * quaternion.z ** 2,
      2 * quaternion.x * quaternion.y - 2 * quaternion.w * quaternion.z,
      2 * quaternion.x * quaternion.z + 2 * quaternion.w * quaternion.y],
    // row 2
    [2 * quaternion.x * quaternion.y + 2 * quaternion.w * quaternion.z,
      1 - 2 * quaternion.x ** 2 - 2 * quaternion.z ** 2,
      2 * quaternion.y * quaternion.z - 2 * quaternion.w * quaternion.x],
    // row 3
    [2 * quaternion.x * quaternion.z - 2 * quaternion.w * quaternion.y,
      2 * quaternion.y * quaternion.z + 2 * quaternion.w * quaternion.x,
      1 - 2 * quaternion.x ** 2 - 2 * quaternion.y ** 2],
  ]);
}

/**
* TODO: unit tests
* @param {mathjs.Matrix} R - 3x3 rotation matrix
* @return {three.Quaternion} quaternion
*/
export function threeQuaternionFromRotationMatrix(R) {
  const axisAngle = axisAngleFromRotationMatrix(R);
  const angle = norm(axisAngle);
  if (equal(angle, 0)) {
    return new Quaternion(0, 0, 0, 1);
  }

  const axis = axisAngle.map((element) => element / angle);
  return new Quaternion(
    sin(angle / 2) * axis[0],
    sin(angle / 2) * axis[1],
    sin(angle / 2) * axis[2],
    cos(angle / 2),
  );
}

/**
* @param {mathjs.Matrix} transform
* @return {three.Quaternion} quaternion
*/
export function threeQuaternionFromTransform(transform) {
  return threeQuaternionFromRotationMatrix(
    rotationMatrixFromTransform(transform),
  );
}

/*
* @param {three.Vector3} position
* @param {three.Quaternion} quaternion
* @return {mathjs.Matrix} transform matrix
*/
export function transformFromThreePose(position, quaternion) {
  let g = identity(4);
  g = setTransformTranslation(g, [position.x, position.y, position.z]);
  g = setTransformRotation(
    g,
    rotationMatrixFromThreeQuaternion(quaternion),
  );
  return g;
}

/*
* TODO: tests
* @param {three.Object3D} object
* @param {mathjs.Matrix} transform
*/
export function setThreeObjectPoseFromTransform(object, transform) {
  const transformThree = mathToThreeTransform(transform);
  const position = new Vector3();
  position.setFromMatrixPosition(transformThree);
  const quaternion = new Quaternion();
  quaternion.setFromRotationMatrix(transformThree);
  object.position.copy(position);
  object.quaternion.copy(quaternion);
}

/*
* TODO: tests
* @param {three.Object3D} object
* @param {Screw} screw
* @param {float} inputMagnitude
*/
export function setThreeObjectPoseFromScrew(object, screw, inputMagnitude) {
  let magnitude = inputMagnitude;
  if (magnitude === undefined) {
    magnitude = screw.magnitude;
  }

  setThreeObjectPoseFromTransform(
    object,
    screw.getTransformAtMagnitude(magnitude),
  );
}

/*
* @param {three.Object3D} object
* @param {three.Matrix4} transform
*/
export function setThreeObjectPoseFromThreeTransform(object, transform, update = true) {
  object.position.copy(new Vector3().setFromMatrixPosition(transform));
  object.quaternion.copy(new Quaternion().setFromRotationMatrix(transform));
  if (update) {
    object.updateMatrix();
  }
}

/*
* Like AxesHelper, but extends in negative direction as well.
* @param {number} size - length of each drawn axis
* @returns {LineSegments}
*/
export function getGridAxes(size) {
  const vertices = [
    // x
    -size / 2, 0, 0,
    size / 2, 0, 0,
    // y
    0, -size / 2, 0,
    0, size / 2, 0,
    // z
    0, 0, -size / 2,
    0, 0, size / 2,
  ];

  const colors = [
    // x
    1, 0, 0,
    1, 0, 0,
    // y
    0, 1, 0,
    0, 1, 0,
    // z
    0, 0, 1,
    0, 0, 1,
  ];

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const material = new LineBasicMaterial({ vertexColors: true, toneMapped: false });
  return new LineSegments(geometry, material);
}

/*
* Creates xyz axes using TubeGeometry.
*
* @param {number} size - length of each drawn axis
* @param {Boolean} oneSided - if true, draw axis in positive
*     extents only, else size-length axis drawn with equal +ve, -ve
*     extents, defaults to true
* @param {number} lineRadius - tube radius, defaults to 0.01
* @returns {Mesh} parent object with 3 tubes as children
*/
export function myAxesHelper(size, oneSided = true, lineRadius = 0.01) {
  let minExtent;
  let maxExtent;
  if (oneSided) {
    minExtent = 0;
    maxExtent = size;
  } else {
    minExtent = -size / 2;
    maxExtent = size / 2;
  }

  // tiny sphere serves as parent
  const parent = new Mesh(
    new SphereGeometry(lineRadius / 2),
    new MeshBasicMaterial(),
  );

  const dimColors = {
    // red
    x: 0xff0000,
    // blue
    y: 0x008000,
    // green
    z: 0x0000ff,
  };

  ['x', 'y', 'z'].forEach(
    (dim) => {
      const point1 = new Vector3(0, 0, 0);
      point1[dim] = minExtent;
      const point2 = new Vector3(0, 0, 0);
      point2[dim] = maxExtent;
      const geometry = new TubeGeometry(
        new LineCurve3(point1, point2), // curve
        2, // tubularSegments
        lineRadius, // tube radius
        8, // radialSegments,
        false, // tubeClosed, if true then two-sided doesn't work
      );
      parent.add(
        new Mesh(geometry, new MeshBasicMaterial({ color: dimColors[dim] })),
      );
    },
  );

  return parent;
}

/*
* Speed to move refAxes at.
* @param {Screw} screw
* @returns {float}
*/
export function getScrewSpeed(screw) {
  let distance;
  // the nominal speed, which will be tuned
  let speed;

  if (screw.isPureRotation) {
    distance = screw.magnitude;
    speed = deg2rad(30);
  } else {
    // refAxes is always at origin
    distance = screw.getDistanceTravelled([0, 0, 0], screw.magnitude);
    speed = 1.0;
  }

  let time = distance / speed;

  const minTime = 1.0;
  const maxTime = 6.0;
  // clamp time
  time = min(max(minTime, time), maxTime);

  // return speed for magnitude
  return screw.magnitude / time;
}

/*
* Creates `a` element
* @param {HTMLDocument} doc
* @param {String} href
* @param {String} innerHTML - what link is displayed as
* @param {String} target - defaults to '_blank'
* @returns {<a>}
*/
export function createLinkElement(doc, href, innerHTML, target = '_blank') {
  const link = doc.createElement('a');
  link.href = href;
  link.target = target;
  link.innerHTML = innerHTML;
  return link;
}
