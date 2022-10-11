import {
  equal,
} from 'mathjs';
import {
  setThreeObjectPoseFromScrew,
  setThreeObjectPoseFromThreeTransform,
  myAxesHelper, getScrewSpeed,
} from './util';
import { GuiHelper } from './gui_helper';

export default class Application {
  /**
   * Class with the main logic of state transitions of the reference frame and
   * axis visualizations.
   *
   * To allow testing application logic in a render-free mode,
   * the following inputs are allowed to be undefined:
   * scene, camera, defaultCameraPosition, gui.
   *
   * @param {Screw} defaultScrew
   * @param {three.Scene} scene
   * @param {three.Camera} camera
   * @param {three.Vector3} defaultCameraPosition - used
   *    to reset camera
   * @param {lil-ui.GUI} gui
   */
  constructor(defaultScrew, scene, camera, defaultCameraPosition, gui) {
    this.defaultScrew = defaultScrew;
    this.scene = scene;
    this.usingScene = !(this.scene === undefined);
    // if scene is undefined, camera and its default position are unused
    this.camera = camera;
    this.defaultCameraPosition = defaultCameraPosition;

    // the displayed axes
    this.refAxes = myAxesHelper(1, true, 0.02);
    if (this.usingScene) {
      this.scene.add(this.refAxes);
    }

    // State variables.
    this.screw = this.defaultScrew;
    // The previous input screw, this is useful to check if move pressed
    // for the same input, and so we don't have to re-add axisViz, helixViz.
    this.prevScrew = defaultScrew;
    // moveRequested: false -> true when move() called, and then
    // set from true -> false once the request is picked up in animate()
    this.moveRequested = false;
    // moveDone: set to false in first animate() call after move(),
    // set to true
    // - in reset(),
    // - after refAxes moved to requested screw.
    this.moveDone = true;
    // set in the first animate() call after move()
    this.moveStartTime = undefined;
    this.axisViz = undefined;
    this.helixViz = undefined;
    // this is set based on input screw
    this.screwSpeed = getScrewSpeed(this.screw);

    // Use arrow functions for callbacks properly binding `this` to the object,
    // https://stackoverflow.com/questions/20279484/how-to-access-the-correct-this-inside-a-callback
    this.guiHelper = new GuiHelper(
      this.defaultScrew,
      (screw) => this.updateScrew(screw),
      () => this.move(),
      () => this.reset(),
    );
    if (!(gui === undefined)) {
      this.guiHelper.addToGui(gui);
    }
  }

  /**
   * Update state based on input screw.
   * This is used as the input callback in the gui.
   * @param {Screw} screw
   */
  updateScrew(screw) {
    this.screw = screw;
    this.screwSpeed = getScrewSpeed(screw);
    setThreeObjectPoseFromScrew(this.refAxes, screw);
  }

  /**
   * Apply state changes on a move button press.
   * This is passed as a callback to the GuiHelper instance.
   */
  move() {
    this.moveRequested = true;
  }

  /**
   * Apply state changes on a reset button press.
   * This is passed as a callback to the GuiHelper instance.
   */
  reset() {
    // reset state variables
    // If this is not done, move -> reset -> move with same inputs will not draw
    // helper viz
    // TODO: test
    this.screw = this.defaultScrew;
    this.prevScrew = this.defaultScrew;
    this.moveRequested = false;
    this.moveDone = true;
    this.moveStartTime = undefined;

    // reset ref axes
    setThreeObjectPoseFromScrew(this.refAxes, this.defaultScrew);

    // reset camera
    // TODO: unable to get camera to exactly line up as during init
    if (!(this.camera === undefined)) {
      this.camera.position.copy(this.defaultCameraPosition);
    }

    this.removeVizFromScene();
  }

  /**
   * Remove helper viz from the scene, and garbage collect them.
   */
  removeVizFromScene() {
    // Check for undefined, since helper viz are undefined on reset.
    if (!(this.axisViz === undefined)
        && this.usingScene
        && this.scene.children.includes(this.axisViz)) {
      this.scene.remove(this.axisViz);
      this.axisViz.geometry.dispose();
      this.axisViz.material.dispose();
    }

    if (!(this.helixViz === undefined)
        && this.usingScene
        && this.scene.children.includes(this.helixViz)) {
      this.scene.remove(this.helixViz);
      this.helixViz.geometry.dispose();
      this.helixViz.material.dispose();
    }

    // reset the viz to undefined
    this.axisViz = undefined;
    this.helixViz = undefined;
  }

  /**
   * Update state based on current state, and clock time.
   * This should be called in the index animate function.
   * @param {number} time
   */
  animate(time) {
    if (this.moveRequested) {
      // reset state so as not to toggle N times
      this.moveRequested = false;
      this.moveDone = false;

      // set the refAxes to default pose
      setThreeObjectPoseFromScrew(this.refAxes, this.defaultScrew);

      const newScrew = !this.prevScrew.valuesEqualTo(this.screw);
      const zeroScrew = equal(this.screw.magnitude, 0);

      if (newScrew && !zeroScrew) {
        // Remove the existing viz. It may have already been removed via a reset.
        this.removeVizFromScene();

        // threejs.Matrix4
        const vizTransform = this.screw.getVizThreeTransform();

        // update axis viz
        this.axisViz = this.screw.getAxisThreeViz();
        setThreeObjectPoseFromThreeTransform(this.axisViz, vizTransform);
        if (this.usingScene) {
          this.scene.add(this.axisViz);
        }
        // add helix viz only if screw axis is offset from origin
        if (!this.screw.axis.passesThroughOrigin()) {
          this.helixViz = this.screw.getHelixThreeViz();
          setThreeObjectPoseFromThreeTransform(this.helixViz, vizTransform);
          if (this.usingScene) {
            this.scene.add(this.helixViz);
          }
        }
      }

      // store screw into prevScrew
      this.prevScrew = this.screw;
      this.moveStartTime = time;
    } else if (!this.moveDone) {
      const elapsed = time - this.moveStartTime;
      const magnitude = this.screwSpeed * elapsed;
      if (magnitude >= this.screw.magnitude) {
        this.moveDone = true;

        // Set the ref axis at the end pose.
        setThreeObjectPoseFromScrew(this.refAxes, this.screw, this.screw.magnitude);

        // re-enable the gui inputs
        this.guiHelper.enableAllControllers(true);
      } else {
        setThreeObjectPoseFromScrew(this.refAxes, this.screw, magnitude);
      }
    }
    // else, move is done, and there is nothing to do
  }
}
