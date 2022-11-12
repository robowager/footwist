import {
  deepEqual,
} from 'mathjs';
import {
  Scene,
} from 'three';
import Application from '../src/application';
import Screw from '../src/screw';
import Axis from '../src/axis';
import {
  transformFromThreePose,
} from '../src/util';

// common to all tests
const defaultScrew = new Screw(new Axis([0, 0, 0], [0, 0, 1]), Infinity, 0);

// simple translation along z
const translationScrew = new Screw(new Axis([0, 0, 0], [0, 0, 1]), Infinity, 1.0);
// simple rotation along z
const rotationScrew = new Screw(new Axis([0, 0, 0], [0, 0, 1]), 0, 1.0);
// rotation + translation
const coilScrew = new Screw(new Axis([0.5, 0.5, 0], [0, 0, 1]), 0.5, 1.0);

test('init with scene', () => {
  const scene = new Scene();
  const application = new Application(defaultScrew, scene);
  // refAxes should be added to scene
  expect(scene.children.includes(application.refAxes)).toBe(true);
});

test('simple move', () => {
  const scene = new Scene();
  const application = new Application(defaultScrew, scene);
  application.updateScrew(translationScrew);

  // request a move
  application.move();
  expect(application.moveRequested).toBe(true);

  // first animate call
  application.animate(0);
  // moveRequested, moveDone should be updated
  expect(application.moveRequested).toBe(false);
  expect(application.moveDone).toBe(false);
  // refAxes is at defaultScrew, from where motion starts
  expect(
    deepEqual(
      transformFromThreePose(application.refAxes.position, application.refAxes.quaternion),
      defaultScrew.getTransform(),
    ),
  ).toBe(true);
  // there should be axis viz, it should be added to scene
  expect(application.axisViz === undefined).toBe(false);
  expect(scene.children.includes(application.axisViz)).toBe(true);

  const moveTime = application.screw.magnitude / application.screwSpeed;

  // animate call sometime in between
  application.animate(moveTime * 0.5);
  // move should not be done
  expect(application.moveDone).toBe(false);

  // animate call beyond the move time
  application.animate(moveTime * 1.1);
  // move should be done
  expect(application.moveDone).toBe(true);
  // refAxes should be at screw pose
  expect(
    deepEqual(
      transformFromThreePose(application.refAxes.position, application.refAxes.quaternion),
      application.screw.getTransform(),
    ),
  ).toBe(true);
});

test('move -> reset', () => {
  // set up and finish move
  const scene = new Scene();
  const application = new Application(defaultScrew, scene);
  application.updateScrew(coilScrew);
  application.move();
  application.animate(0);
  // coilScrew has both axis and helix viz
  const { axisViz } = application;
  const { helixViz } = application;
  expect(scene.children.includes(axisViz)).toBe(true);
  expect(scene.children.includes(helixViz)).toBe(true);
  const moveTime = application.screw.magnitude / application.screwSpeed;
  application.animate(moveTime * 1.1);
  expect(application.moveDone).toBe(true);

  // call reset
  application.reset();
  // refAxes reset to default
  expect(
    deepEqual(
      transformFromThreePose(application.refAxes.position, application.refAxes.quaternion),
      defaultScrew.getTransform(),
    ),
  ).toBe(true);
  // viz are reset
  expect(application.axisViz === undefined).toBe(true);
  expect(application.helixViz === undefined).toBe(true);
  // viz removed from scene
  expect(scene.children.includes(axisViz)).toBe(false);
  expect(scene.children.includes(helixViz)).toBe(false);

  // TODO: this does not test that the viz have been garbage collected
});

test('move ongoing -> reset', () => {
  // set up move ongoing
  const scene = new Scene();
  const application = new Application(defaultScrew, scene);
  application.updateScrew(translationScrew);
  application.move();
  application.animate(0);
  // there will be no helix viz with pure translation screw
  const { axisViz } = application;
  const moveTime = application.screw.magnitude / application.screwSpeed;
  application.animate(moveTime * 0.5);

  // reset called during move
  application.reset();
  // move is done
  expect(application.moveDone).toBe(true);
  // refAxes reset to default
  expect(
    deepEqual(
      transformFromThreePose(application.refAxes.position, application.refAxes.quaternion),
      defaultScrew.getTransform(),
    ),
  ).toBe(true);
  // viz are reset
  expect(application.axisViz === undefined).toBe(true);
  expect(application.helixViz === undefined).toBe(true);
  // axis viz removed from scene
  expect(scene.children.includes(axisViz)).toBe(false);

  // TODO: this does not test that the viz have been garbage collected
});

test('move ongoing -> move', () => {
  // set up ongoing move
  const scene = new Scene();
  const application = new Application(defaultScrew, scene);
  application.updateScrew(coilScrew);
  const moveTime = application.screw.magnitude / application.screwSpeed;
  application.move();
  application.animate(0);
  const { axisViz } = application;
  const { helixViz } = application;
  // with coil screw, both viz should exist
  expect(axisViz === undefined).toBe(false);
  expect(helixViz === undefined).toBe(false);
  application.animate(moveTime * 0.5);

  // move called during move
  application.move();
  expect(application.moveRequested).toBe(true);

  // Assume animate called with some time after the previous animate call,
  application.animate(moveTime * 0.6);
  // this should be like calling animate for the first time after a move,
  expect(application.moveRequested).toBe(false);
  expect(application.moveDone).toBe(false);
  expect(application.moveStartTime).toBe(moveTime * 0.6);
  // refAxes is back to start,
  expect(
    deepEqual(
      transformFromThreePose(application.refAxes.position, application.refAxes.quaternion),
      defaultScrew.getTransform(),
    ),
  ).toBe(true);
  // and since move called with same screw, we should not have created new viz
  // objects.
  expect(axisViz === application.axisViz).toBe(true);
  expect(helixViz === application.helixViz).toBe(true);
  expect(scene.children.includes(axisViz)).toBe(true);
  expect(scene.children.includes(helixViz)).toBe(true);

  // the second time move will still be ongoing
  application.animate(moveTime * 1.1);
  expect(application.moveDone).toBe(false);
});

test('move -> move with same screw', () => {
  // set up and finish a move
  const scene = new Scene();
  const application = new Application(defaultScrew, scene);
  application.updateScrew(coilScrew);
  const moveTime = application.screw.magnitude / application.screwSpeed;
  application.move();
  application.animate(0);
  const { axisViz } = application;
  const { helixViz } = application;
  application.animate(moveTime * 1.1);
  expect(application.moveDone).toBe(true);

  // without updating screw, suppose move is called again
  application.move();
  expect(application.moveRequested).toBe(true);
  application.animate(moveTime * 1.2);
  expect(application.moveDone).toBe(false);
  // The viz objects should be the same, since the screw is the same,
  expect(axisViz === application.axisViz).toBe(true);
  expect(helixViz === application.helixViz).toBe(true);
  // and the scene should still contain them.
  expect(scene.children.includes(axisViz)).toBe(true);
  expect(scene.children.includes(helixViz)).toBe(true);
});

test('move -> reset -> move same screw', () => {
  // set up and finish a move
  const scene = new Scene();
  const application = new Application(defaultScrew, scene);
  application.updateScrew(coilScrew);
  const moveTime = application.screw.magnitude / application.screwSpeed;
  application.move();
  application.animate(0);
  const { axisViz } = application;
  const helixViz = application.axisViz;
  application.animate(moveTime * 1.1);
  expect(application.moveDone).toBe(true);

  // reset, the viz will be removed
  application.reset();
  expect(application.axisViz === undefined).toBe(true);
  expect(application.helixViz === undefined).toBe(true);
  expect(scene.children.includes(axisViz)).toBe(false);
  expect(scene.children.includes(helixViz)).toBe(false);

  // Input same screw. This step is needed, because after a reset the screw is
  // set to defaultScrew.
  application.updateScrew(coilScrew);
  application.move();
  application.animate(moveTime * 1.2);
  // New viz should be added. This indirectly tests that we update the prevScrew
  // properly. Previously there was a bug where we were not adding viz because
  // we though the screw hadn't changed.
  expect(application.axisViz === undefined).toBe(false);
  expect(application.helixViz === undefined).toBe(false);
  expect(application.axisViz === axisViz).toBe(false);
  expect(application.helixViz === helixViz).toBe(false);
  expect(scene.children.includes(application.axisViz)).toBe(true);
  expect(scene.children.includes(application.helixViz)).toBe(true);
});

test('move -> move different screw', () => {
  // set up and finish a move
  const scene = new Scene();
  const application = new Application(defaultScrew, scene);
  application.updateScrew(translationScrew);
  const moveTime = application.screw.magnitude / application.screwSpeed;
  application.move();
  application.animate(0);
  // for translation, axisViz will exist, and helix is undefined
  const { axisViz } = application;
  const { helixViz } = application;
  application.animate(moveTime * 1.1);
  expect(application.moveDone).toBe(true);

  application.updateScrew(coilScrew);
  application.move();
  application.animate(moveTime * 1.2);
  // the viz should be different
  expect(axisViz === application.axisViz).toBe(false);
  expect(helixViz === application.helixViz).toBe(false);
  // the old viz should not be in the scene, only the new ones
  expect(scene.children.includes(axisViz)).toBe(false);
  expect(scene.children.includes(helixViz)).toBe(false);
  expect(scene.children.includes(application.axisViz)).toBe(true);
  expect(scene.children.includes(application.helixViz)).toBe(true);

  // TODO: this does not test that the first move viz have been garbage
  // collected
});

test('helixViz only if screw axis offset from origin', () => {
  const application = new Application(defaultScrew);

  // pure translation screw axis passes through origin
  application.updateScrew(translationScrew);
  application.move();
  application.animate(0);
  expect(application.axisViz === undefined).toBe(false);
  expect(application.helixViz === undefined).toBe(true);

  application.reset();

  // pure rotation screw axis passes through origin
  application.updateScrew(rotationScrew);
  application.move();
  application.animate(0.1);
  expect(application.axisViz === undefined).toBe(false);
  expect(application.helixViz === undefined).toBe(true);

  application.reset();

  // coil screw axis is offset from origin
  application.updateScrew(coilScrew);
  application.move();
  application.animate(0.2);
  expect(application.axisViz === undefined).toBe(false);
  expect(application.helixViz === undefined).toBe(false);
});
