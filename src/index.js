import {
  Scene, Color, PerspectiveCamera, WebGLRenderer,
  GridHelper, Clock, Vector3, Quaternion,
} from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
import GUI from 'lil-gui';

import Screw from './screw';
import {
  transformFromThreePose, getGridAxes, createLinkElement,
} from './util';
import Application from './application';

const renderer = new WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new Scene();
// white background color
scene.background = new Color(0xffffff);

const camera = new PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
const cameraControls = new TrackballControls(camera, renderer.domElement);
// a heuristic that looked good
const defaultCameraPosition = new Vector3(0, -10 * 0.3, 10 * 0.5);

// Grid size is not adaptive. It is just some large value.
// This is total length, so one sided extent will be half.
const gridSize = 20;
// so that each division is at 1m
const gridDivisions = gridSize;
// black
const gridColorCenterLine = 0x000000;
// grey
const colorGrid = 0x808080;
const gridHelper = new GridHelper(gridSize, gridDivisions, gridColorCenterLine, colorGrid);
scene.add(gridHelper);

const worldAxes = getGridAxes(gridSize);
scene.add(worldAxes);

// The default pose of the reference frame.
const defaultPosition = new Vector3(0, 0, 0);
const defaultQuaternion = new Quaternion();
const defaultScrew = Screw.fromTransform(
  transformFromThreePose(defaultPosition, defaultQuaternion),
);

// clock used in animate()
const clock = new Clock();

// assigned in init()
let gui;
let application;

/**
* Reset camera view to the default.
* Camera controls reset + camera position set is required to consistently
* set view, don't entirely understand how.
*/
function resetCameraView() {
  cameraControls.reset();
  camera.position.copy(defaultCameraPosition);
}

function init() {
  // By default the grid is in the xz plane, rotate so it is in the xy plane.
  gridHelper.quaternion.copy(new Quaternion(0.7071068, 0, 0, 0.7071068));

  resetCameraView();
  cameraControls.update();

  gui = new GUI();
  application = new Application(defaultScrew, scene, resetCameraView, gui);
}

function animate() {
  requestAnimationFrame(animate);
  cameraControls.update();
  application.animate(clock.getElapsedTime());
  renderer.render(scene, camera);
}

function addNotes() {
  const div = document.createElement('div');
  div.classList = ['notes'];
  document.body.appendChild(div);

  // horizontal line between three window and notes
  div.appendChild(document.createElement('hr'));

  const heading = document.createElement('h2');
  heading.innerHTML = 'Notes';
  div.appendChild(heading);

  const list = document.createElement('ul');
  div.appendChild(list);

  let item;
  item = document.createElement('li');
  [
    document.createTextNode('The github repository for this project is  '),
    createLinkElement(
      document,
      'https://github.com/robowager/footwist',
      'here',
    ),
    document.createTextNode('.'),
  ].forEach((child) => item.appendChild(child));
  list.appendChild(item);

  item = document.createElement('li');
  item.appendChild(
    document.createTextNode(
      'Rigid body transforms can be represented as the exponential of twists. For details, see',
    ),
  );

  let sublist = document.createElement('ul');
  let subitem;
  subitem = document.createElement('li');
  [
    document.createTextNode('the Wikipedia page on '),
    createLinkElement(
      document,
      'https://en.wikipedia.org/wiki/Screw_theory',
      'Screw theory',
    ),
    document.createTextNode(','),
  ].forEach((child) => subitem.appendChild(child));
  sublist.appendChild(subitem);

  subitem = document.createElement('li');
  [
    document.createTextNode('or Chapter 2 of the '),
    createLinkElement(
      document,
      'https://www.cds.caltech.edu/~murray/mlswiki/images/0/02/Mls94-complete.pdf',
      'MLS book',
    ),
    document.createTextNode(
      ', which was the reference for mappings implemented here.',
    ),
  ].forEach((child) => subitem.appendChild(child));
  sublist.appendChild(subitem);

  item.appendChild(sublist);
  list.appendChild(item);

  item = document.createElement('li');
  item.appendChild(
    document.createTextNode('Using the gui'),
  );

  sublist = document.createElement('ul');
  subitem = document.createElement('li');
  subitem.appendChild(
    document.createTextNode('Use any representation (transform, twist, screw) to update the pose of the reference axes.'),
  );
  sublist.appendChild(subitem);

  subitem = document.createElement('li');
  [
    document.createTextNode('On move, a screw that realizes the transform is visualized (see  '),
    createLinkElement(
      document,
      'https://en.wikipedia.org/wiki/Chasles%27_theorem_(kinematics)',
      "Chasles' theorem",
    ),
    document.createTextNode('). The reference axes are moved from the origin to the pose along the screw.'),
  ].forEach((child) => subitem.appendChild(child));
  sublist.appendChild(subitem);

  subitem = document.createElement('li');
  [
    document.createTextNode('Only quaternion inputs are currently supported for orientation. For other representations, try a tool such as '),
    createLinkElement(
      document,
      'https://www.andre-gaschler.com/rotationconverter/',
      '3D Rotation Converter',
    ),
    document.createTextNode('.'),
  ].forEach((child) => subitem.appendChild(child));
  sublist.appendChild(subitem);

  subitem = document.createElement('li');
  subitem.appendChild(
    document.createTextNode('The quaternion is treated as identity if w is 1 or -1. The x, y, z components are normalized based on w.'),
  );
  sublist.appendChild(subitem);

  item.appendChild(sublist);
  list.appendChild(item);
}

addNotes();
init();
animate();
