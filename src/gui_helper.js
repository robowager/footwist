import {
  identity, equal, norm, sqrt, max,
} from 'mathjs';
import {
  Quaternion,
} from 'three';
import {
  threeQuaternionFromTransform,
  setTransformTranslation, translationFromTransform,
  setTransformRotation, rotationMatrixFromThreeQuaternion,
} from './util';
import Screw from './screw';
import Twist from './twist';
import Axis from './axis';

// The pose representations in the gui.
const REPRESENTATIONS = ['transform', 'twist', 'screw'];

const DIMS = ['x', 'y', 'z'];
const DIM_INDICES = [0, 1, 2];

// Component maps, defined for each representation, will be used as
// trees. Internal nodes are components, and leaf nodes are indicated with the
// key value `true`.
const TRANSFORM_COMPONENT_MAP = new Map([
  // key, value pair
  ['position', new Map([['x', true], ['y', true], ['z', true]])],
  // key, value pair
  ['quaternion', new Map([['x', true], ['y', true], ['z', true], ['w', true]])],
]);

const TWIST_COMPONENT_MAP = new Map([
  // key, value pair
  ['linear', new Map([['x', true], ['y', true], ['z', true]])],
  // key, value pair
  ['angular', new Map([['x', true], ['y', true], ['z', true]])],
]);

const SCREW_COMPONENT_MAP = new Map([
  // key, value pair
  [
    // key
    'axis',
    // value
    new Map([
      // key, value pair
      ['point', new Map([['x', true], ['y', true], ['z', true]])],
      // key, value pair
      ['direction', new Map([['x', true], ['y', true], ['z', true]])],
    ]),
  ],
  // key, value pair
  ['pitch', true],
  // key, value pair
  ['magnitude', true],
]);

const REPRESENTATION_COMPONENT_MAP = new Map([
  // key, value pair
  ['transform', TRANSFORM_COMPONENT_MAP],
  // key, value pair
  ['twist', TWIST_COMPONENT_MAP],
  // key, value pair
  ['screw', SCREW_COMPONENT_MAP],
]);

/*
* @param {Map} map
* @return {Array} every element is a list of keys to a leaf
*/
export function getLeafNodePaths(map) {
  // paths to all leaf nodes
  const paths = [];

  function isLeaf(subMap, key) {
    // our convention is that leaf values are true
    return (subMap.get(key) === true);
  }

  function visit(subMap, key, path) {
    path.push(key);

    if (isLeaf(subMap, key)) {
      paths.push(path);
      return;
    }

    subMap.get(key).forEach((v, subKey) => {
      visit(subMap.get(key), subKey, path.slice());
    });
  }
  // depth-first traversal
  map.forEach((v, subKey) => {
    visit(map, subKey, []);
  });

  return paths;
}

/*
* @param {Array} tokens
* @return {string} joined string
*/
export function joinTokensCamelCase(...tokens) {
  function upperFirst(token) {
    return token[0].toUpperCase() + token.slice(1);
  }

  return (
    // first element is as-is
    tokens[0]
    // capitalize first letter of remaining
      + tokens.slice(1).map((element) => upperFirst(element)).join('')
  );
}

export const REPRESENTATION_LEAF_PATHS = getLeafNodePaths(
  REPRESENTATION_COMPONENT_MAP,
);

const TRANSFORM_LEAF_PATHS = getLeafNodePaths(
  TRANSFORM_COMPONENT_MAP,
);

const TWIST_LEAF_PATHS = getLeafNodePaths(
  TWIST_COMPONENT_MAP,
);

const SCREW_COMPONENT_LEAVES = getLeafNodePaths(
  SCREW_COMPONENT_MAP,
);

const REPRESENTATION_LEAF_PATHS_MAP = new Map([
  ['transform', TRANSFORM_LEAF_PATHS],
  ['twist', TWIST_LEAF_PATHS],
  ['screw', SCREW_COMPONENT_LEAVES],
]);

export const componentsToField = joinTokensCamelCase;

function componentsToDisplayName(...components) {
  // join with a space
  return components.join(' ');
}

/**
* Clean user input to get a good quaternion.
* Assumes qw \in [-1, 1].
* @param {number} qx
* @param {number} qy
* @param {number} qz
* @param {number} qw
* @return {three.Quaternion} quaternion
*/
export function cleanQuaternion(qx, qy, qz, qw) {
  const inputVectorNorm = norm([qx, qy, qz]);

  // The case of 0 rotation.
  if (equal(qw, 1)
      || equal(qw, -1)
      || equal(inputVectorNorm, 0)
  ) {
    return new Quaternion(0, 0, 0, 1);
  }

  // What vector norm should be.
  const vectorNorm = sqrt(1 - qw ** 2.0);

  // Input is already a quaternion.
  if (equal(inputVectorNorm, vectorNorm)) {
    return new Quaternion(qx, qy, qz, qw);
  }

  // Else scale the vector component.
  const scale = vectorNorm / inputVectorNorm;
  return new Quaternion(qx * scale, qy * scale, qz * scale, qw);
}

export class GuiHelper {
  /**
   * @param {Screw} defaultScrew - used for initial and reset input fields
   * @param {function} inputCallback - function to call when an input field is updated,
   *     arguments: (Screw)
   * @param {function} moveCallback - function to call when move button is pressed
   * @param {function} resetCallback - function to call when reset button is pressed
   * @param {function} resetViewCallback - function to call when reset view button is
   *     pressed
   */
  constructor(defaultScrew, inputCallback, moveCallback, resetCallback, resetViewCallback) {
    this.defaultScrew = defaultScrew;
    this.inputCallback = inputCallback;
    this.moveCallback = moveCallback;
    this.resetCallback = resetCallback;
    this.resetViewCallback = resetViewCallback;

    // add a field for every leaf
    REPRESENTATION_LEAF_PATHS.forEach((elem) => {
      this[componentsToField(...elem)] = undefined;
    });

    // set initial values so they aren't undefined
    this.setAllRepresentationsFromScrew(this.defaultScrew);

    this.addedToGui = false;
    this.representationFolders = undefined;
    // Map from string to lil-gui.Controller,
    // keys are the representation component field names.
    this.controllers = new Map();
    REPRESENTATION_LEAF_PATHS.forEach((elem) => {
      this.controllers.set(componentsToField(...elem), undefined);
    });
  }

  /**
   * @return {Array} length 3 array of positions
   */
  transformPosition() {
    return DIMS.map(
      (dim) => this[componentsToField('transform', 'position', dim)],
    );
  }

  /**
   * This are raw input values, may not be a valid quaternion.
   * @return {Array} quaternion [x, y, z, w]
   */
  transformQuaternion() {
    return ['x', 'y', 'z', 'w'].map(
      (elem) => this[componentsToField('transform', 'quaternion', elem)],
    );
  }

  /**
   * Cleaned up, so will be a valid quaternion.
   * @return {THREE.Quaternion} quaternion
   */
  transformThreeQuaternion() {
    return cleanQuaternion(...this.transformQuaternion());
  }

  /**
   * Set transform fields from screw.
   * @param {Screw} screw
   * @param {float} inputMagnitude - if undefined, use screw magnitude
   */
  setTransformFromScrew(screw, inputMagnitude) {
    let magnitude = inputMagnitude;
    if (magnitude === undefined) {
      magnitude = screw.magnitude;
    }

    const transform = screw.getTransformAtMagnitude(magnitude);
    // Array
    const translation = translationFromTransform(transform);
    // THREE.Quaternion
    const quaternion = threeQuaternionFromTransform(transform);

    DIM_INDICES.forEach(
      (index) => {
        const dim = DIMS[index];
        this[componentsToField('transform', 'position', dim)] = translation[index];
        this[componentsToField('transform', 'quaternion', dim)] = quaternion[dim];
      },
    );

    // DIMS doesn't include quaternion w
    this[componentsToField('transform', 'quaternion', 'w')] = quaternion.w;
  }

  /**
   * Create screw from transform fields.
   * @return {Screw} screw
   */
  transformToScrew() {
    let g = identity(4);
    g = setTransformTranslation(g, this.transformPosition());
    g = setTransformRotation(
      g,
      rotationMatrixFromThreeQuaternion(this.transformThreeQuaternion()),
    );

    return Screw.fromTransform(g);
  }

  /**
   * Set twist fields from screw.
   * @param {Screw} screw
   * @param {float} inputMagnitude - if undefined, use screw magnitude
   */
  setTwistFromScrew(screw, inputMagnitude) {
    let magnitude = inputMagnitude;
    if (magnitude === undefined) {
      magnitude = screw.magnitude;
    }

    const twist = screw.getTwistAtMagnitude(magnitude);
    DIM_INDICES.forEach(
      (index) => {
        const dim = DIMS[index];
        this[componentsToField('twist', 'linear', dim)] = twist.linear[index];
        this[componentsToField('twist', 'angular', dim)] = twist.angular[index];
      },
    );
  }

  /**
   * Create screw from twist fields.
   * @return {Screw} screw
   */
  twistToScrew() {
    return Screw.fromTwist(
      new Twist(
        DIMS.map((dim) => this[componentsToField('twist', 'linear', dim)]),
        DIMS.map((dim) => this[componentsToField('twist', 'angular', dim)]),
      ),
    );
  }

  /**
   * Set screw fields from screw.
   * @param {Screw} screw
   * @param {float} inputMagnitude - if undefined, use screw magnitude
   */
  setScrewFromScrew(screw, inputMagnitude) {
    let magnitude = inputMagnitude;
    if (magnitude === undefined) {
      magnitude = screw.magnitude;
    }

    DIM_INDICES.forEach(
      (index) => {
        const dim = DIMS[index];
        this[componentsToField('screw', 'axis', 'point', dim)] = screw.axis.point[index];
        this[componentsToField('screw', 'axis', 'direction', dim)] = screw.axis.direction[index];
      },
    );

    this[componentsToField('screw', 'pitch')] = screw.pitch;
    this[componentsToField('screw', 'magnitude')] = magnitude;
  }

  /**
   * Create screw from screw fields.
   * @return {Screw} screw
   */
  screwToScrew() {
    return new Screw(
      new Axis(
        DIMS.map((dim) => this[componentsToField('screw', 'axis', 'point', dim)]),
        DIMS.map((dim) => this[componentsToField('screw', 'axis', 'direction', dim)]),
      ),
      this[componentsToField('screw', 'pitch')],
      // magnitude min 0 is also enforced on the gui controller
      max(0.0, this[componentsToField('screw', 'magnitude')]),
    );
  }

  /**
   * Set representation from screw.
   * @param {string} representation
   * @param {Screw} screw
   * @param {float} inputMagnitude - if undefined, use screw magnitude
   */
  setRepresentationFromScrew(representation, screw, inputMagnitude) {
    if (representation === 'transform') {
      this.setTransformFromScrew(screw, inputMagnitude);
    } else if (representation === 'twist') {
      this.setTwistFromScrew(screw, inputMagnitude);
    } else if (representation === 'screw') {
      this.setScrewFromScrew(screw, inputMagnitude);
    } else {
      throw new Error(`Unknown representation: ${representation}`);
    }
  }

  setAllRepresentationsFromScrew(screw, inputMagnitude) {
    REPRESENTATIONS.forEach(
      (repr) => this.setRepresentationFromScrew(repr, screw, inputMagnitude),
    );
  }

  /**
   * Create screw from representation fields.
   * @return {Screw} screw
   */
  representationToScrew(representation) {
    if (representation === 'transform') {
      return this.transformToScrew();
    } if (representation === 'twist') {
      return this.twistToScrew();
    } if (representation === 'screw') {
      return this.screwToScrew();
    }
    throw new Error(`Unknown representation: ${representation}`);
  }

  // TODO: docstring
  move() {
    // disable the gui inputs
    this.enableAllControllers(false);

    if (!(this.moveCallback === undefined)) {
      this.moveCallback();
    }
  }

  // TODO: docstring
  reset() {
    // re-enable the gui fields
    this.enableAllControllers(true);

    // reset gui fields
    this.setAllRepresentationsFromScrew(this.defaultScrew);

    if (!(this.resetCallback === undefined)) {
      this.resetCallback();
    }
  }

  resetView() {
    if (!(this.resetViewCallback === undefined)) {
      this.resetViewCallback();
    }
  }

  /**
   * Given a gui object, add
   * - folders for each representation,
   * - controllers for each component,
   * - move, reset buttons.
   * @param {lil-gui.GUI} gui
   */
  addToGui(gui) {
    if (this.addedToGui) {
      throw new Error('Function addToGui cannot be called more than once.');
    }

    // a folder for each representation
    this.representationFolders = new Map();
    REPRESENTATIONS.forEach(
      (repr) => {
        this.representationFolders.set(repr, gui.addFolder(repr));
      },
    );

    // for each representation
    REPRESENTATIONS.forEach(
      (repr) => {
        const leafPaths = REPRESENTATION_LEAF_PATHS_MAP.get(repr);
        const folder = this.representationFolders.get(repr);

        // use the same change callback for all fields a representation
        const changeCallback = () => {
          // get a screw from the representation
          const screw = this.representationToScrew(repr);
          // apply it to other representations
          REPRESENTATIONS
          // i.e. reprs other than this one
            .filter((r) => !(r === repr))
            .forEach((r) => this.setRepresentationFromScrew(r, screw));
          // if a callback was passed in, call it
          if (!(this.inputCallback === undefined)) {
            this.inputCallback(screw);
          }
        };

        // for each leaf path
        leafPaths.forEach(
          (path) => {
            const pathWithRepr = [repr].concat(path);

            // add the field
            const controller = folder.add(
              // the object containing the field, which is just this
              this,
              // the name of the field in the object
              componentsToField(...pathWithRepr),
            )
            // the name to display, here use leaf path without repr
              .name(componentsToDisplayName(...path))
            // apply the change callback
              .onFinishChange(() => changeCallback())
            // update gui with changes to field values
              .listen();

            // store the controller
            this.controllers.set(
              componentsToField(...pathWithRepr),
              controller,
            );
          },
        );
      },
    );

    // extra handling for some controllers
    // limit quaternion inputs to [-1, 1]
    ['x', 'y', 'z', 'w'].forEach(
      (elem) => {
        this.controllers.get(
          componentsToField('transform', 'quaternion', elem),
        ).min(-1).max(1);
      },
    );
    // screw magnitude is non-negative
    this.controllers.get(
      componentsToField('screw', 'magnitude'),
    ).min(0);
    // close twist and screw groups at start
    ['twist', 'screw'].forEach(
      (repr) => {
        this.representationFolders.get(repr).open(false);
      },
    );

    gui.add(this, 'move');
    gui.add(this, 'reset');
    gui.add(this, 'resetView').name('reset view');

    this.addedToGui = true;
  }

  /**
   * @param {bool} flag - whether to enable
   */
  enableAllControllers(flag) {
    // before adding to gui, there will be no controllers
    if (!this.addedToGui) {
      return;
    }

    this.controllers.forEach(
      // skipping value
      (controller) => controller.enable(flag),
    );
  }
}
