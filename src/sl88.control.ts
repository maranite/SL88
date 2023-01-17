loadAPI(17);

load('java.js');
load('utils.js');
load('sl88syx.js');
load('sl88API.js');
load('omnisphere.js');

host.setShouldFailOnDeprecatedUse(true);
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

var trackCursor: API.CursorTrack;
var trackBank: API.TrackBank;
var trackCount: number = 0;
var trackIndex: number = 0;
var sl88trackIndex: number = -1;

var bankLSB: number = 0;
var bankMSB: number = 0;

var sl88Initialized = false;

function trackCursorIndexChanged(value: number) {
  trackIndex = value;
  // if (sl88Initialized)
  //   if (sl88trackIndex != trackIndex) {
  //     println(`Bitwig Track ${trackIndex} ... SL88 ${sl88trackIndex}`);
  //     slapi.loadProgram(trackIndex)
  //   }
}

//TODO: FIgure out how to make track selection and program selection co-exist nicely. Probably needs groups.


/** Called when a short MIDI message is received on MIDI input port 0. */
function onMidi(status: number, data1: number, data2: number) {
  switch (status) {
    // case 0xee: // Pitchbend Stick 1 X
    //   return;
    // case 0xef: // Pitchbend Stick 1 Y
    //   return;

    // Track selection
    case 0xcf: // ProgramChange ch 16: Track Select 
      // sl88trackIndex = data1;
      // if (sl88trackIndex !== trackIndex && sl88trackIndex < trackCount) {
      //   var track = trackBank.getItemAt(sl88trackIndex);
      //   track.selectInEditor();
      //   track.selectInMixer();
      // }
      return;

    // Omnisphere Program selection
    case 0xbe: // CC on ch 15
      switch (data1) {
        case 32: bankLSB = data2; return;
        case 0: bankMSB = data2; return;
      }
      return;

    case 0xce: // ProgramChange ch 15
      var programIndex = (bankMSB * 0x80) + data1;
      if (programIndex >= learned.length)
        return;
      var program = learned[programIndex]
      if (program) {
        // println(`Program selection is for ${program.name}`)
        trackCursor.sendMidi(0xb0 + program.channel, program.cc, 127);
      }
      return;
  }
  // println(`${byte2hex(status)} : ${byte2hex(data1)} : ${byte2hex(data2)}`);

  if ((status & 0x0f) == 0)
    trackCursor.sendMidi(status, data1, data2);
}

function makeListener(name: string) {
  return (data: string) => {
    var r = SL.try_decode(data);
    if (r) {
      if (r instanceof SL.CheckAttached || r instanceof SL.ConfirmAttached)
        return true;

      if (r instanceof SL.Program
        || r instanceof SL.ProgramName)
        return true;

      println(`${name}: ` + r.toString());
      return true;
    }
    return false;
  }
}


var slapi: SL88API;
var slDevice: SL.SLDevice

function init() {
  trackCursor = host.createCursorTrack("SL88_Track", "SL88 Track Selector", 0, 0, true);

  trackBank = host.createTrackBank(32, 0, 0);
  trackBank.itemCount().addValueObserver((value) => (trackCount = value), 0);
  trackCursor.position().addValueObserver(trackCursorIndexChanged, -1);

  var sl88sx = new MidiPair("SL88sx", host.getMidiInPort(1), host.getMidiOutPort(1));
  slDevice = new SL.SLDevice(sl88sx);
  slDevice.onUnhandledSysex = hex => println('sl88 unhandled: ' + hex);
  slDevice.registerListener(makeListener('SL88'));
  slapi = new SL88API(slDevice);
  const port0 = host.getMidiInPort(0);
  port0.createNoteInput('SL88', '80????', '90????', 'A0????', 'D0????', 'E0????');
  port0.setMidiCallback(onMidi);

  // bind stick 1 to user control
  initializeStick1(port0);

  initializeSL88();
}


function initializeStick1(port0: API.MidiIn) {
  var surface = host.createHardwareSurface();
  var stick1X = surface.createHardwareSlider('Stick1X');
  var stick1Y = surface.createHardwareSlider('Stick1Y');
  stick1X.setName('Stick 1 X');
  stick1Y.setName('Stick 1 Y');
  stick1X.setLabel('Stick 1 X');
  stick1Y.setLabel('Stick 1 Y');
  const stick1XMatcher = port0.createAbsolutePitchBendValueMatcher(14);
  const stick1YMatcher = port0.createAbsolutePitchBendValueMatcher(15);
  var ctrls = host.createUserControls(2);
  ctrls.getControl(0).addBinding(stick1X);
  ctrls.getControl(1).addBinding(stick1Y);
}

var learned: MidiLearnPatch[] = [];

async function initializeSL88(trackPrograms = 30) {
  // println("Checking SL88");
  var dump = await slapi.getConfigDump();
  // println("got dump");
  var tracksOK = true;

  for (let i = 0; i < trackPrograms; i++) {
    const expectedName = `Track ${1 + i}`;
    const actualName = dump.names[i];
    tracksOK = tracksOK && (expectedName == actualName);
  }
  if (!tracksOK) {
    println("Initializing 30 x SL88 programs to serve as track selectors");
    await createTrackPrograms(0, 0);
  }

  try {
    loadMidiLearnedPatches();
    const patches = learned; //omni.getTopRatedPatches(250 - trackPrograms);

    for (let i = 0; i < patches.length && i < (250 - trackPrograms); i++) {
      var programNo = trackPrograms + i;
      const actualName = dump.names[programNo].trim();
      const [programName, instrument, sound] = cleanUpPatchName(patches[i].name);

      if (programName !== actualName) {
        println(`Updating program ${programNo} to ${programName} (${instrument} : ${sound})`);

        const prog = SL.Program.newDefault();
        setProgramDefaults(prog);
        prog.name = programName;

        prog.zones[0].instrument = instrument;
        prog.zones[0].sound = sound;
        prog.zones[2].programChange = i % 0x80;
        prog.zones[2].MSB = Math.floor(i / 0x80);

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
  sl88Initialized = true;
}


function loadMidiLearnedPatches(trackPrograms = 30) {
  const omni = new Omnisphere();
  const patches = omni.getTopRatedPatches(250 - trackPrograms);

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

function setProgramDefaults(prog: SL.Program) {
  prog.zones[0].enabled = 'On';
  prog.zones[0].midiChannel = 0;
  prog.zones[0].stick1X = "pitchbend";
  prog.zones[0].stick1Y = "modulation";
  prog.zones[0].pedal1 = 'damperPedal';
  prog.zones[0].pedal3 = 'aftertouch';

  prog.zones[2].instrument = 'Stick 1 X';
  prog.zones[2].sound = 'Pitchbend';
  prog.zones[2].enabled = 'On';
  prog.zones[2].midiChannel = 14;
  prog.zones[2].stick1X = "pitchbend";

  prog.zones[3].instrument = 'Stick 1 Y';
  prog.zones[3].sound = 'Pitchbend';
  prog.zones[3].enabled = 'On';
  prog.zones[3].midiChannel = 15;
  prog.zones[3].stick1Y = "pitchbend";
}

/** Creates track selection programs at a given slot as well as a tracks group*/
async function createTrackPrograms(trackPrograms: number = 30, firstSlot: number = 0, groupSlot: number = 0) {
  const prog = SL.Program.newDefault();
  setProgramDefaults(prog);
  const indices = [];
  for (var i = 0; i < trackPrograms; i++) {
    prog.name = `Track ${1 + i}`;

    prog.zones[0].instrument = `Track ${1 + i}`;
    prog.zones[0].sound = 'Keys (ch1)';
    prog.zones[0].enabled = 'On';

    prog.zones[3].midiChannel = 15;
    prog.zones[3].programChange = i;

    var programNo = firstSlot + i;
    if (i < 30)
      indices.push(programNo);
    // println(`Creating ${prog.name}`);
    await slDevice.sendAsync(new SL.ProgramDump(programNo, prog).toHex());
  }
  await slDevice.sendAsync(new SL.GroupDump(groupSlot, 'TRACKS', indices, true).toHex());
}



function exit() { }

function flush() { }
