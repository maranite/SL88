loadAPI(17);

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

switch (host.getPlatformType()) {
  case com.bitwig.extension.api.PlatformType.WINDOWS:
    host.addDeviceNameBasedDiscoveryPair(["SL GRAND", "MIDIIN2 (SL GRAND)"], ["SL GRAND", "MIDIOUT2 (SL GRAND)"]);
    break;
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
var learned: MidiLearnPatch[] = [];

var sl88FollowTrackSelection: boolean = false;
var slapi: SL88API;
var slDevice: SL.SLDevice
var stick1X: API.HardwareSlider;
var stick1Y: API.HardwareSlider;
var stick3X: API.HardwareSlider;
var stick3Y: API.HardwareSlider;
var zoneVols: API.AbsoluteHardwareKnob[];
var pedal1: API.HardwareButton;
var pedal2: API.HardwareButton;
var pedal4: API.HardwareSlider;

function trackCursorIndexChanged(value: number) {
  trackIndex = value;
  if (sl88FollowTrackSelection)
    if (sl88trackIndex != trackIndex) {
      println(`Bitwig Track ${trackIndex} ... SL88 ${sl88trackIndex}`);
      slapi.loadProgram(trackIndex)
    }
}

/** Called when a short MIDI message is received on MIDI input port 0. */
function onMidi(status: number, data1: number, data2: number) {
  switch (status) {
    // Track selection
    case 0xcf: // ProgramChange ch 16: Track Select 
      sl88trackIndex = data1;
      sl88FollowTrackSelection = true;
      if (sl88trackIndex !== trackIndex && sl88trackIndex < trackCount) {
        var track = trackBank.getItemAt(sl88trackIndex);
        track.selectInEditor();
        track.selectInMixer();
      }
      return;

    case 0xbe: // Omnisphere Program selection : CC on ch 14
      switch (data1) {
        case 32: bankLSB = data2; return;
        case 0: {
          sl88FollowTrackSelection = false;
          bankMSB = data2;
          var programIndex = (bankMSB * 0x80) + bankLSB;
          if (programIndex >= learned.length)
            return;
          var program = learned[programIndex]
          //println(`Program ${program.name}`);
          if (program) {
            trackCursor.sendMidi(0xb0 + program.channel, program.cc, 127);
            // slDevice.send(new SL.ProgramParam(0x80, 1, [95]).toHex());  // Set volume on zone 1 to 95
          }
          return;
        }
      }
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

type Color = com.bitwig.extension.api.Color;

/** Sets up the SL88's XY sticks so that Bitwig recognizes them */
function initializeControls(port0: API.MidiIn) {

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
  stick3X = createStick('Stick 3 X', 20, 5, 12, 2, true, port0.createAbsoluteCCValueMatcher(0, midiCC.resonance));
  stick3Y = createStick('Stick 3 Y', 25, 0, 2, 12, false, port0.createAbsoluteCCValueMatcher(0, midiCC.frequency));
  surface.setPhysicalSize(150, 114);

  const color = com.bitwig.extension.api.Color;
  zoneVols = [
    color.fromRGB(1, .3, 0),
    color.fromRGB(1, 1, 0),
    color.fromRGB(0, 1, 0),
    color.fromRGB(0, 0, 1)
  ].map((c, i) => {
    const zone = surface.createAbsoluteHardwareKnob(`Zone ${i + 1}`);
    zone.setAdjustValueMatcher(port0.createAbsoluteCCValueMatcher(zoneChannels[i], 7));
    zone.setBounds(49.5 + (i * 16), 20, 16, 16);
    zone.setLabelColor(c);
    return zone;
  })
  // zoneVols[0].addBinding(trackCursor.volume());  
  // zoneVols[1].addBinding(trackCursor.pan());
  zoneVols[0].setName("Red Zone");
  zoneVols[1].setName("Yellow Zone");
  zoneVols[2].setName("Green Zone");
  zoneVols[3].setName("Blue Zone");

  // if a hardware control consumers a CC, then the plugins don't get the midi message
  // pedal1 = surface.createHardwareButton('Pedal 1 (Damper)');
  // pedal1.pressedAction().setActionMatcher(port0.createCCActionMatcher(zoneChannels[0], midiCC.damperPedal, 127))
  // pedal1.releasedAction().setActionMatcher(port0.createCCActionMatcher(zoneChannels[0], midiCC.damperPedal, 0))

  pedal2 = surface.createHardwareButton('Pedal 2 (Data)');
  pedal2.pressedAction().setActionMatcher(port0.createCCActionMatcher(zoneChannels[3], midiCC.dataIncrement, 127))
  pedal2.releasedAction().setActionMatcher(port0.createCCActionMatcher(zoneChannels[3], midiCC.dataIncrement, 0))

  pedal4 = surface.createHardwareSlider('Pedal 4 (breath)');
  pedal4.setAdjustValueMatcher(port0.createAbsoluteCCValueMatcher(zoneChannels[0], midiCC.breath));
}


async function initializeToMode(trackPrograms = 30, omnisphere = false) {
  println("Checking SL88");
  var dump = await slapi.getConfigDump();

  if (trackPrograms > 0) {
    // println("got dump");
    var tracksOK = true;

    for (let i = 0; i < trackPrograms; i++) {
      const expectedName = `Track ${1 + i}`;
      const actualName = dump.names[i];
      tracksOK = tracksOK && (expectedName == actualName);
    }
    if (!tracksOK) {
      println("Initializing 30 x SL88 programs to serve as track selectors");
      await createTrackPrograms();
    }
  }

  if (learned && omnisphere)
    try {
      let omniPrograms = Math.min(250, learned.length) - trackPrograms;
      for (let i = 0; i < learned.length && i < omniPrograms; i++) {
        var programNo = trackPrograms + i;
        const actualName = dump.names[programNo].trim();
        const [programName, instrument, sound] = cleanUpPatchName(learned[i].name);

        if (programName !== actualName) {
          const prog = SL.Program.newDefault();
          prog.name = programName;
          prog.zones[0].instrument = instrument;
          prog.zones[0].sound = sound;
          prog.zones[2].LSB = i % 0x80;
          prog.zones[2].MSB = Math.floor(i / 0x80);
          //println(`Updating program ${programNo} to ${programName} (${instrument} : ${sound})`);
          await slDevice.sendAsync(new SL.ProgramDump(programNo, prog).toHex());
        }
      }
      //TODO - add groups

      // var result = {} as { [path: string]: RatedPatch[] };
      // for (let v of patches) {
      //   var path = v.library.split('/')[0];      
      // }
    }
    catch (e) {
      errorln(`Error occured initializing omnisphere programs ${e}`);
    }
  sl88FollowTrackSelection = (trackCount > 0) && !omnisphere;
}

function loadOmnisphereMidiLearnedPatches() {
  const omni = new Omnisphere();
  const patches = omni.getTopRatedPatches(250);
  learned = patches.map((p, i) => {
    return {
      index: i,
      name: p.name,
      library: p.library,
      channel: 8 + Math.floor(i / 32),
      cc: i % 32
    } as MidiLearnPatch
  });
  omni.setMidiLearnPatches(learned);
}

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

/** Creates track selection programs at a given slot as well as a tracks group*/
async function createTrackPrograms(trackPrograms: number = 30, firstSlot: number = 0, groupSlot: number = 0) {
  const prog = SL.Program.newDefault();
  const indices = [];
  for (var i = 0; i < trackPrograms; i++) {
    prog.name = `Track ${1 + i}`;
    prog.zones[0].instrument = `Track ${1 + i}`;
    prog.zones[0].sound = '';
    prog.zones[3].programChange = i;

    var programNo = firstSlot + i;
    if (i < 30)
      indices.push(programNo);
    println(`Creating Program: ${prog.name}`);
    await slDevice.sendAsync(new SL.ProgramDump(programNo, prog).toHex());
  }
  await slDevice.sendAsync(new SL.GroupDump(groupSlot, 'TRACKS', indices, true).toHex());
}


function init() {
  trackCursor = host.createCursorTrack("SL88_Track", "SL88 Track Selector", 0, 0, true);
  trackBank = host.createTrackBank(32, 0, 0);
  trackBank.itemCount().addValueObserver((value) => (trackCount = value), 0);
  trackCursor.position().addValueObserver(trackCursorIndexChanged, -1);
  trackCursor.volume().markInterested();

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
  initializeControls(port0);
  initAsync();
}

async function initAsync() {
  loadOmnisphereMidiLearnedPatches();
  if (learned.length > 0) {
    println('Omnisphere detected');
    var sl88KnobModes = ['Tracks', 'Omnisphere', 'Tracks & Omnisphere']
    const doc = host.getPreferences();
    var mode = sl88KnobModes[0]
  
    doc.getEnumSetting('Programs / Knob Mode', 'Selection', sl88KnobModes, sl88KnobModes[0])
      .addValueObserver(_mode => { mode = _mode; });

    doc.getSignalSetting('SL88 Patch Programming', 'Actions', 'Reprogram Now')
      .addSignalObserver(() => {
        var useOmni = mode.match(/Omnisphere/) ? true : false;
        initializeToMode(mode.startsWith('Tracks') ? 30 : 0, useOmni);
      }
      );
  }
  else {
    initializeToMode(30);
  }
}

function exit() { }

function flush() {
  if (surface !== undefined) {
    surface.updateHardware();
  }
}
