loadAPI(19);

load('java.js');
load('utils.js');
load('sl88syx.js');
load('omnisphere.js');

host.setShouldFailOnDeprecatedUse(false);
host.defineMidiPorts(2, 2);
host.defineController(
  "StudioLogic",
  "SL88",
  "0.4",
  "6f47d215-8945-4361-9403-a87e7ed1b55f",
  "Mark White"
);

/*
Notes to self:

1) It simply isn't possible to load presets in Bitwig without using the dynamic PopupBrowser.   
2) Omnisphere can respond to Bank MSB and LSB messages in both VST3 and Standalone modes :)

To Do:
======

- Add programs to categories.

- Overwrite SL88 display with whatever device had been selected.

- Allow Stick 1 to be used for selecting presets  (up/down)
  * and also track selectio when not browsing
  * with preform/select config button

- Reverse engineer that bullshit pianoteq midi format, then:
  * Create a reader for it
  * Integrate into this script.

*/

switch (host.getPlatformType()) {
  case com.bitwig.extension.api.PlatformType.WINDOWS:
    host.addDeviceNameBasedDiscoveryPair(["SL GRAND", "MIDIIN2 (SL GRAND)"], ["SL GRAND", "MIDIOUT2 (SL GRAND)"]);
    break;
  // TODO: Support our impovrished MAC users too :(
}

const zoneChannels = [0, 13, 14, 15];
var surface: API.HardwareSurface;
var trackCursor: API.CursorTrack;

var slDevice: SL.SLDevice
var stick1X: API.HardwareSlider;
var stick1Y: API.HardwareSlider;
var stick3X: API.HardwareSlider;
var stick3Y: API.HardwareSlider;
var pedalModes: number[] = [
  midiCC.damperPedal,
  midiCC.sostenuto,
  midiCC.hold2,
  midiCC.foot
]

let minProgramNo: number = 0;
let maxProgramNo: number = 128;


function setupPedals(doc: API.Preferences) {
  const slPedal2Modes = {
    'Damper': midiCC.damperPedal,
    'Sostenuto': midiCC.sostenuto,
    'Soft': midiCC.softPedal,
    'Legato': midiCC.legatoFootswitch,
    'Hold 2': midiCC.hold2,
    'Foot': midiCC.foot,
    'Breath': midiCC.breath
  };

  ['1', '2', '3', '4'].forEach(
    (pedal, i) => {
      doc.getEnumSetting(
        `Pedal ${pedal}`,
        'SL88 Pedals',
        Object.keys(slPedal2Modes),
        keyForValue(slPedal2Modes, pedalModes[i])
      ).addValueObserver(
        (key: string) => {
          pedalModes[i] = slPedal2Modes[key as keyof typeof slPedal2Modes];
        }
      )
    }
  )
}

/** Sets up the SL88's XY sticks so that Bitwig recognizes them */
function setupSticks(port0: API.MidiIn) {

  function createStick(name: string, x: number, y: number, w: number, h: number, isHorizontal: boolean, matcher: API.AbsoluteHardwareValueMatcher) {
    var stick = surface.createHardwareSlider(name);
    stick.setLabel(name);
    stick.setName(name);
    stick.setBounds(x, y, w, h);
    stick.setIsHorizontal(isHorizontal);
    stick.setAdjustValueMatcher(matcher);
    return stick;
  }

  surface = host.createHardwareSurface();
  stick1X = createStick('Stick 1 X', 0, 5, 12, 2, true, port0.createAbsolutePitchBendValueMatcher(14));
  stick1Y = createStick('Stick 1 Y', 5, 0, 2, 12, false, port0.createAbsolutePitchBendValueMatcher(15));
  stick3X = createStick('Stick 3 X', 20, 5, 12, 2, true, port0.createAbsoluteCCValueMatcher(0, midiCC.frequency));
  stick3Y = createStick('Stick 3 Y', 25, 0, 2, 12, false, port0.createAbsoluteCCValueMatcher(0, midiCC.resonance));
  surface.setPhysicalSize(150, 114);
}


function init() {

  trackCursor = host.createCursorTrack("SL88_Track", "SL88 Track Selector", 0, 0, true);

  var sl88sx = new MidiPair("SL88sx", host.getMidiInPort(1), host.getMidiOutPort(1));
  slDevice = new SL.SLDevice(sl88sx);
  slDevice.onUnhandledSysex = hex => {
    const r = SL.try_decode(hex);
    if (r) {
      println(r.toString());
    } else {
      println('sl88 unhandled: ' + hex);
    }
  }

  const port0 = host.getMidiInPort(0);
  port0.createNoteInput('SL88', '80????', '90????', 'A?????', 'D0????', 'E0????');
  port0.setMidiCallback((status: number, data1: number, data2: number) => {
    if ((status & 0xF0) == 0xc0)
      trackCursor.sendMidi(status, data1, data2);
  });

  setupSticks(port0);

  const doc = host.getPreferences();
  setupPedals(doc);

  doc.getNumberSetting(
    `Lowest Omnisphere Program`,
    'SL88 Patches',
    0, 249, 1, "Program", 0).addValueObserver(249, c => minProgramNo = c);

  doc.getNumberSetting(
    `Highest Omnisphere Program`,
    'SL88 Patches',
    0, 249, 1, "Program", 128).addValueObserver(249, c => maxProgramNo = c);

  doc.getSignalSetting('Reprogram', 'Actions', 'Reprogram Now').addSignalObserver(() => {
    initializeToMode();
  });
}


async function writeProgram(programNo: number, callback: (program: SL.Program) => void) {
  const prog = SL.Program.newDefault();
  prog.zones.forEach((z, i) => {
    z.midiChannel = zoneChannels[i];
    z.midiPort = 'USB';
    z.enabled = i === 1 ? 'Off' : 'On';
    z.stick1X = i === 2 ? 'pitchbend' : 'Off';
    z.stick1Y = i === 3 ? 'pitchbend' : 'Off';
    z.stick2X = i === 0 ? 'pitchbend' : 'Off';
    z.stick2Y = i === 0 ? 'modulation' : 'Off';
    z.stick3X = i === 0 ? 'resonance' : 'Off';
    z.stick3Y = i === 0 ? 'frequency' : 'Off';
    z.pedal1 = i === 0 ? keyForValue(SL.PedalAssign, pedalModes[0]) : 'Off';
    z.pedal2 = i === 0 ? keyForValue(SL.PedalAssign, pedalModes[1]) : 'Off';
    z.pedal3 = i === 0 ? keyForValue(SL.PedalAssign, pedalModes[2]) : 'Off';
    z.pedal4 = i === 0 ? keyForValue(SL.PedalAssign, pedalModes[3]) : 'Off';
    z.instrument = '';
    z.sound = '';
    z.volume = 'Off';
    z.lowKey = 21; //A0
    z.highKey = i === 0 ? 108 : 21; //C8
    z.lowVel = 0;
    z.highVel = i === 0 ? 127 : 0;
    z.programChange = 'Off';
    z.LSB = 'Off';
    z.MSB = 'Off';
  })
  callback && callback(prog);
  await slDevice.sendAsync(new SL.ProgramDump(programNo, prog).toHex());
};


// This function needs an overhaul so that it programs foot pedals correctly
async function initializeToMode() {

  host.showPopupNotification("Loading Omnisphere Patches");
  println("Loading Omnisphere Patches");

  const omni = new Omnisphere();
  const maxOmniPatchCount = maxProgramNo - minProgramNo;
  if (maxOmniPatchCount > 0) {
    const patches = omni.getTopRatedPatches(maxOmniPatchCount);

    var groups: { [key: string]: number[]; } = {};

    // we probably want to switch to Program Change + channel here.
    var learned = patches.map((p, programNo) => {
      const lib = (p.library ?? 'Unknown').replace(/ Library/gi, '');
      groups[lib] = groups[lib] || [];
      groups[lib].push(programNo);
      return {
        index: programNo,
        name: p.name,
        library: lib,
        channel: zoneChannels[programNo < 0x80 ? 2 : 3],
        kind: 192,
        id: programNo
      } as MidiLearnPatch;
    });

    omni.setMidiLearnPatches(learned);

    for (let i = 0; i < learned.length; i++) {
      try {
        host.showPopupNotification(`Storing ${i} ${learned[i].name} in ${learned[i].library}`);
        const [programName, instrument, sound] = cleanUpPatchName(learned[i].name);

        await writeProgram(i, (prog) => {
          prog.name = programName;
          prog.zones[0].instrument = instrument;
          prog.zones[0].sound = sound;
          prog.zones[i < 0x80 ? 2 : 3].programChange = i % 0x80;
        });
      }
      catch (e) {
        errorln(`Error occured initializing omnisphere programs ${e}`);
      }
    }

    let groupNo = 0;
    for (let groupName in groups) {
      host.showPopupNotification(`Writing Group ${groupName}`);
      const grp = new SL.GroupDump(groupNo++, groupName, groups[groupName], true).toHex();
      await slDevice.sendAsync(grp);
    }
  }
}


// This function probably belongs elsewhere?
function cleanUpPatchName(name: string, maxNameLen = 13) {
  var sound = ""
  var instrument = "";
  var programName = name
    .replace(/(PRS | - Full Range|TR-|- p)/ig, '')
    .replace(/\s{2,}/g, ' ')
    .replace('&apos;', "'")
    .replace(/ and /gi, '&')
    .replace(/\+/gi, '&')
    .replace(/ \^/gi, '')
    .replace(/Guitar/gi, 'Gtr')
    .replace(/Piano/gi, 'Pno')
    .replace(/String/gi, 'Str')
    .replace(/LA Custom/gi, 'LA')
    .replace(/Trilian(.+)-/gi, 'Trl')
    .trim();

  var parts = programName.split(' - ');
  if (parts.length > 1) sound = parts.shift()!;
  programName = parts.join(" ");

  while (programName.length > maxNameLen) {
    var s = programName.split(' ');
    if (s.length < 2)
      programName = programName.substring(0, maxNameLen - 1);
    else {
      instrument = `${s.pop()} ${instrument}`;
      programName = s.join(' ');
    }
  }
  return [programName, instrument, sound];
}

function exit() { }

function flush() {
  if (surface !== undefined) {
    surface.updateHardware();
  }
}