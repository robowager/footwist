/* eslint max-len: 0 */
import {
  zeros, index, subset, multiply as mathjsMultiply, norm, identity,
  subtract, cross, pow, inv, equal, add, Matrix,
} from 'mathjs';

import {
  vectorHat, rotationMatrixFromAxisAngle, axisAngleFromRotationMatrix,
  normalizeVector, translationFromTransform, transformHasIdentityRotation,
  setTransformTranslation, setTransformRotation, rotationMatrixFromTransform,
} from './util';

export default class Twist {
  /**
   * Linear and angular components stored internally as Array objects.
   * @param {mathjs.Matrix or Array} linear
   * @param {mathjs.Matrix or Array} angular
   */
  constructor(linear, angular) {
    if (linear instanceof Array) {
      this.linear = linear;
    } else if (linear instanceof Matrix) {
      // TODO: is there a better way of getting the underlying data?
      // eslint-disable-next-line no-underscore-dangle
      this.linear = linear._data;
    } else {
      throw new Error(`unknown type of linear component: ${linear.constructor}`);
    }

    if (angular instanceof Array) {
      this.angular = angular;
    } else if (angular instanceof Matrix) {
      // TODO: is there a better way of getting the underlying data?
      // eslint-disable-next-line no-underscore-dangle
      this.angular = angular._data;
    } else {
      throw new Error(`unknown type of angular component: ${angular.constructor}`);
    }
  }

  get coordinates() {
    return this.linear.concat(this.angular);
  }

  get isPureTranslation() {
    return equal(norm(this.angular), 0);
  }

  get isPureRotation() {
    return equal(norm(this.linear), 0);
  }

  /**
   * If pure translation, returns norm of linear component,
   * else norm of angular component.
   * @return {Number}
   */
  norm() {
    if (this.isPureTranslation) {
      return norm(this.linear);
    }

    return norm(this.angular);
  }

  /**
   * @return {mathjs.Matrix} 4x4 matrix
   */
  hat() {
    let result = zeros(4);
    // set angular
    result = subset(result, index([0, 1, 2], [0, 1, 2]), vectorHat(this.angular));
    // set linear
    result = subset(result, index([0, 1, 2], 3), this.linear.slice());
    return result;
  }

  /**
   * Returns a new twist.
   * @param {number} multiple
   * @return {Twist}
   */
  multiply(multiple) {
    return new Twist(
      mathjsMultiply(this.linear, multiple),
      mathjsMultiply(this.angular, multiple),
    );
  }

  /**
   * Returns a new unit twist in the same direction as this.
   * @return {Twist}
   */
  unit() {
    // norm takes care of pure translation/ rotation
    return this.multiply(1 / this.norm());
  }

  /**
   * Transform corresponding to this twist
   * From MLS Eq (2.36), page 42.
   * @return {mathjs.Matrix}
   */
  getTransform() {
    // start with identity
    let g = identity(4);

    if (this.isPureTranslation) {
      g = setTransformTranslation(g, this.linear.slice());
      return g;
    }

    // TODO: is it expensive to compute these each time?
    const theta = this.norm();
    const unitTwist = this.unit();

    // set rotation
    const R = rotationMatrixFromAxisAngle(unitTwist.angular, theta);
    g = setTransformRotation(g, R);

    if (this.isPureRotation) {
      // returning early, but it would also be ok to continue with below steps
      return g;
    }

    // translation
    const offsetTranslation = mathjsMultiply(subtract(identity(3), R), cross(unitTwist.angular, unitTwist.linear));
    const pitchTranslation = mathjsMultiply(
      mathjsMultiply(
        // This is equal to w w^t, see MLS Lemma 2.3, page 28.
        add(pow(vectorHat(unitTwist.angular), 2), identity(3)),
        unitTwist.linear,
      ),
      theta,
    );
    const translation = add(offsetTranslation, pitchTranslation);
    g = setTransformTranslation(g, translation);

    return g;
  }

  /**
   * From MLS Proposition 2.9, page 43.
   * @param {mathjs.Matrix} transform
   * @return {Twist}
   */
  static fromTransform(transform) {
    const translation = translationFromTransform(transform);

    if (transformHasIdentityRotation(transform)) {
      return new Twist(translation, [0, 0, 0]);
    }

    const R = rotationMatrixFromTransform(transform);

    // Return is an Array, and angle is its norm.
    const axisWithAngle = axisAngleFromRotationMatrix(R);

    const theta = norm(axisWithAngle);
    const w = normalizeVector(axisWithAngle);

    // Pure rotation, return early.
    if (equal(norm(translation), 0)) {
      return new Twist([0, 0, 0], axisWithAngle);
    }

    const wHat = vectorHat(w);
    const A = add(
      mathjsMultiply(subtract(identity(3), R), wHat),
      mathjsMultiply(
        // This is equal to w w^t, see MLS Lemma 2.3, page 28.
        add(pow(wHat, 2), identity(3)),
        theta,
      ),
    );
    const v = mathjsMultiply(inv(A), translation);

    // The magnitude (theta) is included in the angular component.
    return new Twist(v.map((e) => e * theta), axisWithAngle);
  }
}
