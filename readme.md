# StudioLogic SL88 Grand driver for Bitwig

This is a Bitwig Studio 4+ controller extension for the SL88 Grand (and SL88 Studio).
While this is a public repository, the usefulness of this will depend largely on your own set up and tolerance to hack around a little - at present this code base is subject to experimentation.

The goals of this project:
- **Track Selection**:<br>Allow selection of Tracks in Bitwig using the SL88's program select knob.<br><br>
- **Omnisphere Patches**:<br>Allow selection of Omnisphere patches using the SL88 program select knob.<br>Thanks to the hacking done in [omnitools](https://github.com/maranite/omnitools), I've learned how to read the patch ratings in omnisphere, as well as how to read and write the midi learn functionality used to select patches. This makes it possible to determine which Omnisphere patches are top-rated, and pre-load their names into the SL88 so that they can be freely selected later using Midi CC messages. Because the new VST3 spec broke midi program change (read: Steinberg are _still_ shanking developers). many VST3 implementations (including Omnisphere 2.8) don't respect midi program change messages, so this script also provides a translation layer between the SL88 and omnisphere to make sure the magic still happens.<br><br>
- **Make Stick 1 useful**:<br>Enable use the spring-loaded of Stick 1 as a **bi-directional** control.<br>Background: The SL88 only ever reports CC values for this stick as "away from center", meaning there's no differentiation between up & down, or left and right. A solution to this is to set up the Stick 1 X and Y modes to report pitchbend values on different channels, and have this controller script translate those values for Bitwig.

Happily, the hacking done in the [SL-Monitor](https://github.com/maranite/SL-Monitor) resulted in sufficient discovery of how to program the SL88 via sysex. This means that this controller script is able to create SL88 programs on the fly which correctly map the X Y & modes for stick 1, as well as pre-create the programs required to allow track selection and omnisphere preset selection.

A former goal of this project was to allow selection of Bitwig device presets using the SL88 knob, but alas the Bitwig API does not allow scripts to interrogate the available presets without launching a popup browser window - i.e. the process _has_ to be interractive, and the thought of that simply gives me the shits.

# Health & Safety

This _is not_ a production grade extension, and _does_ modify the programs on your SL88. <br><br>

Please use the SL88 Editor to backup your rig before trying out this extension!!!<br><br>

A more general downside of using this script is that it prevents you from using SL Editor while Bitwig is running. This is because it uses all of the midi ports presented by th SL88, which prevents the SL Editor from connecting to the SL88 until Bitwig is closed. If this behavior is unnacceptable for you, please use a generic midi controller extension instead.
