import {
  equal, multiply, dot, pow, cross, subtract,
  norm, identity, subset, index, abs, max,
} from 'mathjs';
import {
  CatmullRomCurve3, TubeGeometry,
  MeshBasicMaterial, Mesh, Vector3,
} from 'three';

import {
  normalizeVector, setTransformTranslation,
  mathToThreeTransform, getHelixPoints,
} from './util';

import Axis from './axis';
import Twist from './twist';

export default class Screw {
  /**
   * @param {Axis} axis
   * @param {float} pitch
   * @param {float} magnitude
   */
  constructor(axis, pitch, magnitude) {
    this.axis = axis;

    this.pitch = pitch;

    if (magnitude < 0) {
      throw new Error(`Screw magnitude cannot be negative, received: ${magnitude}.`);
    }
    this.magnitude = magnitude;

    // Calculate and store the unit twist corresponding to this screw.
    // From MLS Proposition 2.10, page 48. The proposition is stated for
    // unit-magnitude axis direction, which the Axis class should ensure.
    let linear;
    let angular;
    if (this.pitch === Infinity) {
      // pure translation
      linear = this.axis.direction;
      angular = [0, 0, 0];
    } else {
      angular = this.axis.direction;
      linear = subtract(
        multiply(this.axis.direction, this.pitch),
        cross(this.axis.direction, this.axis.point),
      );
      // convert to array
      linear = linear.map((e) => e);
    }
    this.unitTwist = new Twist(linear, angular);
  }

  get isPureRotation() {
    return equal(this.pitch, 0);
  }

  get isPureTranslation() {
    return this.pitch === Infinity;
  }

  get isPure() {
    return (this.isPureRotation || this.isPureTranslation);
  }

  /**
   * @param {number} magnitude - between [0, this.magnitude]
   * @return {mathjs.Matrix} transform
   */
  getTransformAtMagnitude(magnitude) {
    if (magnitude < 0) {
      throw new Error(`Magnitude cannot be negative, received: ${magnitude}.`);
    }

    if (magnitude > this.magnitude) {
      throw new Error(`Magnitude: {magnitude} cannot be greater than screw magnitude: ${this.magnitude}.`);
    }

    return this.getTwistAtMagnitude(magnitude).getTransform();
  }

  /**
   * Whether this screw equals another.
   * Only checks for values directly, not the effective transform.
   * @param {Screw} other
   * @return {bool} true if equal
   */
  valuesEqualTo(other) {
    return (
      // accounts for same direction but different points
      this.axis.equalTo(other.axis)
        && equal(this.magnitude, other.magnitude)
      // accounts for infinite pitch
        && equal(this.pitch, other.pitch)
    );
  }

  /**
   * Transform representing entire screw motion.
   * @return {mathjs.Matrix} transform
   */
  getTransform() {
    return this.getTransformAtMagnitude(this.magnitude);
  }

  /**
   * Assuming
   * @param {number} velocity - rate of change of magnitude, must be positive
   * @param {number} time - time in the trajectory
   */
  getTransformAtTrajectoryTime(velocity, time) {
    if (velocity <= 0) {
      throw new Error(`Velocity: ${velocity} is not positive.`);
    }

    if (time < 0) {
      throw new Error(`Time: ${time} cannot be negative.`);
    }

    return this.getTransformAtMagnitude(velocity * time);
  }

  /**
   * @param {number} magnitude
   * @return {Twist}
   */
  getTwistAtMagnitude(magnitude) {
    if (magnitude < 0) {
      throw new Error(`Magnitude: ${magnitude} is negative.`);
    }

    // scale by magnitude
    return this.unitTwist.multiply(magnitude);
  }

  /**
   * Get distance travelled by a point at given magnitude.
   * @param {Array} point - 3d coordinates of point that the screw is applied to
   * @param {number} inputMagnitude - if undefined, use screw magnitude
   * @return {Twist}
   */
  getDistanceTravelled(point, inputMagnitude) {
    let magnitude = inputMagnitude;
    if (magnitude === undefined) {
      magnitude = this.magnitude;
    }

    if (magnitude < 0) {
      throw new Error(`Magnitude: ${magnitude} is negative.`);
    }

    if (this.isPureTranslation) {
      return magnitude;
    }

    const radius = this.axis.distanceToPoint(point);
    return (norm([radius, this.pitch]) * this.magnitude);
  }

  /**
   * From MLS Eqs (2.42)-(2.44), page 47-48.
   * @param {Twist} twist
   * @return {Screw}
   */
  static fromTwist(twist) {
    let pitch;
    let point;
    let direction;
    // twist norm is also the screw magnitude, and takes into account pure translation
    const twistNorm = twist.norm();

    if (equal(twistNorm, 0)) {
      // the zero twist, choose some conventional values
      pitch = Infinity;
      point = [0, 0, 0];
      direction = [0, 0, 1];
    } else if (twist.isPureTranslation) {
      pitch = Infinity;
      point = [0, 0, 0];
      // normalize for clarity, even though Axis constructor normalizes
      // direction
      direction = normalizeVector(twist.linear);
    } else {
      pitch = dot(twist.angular, twist.linear) / pow(twistNorm, 2);

      point = cross(twist.angular, twist.linear);
      // convert to regular array
      point = point.map((element) => element / pow(twistNorm, 2));
      // normalize for clarity, even though Axis constructor normalizes
      // direction
      direction = normalizeVector(twist.angular);
    }

    return new Screw(new Axis(point, direction), pitch, twistNorm);
  }

  /**
   * Convenience method
   * @param {mathjs.Matrix} transform
   * @return {Screw}
   */
  static fromTransform(transform) {
    return Screw.fromTwist(Twist.fromTransform(transform));
  }

  /**
   * Returns a straight line along z, use getVizTransform to position it.
   * @return {threejs.Mesh} object that can be added to scene
   */
  getAxisThreeViz() {
    let axisLength;
    if (this.isPureRotation) {
      // TODO: arbitrary length
      axisLength = 10;
    } else if (this.isPureTranslation) {
      // the amount of translation
      axisLength = 2 * this.magnitude;
      // some padding
      axisLength += 0.1 * axisLength;
    } else {
      // the amount of translation
      // abs around pitch since pitch can be negative
      axisLength = 2 * abs(this.pitch) * this.magnitude;
      // some padding
      axisLength += 0.1 * axisLength;
    }

    const points = [
      new Vector3(0, 0, -0.5 * axisLength),
      new Vector3(0, 0, 0.5 * axisLength)];
    // points: Array, closed: Boolean
    const curve = new CatmullRomCurve3(points, true);

    // At least 3 segments. For short axis lengths, the parseInt result can be 0.
    const tubularSegments = max(parseInt(axisLength * 20, 10), 3);
    const tubeRadius = 0.03;
    const tubeRadialSegments = 8;
    const tubeClosed = true;
    const geometry = new TubeGeometry(
      curve,
      tubularSegments,
      tubeRadius,
      tubeRadialSegments,
      tubeClosed,
    );
    // amethyst color
    const material = new MeshBasicMaterial({ color: 0x9063CD });
    const object = new Mesh(geometry, material);
    return object;
  }

  /**
   * Returned object is in local frame, with axis along z.
   * If pure rotation or translation, throws error.
   * @return {threejs.Mesh} object that can be added to scene
   */
  getHelixThreeViz() {
    // refAxes always starts at [0, 0, 0]
    let helixLength = 2 * this.getDistanceTravelled([0, 0, 0], this.magnitude);
    helixLength += 0.1 * helixLength;
    const helixRadius = norm(this.axis.getClosestPointToOrigin());
    const helixDelta = 0.1;

    const points = getHelixPoints(this.pitch, helixRadius, this.magnitude, helixDelta);
    // points: Array, closed: Boolean
    const curve = new CatmullRomCurve3(points, false);

    // TODO: params
    const tubularSegments = max(parseInt(helixLength * 20, 10), 3);
    const tubeRadius = 0.03;
    const tubeRadialSegments = 8;
    const tubeClosed = false;
    const geometry = new TubeGeometry(
      curve,
      tubularSegments,
      tubeRadius,
      tubeRadialSegments,
      tubeClosed,
    );
    // amethyst color
    const material = new MeshBasicMaterial({ color: 0x9063CD });
    const object = new Mesh(geometry, material);
    return object;
  }

  /**
   * Frame to place screw viz at.
   * @return {mathjs.Matrix} transform
   */
  getVizTransform() {
    const translation = this.axis.getClosestPointToOrigin();

    let xUnprojected;
    if (equal(norm(translation), 0)) {
      // zero translation
      // Since the viz ref starts at 0, this means the ref axes will remain on
      // the viz axis. Any x, y will do.
      // First try global x.
      xUnprojected = [1, 0, 0];
      if (equal(abs(dot(xUnprojected, this.axis.direction)), 1)) {
        // If axis direction is along x already, use global y.
        xUnprojected = [0, 1, 0];
      }
    } else {
      // else unprojected x points towards origin
      xUnprojected = translation.map((element) => -element);
    }
    // x axis is perpendicular to z (viz axis)
    const x = normalizeVector(
      subtract(
        xUnprojected,
        multiply(dot(xUnprojected, this.axis.direction), this.axis.direction),
      ),
    );

    const y = cross(this.axis.direction, x);

    let g = identity(4);
    g = setTransformTranslation(g, translation);
    // set axes
    g = subset(g, index([0, 1, 2], 0), x);
    g = subset(g, index([0, 1, 2], 1), y);
    // slice, else mathjs will make direction Array of Array
    g = subset(g, index([0, 1, 2], 2), this.axis.direction.slice());

    return g;
  }

  /**
   * Frame to place screw viz at.
   * @return {threejs.Matrix4} transform
   */
  getVizThreeTransform() {
    return mathToThreeTransform(this.getVizTransform());
  }
}
