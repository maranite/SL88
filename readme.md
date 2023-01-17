# StudioLogic SL88 Grand driver for Bitwig

This is a Bitwig Studio 4+ controller extension for the SL88 Grand (and SL88 Studio).
While this is a public repository, the usefulness of this will depend largely on your own set up and tolerance to hack around a little - at present this code base is subject to experimentation.

The goals of this project:
- **Track Selection**:<br>Allow selection of Tracks in Bitwig using the SL88's program select knob.<br><br>
- **Omnisphere Patches**:<br>Allow selection of Omnisphere patches using the SL88 program select knob.<br><br>
- **Make Stick 1 useful**:<br>Enable use the spring-loaded of Stick 1 as a **bi-directional** control.<br>Background: The SL88 only ever reports CC values for this stick as "away from center", meaning there's no differentiation between up & down, or left and right. A solution to this is to set up the Stick 1 X and Y modes to report pitchbend values on different channels, and have this controller script translate those values for Bitwig.

Happily, the hacking done in the [SL-Monitor](https://github.com/maranite/SL-Monitor) resulted in sufficient discovery of how to program the SL88 via sysex. This means that this controller script is able to create SL88 programs on the fly which correctly map the X Y & modes for stick 1, as well as pre-create the programs required to allow track selection and omnisphere preset selection.

A former goal of this project was to allow selection of Bitwig device presets using the SL88 knob, but alas the Bitwig API does not allow scripts to interrogate the available presets without launching a popup browser window - i.e. the process _has_ to be interractive, and the thought of that simply gives me the shits.