import {
  dot, norm, equal, multiply,
} from 'mathjs';
import { normalizeVector } from './util';

export default class Axis {
  /**
   * @param {mathjs.Matrix or Array} point - point through
   *     which axis passes
   * @param {mathjs.Matrix or Array} direction - axis direction,
   *     will be normalized
   */
  constructor(point, direction) {
    this.point = point;
    if (equal(norm(direction), 0)) {
      throw new Error(`Input direction has zero norm: ${direction}`);
    }
    this.direction = normalizeVector(direction);
  }

  /**
   * Distance of a point from axis.
   * @param {Array} point - array of 3 coordinates
   * @return {float}
   */
  distanceToPoint(point) {
    // vector from axis point to point
    const vec = [
      point[0] - this.point[0], point[1] - this.point[1], point[2] - this.point[2],
    ];

    // projection of vector along axis
    const projection = multiply(dot(vec, this.direction), this.direction);

    // the normal component
    const normal = [
      vec[0] - projection[0], vec[1] - projection[1], vec[2] - projection[2],
    ];

    return norm(normal);
  }

  /**
   * Whether the point lies on this axis.
   * @param {array} point - array of 3 coordinates
   * @return {bool} true if point is on axis
   */
  containsPoint(point) {
    return equal(this.distanceToPoint(point), 0);
  }

  /**
   * Whether this axis equals another.
   * @param {Axis} other
   * @return {bool} true if equal
   */
  equalTo(other) {
    // The constructor normalizes, so we are checking values directly.
    const directionEqual = (
      equal(this.direction[0], other.direction[0])
        && equal(this.direction[1], other.direction[1])
        && equal(this.direction[2], other.direction[2])
    );

    if (!directionEqual) {
      return false;
    }

    // The other axis point should lie on this axis.
    return this.containsPoint(other.point);
  }

  /**
   * Get the point on an axis closest to origin.
   * @return {Array} length 3 array
   */
  getClosestPointToOrigin() {
    const lambda = -dot(this.point, this.direction);
    return [
      this.point[0] + lambda * this.direction[0],
      this.point[1] + lambda * this.direction[1],
      this.point[2] + lambda * this.direction[2],
    ];
  }

  /**
   * Returns True if axis passes through origin,
   * convenience method.
   * @return {bool}
   */
  passesThroughOrigin() {
    return equal(this.distanceToPoint([0, 0, 0]), 0);
  }
}
