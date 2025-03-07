loadAPI(19);

load('java.js');
load('utils.js');
load('sl88syx.js');
load('sl88API.js');
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
- Assign pedals (easy)
  ... Then pref make assignable (options)

  -------- Use Bank MSB on first 128 programs for Omnisphere, LSB on next 128.
  Can't do this - Omnispere doesn't respond to Program change messages in VST3 mode, and cannot be programmed to react to specific CC values :)

- Add programs to categories.

- Overwrite SL88 display with whatever device had been selected.

- Allow Stick 1 to be used for selecting presets  (up/down)
  * and also track selectio when not browsing
  * with preform/select config button

- Reverse engineer that bullshit pianoteq midi format, then:
  * Create a reader for it
  * Integrate into this script.

- Program track selection into last 24 program slots

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
var trackBank: API.TrackBank;
var trackCount: number = 0;
var trackIndex: number = 0;
var sl88trackIndex: number = -1;

var bankLSB: number = 0;
var bankMSB: number = 0;

var slapi: SL88API;
var slDevice: SL.SLDevice
var stick1X: API.HardwareSlider;
var stick1Y: API.HardwareSlider;
var stick3X: API.HardwareSlider;
var stick3Y: API.HardwareSlider;
var pedalModes: number[] = [
  midiCC.damperPedal,
  midiCC.sostenuto,
  midiCC.softPedal,
  midiCC.foot
]

function programChangeToProgramNo(programNo: number, bankLSB: number = 0, bankMSB: number = 0) {
  return programNo + (bankLSB * 0x80) + (bankMSB * 0x80 * 0x80);
}

function programNoToProgramChange(programNo: number) {
  return {
    programChange: programNo % 0x80,
    bankLSB: (programNo / 0x80) % 0x80,
    bankMSB: ((programNo / 0x80) / 0x80) % 0x80,
  }
}

function programNoToCcChanel(programNo: number) {
  return {
    channel: 8 + Math.floor(programNo / 32),
    cc: programNo % 32
  };
}

function ccChanelToProgramNo(cc: number, channel: number) {
  const i = (channel - 8) * 32 + cc;
  return {
    programNo: i % 0x80,
    bankMSB: Math.floor(i / 0x80)
  };
};


/** Called when a short MIDI message is received on MIDI input port 0. */
function onMidi(status: number, data1: number, data2: number) {
  switch (status) {
    // Track selection
    case 0xcf: // ProgramChange on ch 16: Track Select 
      if (trackIndex !== data1) {
        sl88trackIndex = data1;
        if (sl88trackIndex !== trackIndex && sl88trackIndex < trackCount) {
          var track = trackBank.getItemAt(sl88trackIndex);
          track.selectInEditor();
          track.selectInMixer();
        }
      }
      return;

    case 0xbe: // Omnisphere Bank Select on ch 14
      switch (data1) {
        case 32: bankLSB = data2; return;
        case 0: bankMSB = data2; return;
      }
      return;

    case 0xce: // Omnisphere Program Change on ch 14
      sl88trackIndex - 1;
      var programNo = programChangeToProgramNo(data2, bankLSB, bankMSB);
      const { cc, channel } = programNoToCcChanel(programNo);
      trackCursor.sendMidi(0xb0 + channel, cc, 127);

      // slDevice.send(new SL.ProgramParam(0x80, 1, [95]).toHex());  // Set volume on zone 1 to 95
      return;
  }

  // Object.entries(midiCC).forEach(([k, v]) => {
  //   if (v === data1)
  //     println(`>>>  ${k} : ${byte2hex(data2)}`);
  // });

  // if ((status & 0xf0) === 0xb0)
  if ((status & 0x0f) === 0)
    trackCursor.sendMidi(status, data1, data2);
}


function setupPedals(doc: API.Preferences) {
  const slPedal2Modes = {
    'Damper': midiCC.damperPedal,
    'Sostenuto': midiCC.sostenuto,
    'Soft': midiCC.softPedal,
    'Legato': midiCC.legatoFootswitch,
    'Foot': midiCC.foot,
    'Breath': midiCC.breath
  };

  ['1', '2', '3', '4'].forEach(
    (pedal, i) => {
      doc.getEnumSetting(
        'SL88 Patch Programming',
        `Pedal ${pedal}`,
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

  function trackCursorIndexChanged(value: number) {
    trackIndex = value;
    if (sl88trackIndex !== -1 && sl88trackIndex !== trackIndex) {
      slapi.loadProgram(trackIndex);
    }
  }

  trackBank = host.createTrackBank(32, 0, 0);
  trackBank.itemCount().addValueObserver((value) => (trackCount = value), 0);

  trackCursor = host.createCursorTrack("SL88_Track", "SL88 Track Selector", 0, 0, true);
  trackCursor.volume().markInterested();
  trackCursor.position().addValueObserver(trackCursorIndexChanged, -1);

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

  slapi = new SL88API(slDevice);
  const port0 = host.getMidiInPort(0);
  port0.createNoteInput('SL88', '80????', '90????', 'A?????', 'D0????', 'E0????');
  port0.setMidiCallback(onMidi);

  const doc = host.getPreferences();
  // consolidate / refactor this bit:
  setupSticks(port0);
  setupPedals(doc);

  doc.getSignalSetting('Reprogram', 'Actions', 'Reprogram Now').addSignalObserver(() => {
    initializeToMode();
  });
}

async function writeProgram(programNo: number, callback: (program: SL.Program) => void) {
  const prog = SL.Program.newDefault();
  prog.zones.forEach((z, i) => {
    z.midiChannel = zoneChannels[i];
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
    z.volume = 64;
    // z.lowKey = 0;
    // z.highKey = 0;
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
async function initializeToMode(trackPrograms = 32) {

  println("Checking SL88");
  var dump = await slapi.getConfigDump();

  var tracksOK = true;
  var indices = [] as number[];
  for (let i = 0; i < trackPrograms; i++) {
    const expectedName = `Track ${1 + i}`;
    const actualName = dump.names[i];
    const programNo = 250 - trackPrograms + i;
    if (expectedName !== actualName) {
      tracksOK = false;
      await writeProgram(programNo, (prog) => {
        prog.name = `Track ${1 + i}`;
        prog.zones[3].programChange = i;
      });
    }
    indices.push(programNo);
  }
  if (!tracksOK)
    await slDevice.sendAsync(new SL.GroupDump(11, 'Track Sel', indices, true).toHex());

  println("Loading Omnisphere Patches");

  const omni = new Omnisphere();
  const patches = omni.getTopRatedPatches(250 - trackPrograms);

  var groups: { [key: string]: number[]; } = {};

  var learned = patches.map((p, programNo) => {
    groups[p.library] = groups[p.library] || [];
    groups[p.library].push(programNo);
    
    const { cc, channel } = programNoToCcChanel(programNo);
    return {
      index: programNo,
      name: p.name,
      library: p.library,
      // ideally we want category here too!
      channel: channel,
      cc: cc
    } as MidiLearnPatch;
  });

  omni.setMidiLearnPatches(learned);

  for (let i = 0; i < learned.length; i++) {
    try {
      const [programName, instrument, sound] = cleanUpPatchName(learned[i].name);
      const { programChange, bankLSB, bankMSB } = programNoToProgramChange(i);
      await writeProgram(i, (prog) => {
        prog.name = programName;
        prog.zones[0].instrument = instrument;
        prog.zones[0].sound = sound;
        prog.zones[2].programChange = programChange;
        prog.zones[2].LSB = bankLSB ? bankLSB : 'Off';
        prog.zones[2].MSB = bankMSB ? bankMSB : 'Off';
      });
    }
    catch (e) {
      errorln(`Error occured initializing omnisphere programs ${e}`);
    }
  }

  
  for(let groupName in groups) {
    await slDevice.sendAsync(new SL.GroupDump(0, groupName, groups[groupName], true).toHex());
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
    .replace(/Guitar/gi, 'Gtr')
    .replace(/Piano/gi, 'Pno')
    .replace(/String/gi, 'Str')
    .replace(/LA Custom /gi, '')
    .replace(/ \^/gi, '')
    //.replace(/Acoustic/gi, 'Acc')
    .replace(/Trilian(.+)-/gi, 'Trln')
    .trim();

  var parts = programName.split(' - ');
  if (parts.length > 1) sound = parts.shift()!;
  programName = parts.join(" ");

  var rx = /^(.+)[ -]+(\w+)$/;
  var m = programName.match(rx);
  while (m && programName.length > maxNameLen) {
    programName = m[1].trim();
    instrument = `${m[2]} ${instrument}`.trim();
    m = programName.match(rx);
  }
  m = instrument.match(rx);
  while (m && instrument.length > 11) {
    instrument = m[1].trim();
    sound = `${m[2]} ${sound}`.trim();
    m = instrument.match(rx);
  }
  if (programName.length > maxNameLen)
    programName = programName.replace(/\s+/g, '').substring(0, maxNameLen - 1);
  return [programName, instrument, sound];
}


function exit() { }

function flush() {
  if (surface !== undefined) {
    surface.updateHardware();
  }
}
