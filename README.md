### footwist

[footwist](https://robowager.github.io/footwist/) is a tool to visualize 3D transforms, twists, and screws. Rigid body transforms can be represented as the exponential of twists. For details, see
- the Wikipedia page on [Screw theory](https://en.wikipedia.org/wiki/Screw_theory),
- or Chapter 2 of the [MLS book](https://www.cds.caltech.edu/~murray/mlswiki/images/0/02/Mls94-complete.pdf), which was the reference for the mappings implemented here.

Only quaternion inputs are currently supported for orientation. For other representations, try a tool such as [3D Rotation Converter](https://www.andre-gaschler.com/rotationconverter/).

The libraries used are
- [mathjs](https://mathjs.org/): for mappings between transform matrices, twists, and screws,
- [three](https://threejs.org/): for visualization,
- [lil-gui](https://lil-gui.georgealways.com/): for the GUI.