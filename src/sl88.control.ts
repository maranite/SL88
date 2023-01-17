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

async function initializeSL88() {
  // println("Checking SL88");
  var dump = await slapi.getConfigDump();
  // println("got dump");
  var tracksOK = true;
  for (let i = 0; i < 30; i++) {
    const expectedName = `Track ${1 + i}`;
    const actualName = dump.names[i];
    tracksOK = tracksOK && (expectedName == actualName);
  }
  if (!tracksOK) {
    println("Initializing 30 x SL88 programs to serve as track selectors");
    await slapi.createTrackPrograms();
  }

  // do the whole omnisphere thing.  
  // println("SL88 initialized!!!");
  sl88Initialized = true;
}

function trackCursorIndexChanged(value: number) {
  trackIndex = value;
  if (sl88Initialized)
    if (sl88trackIndex != trackIndex) {
      println(`Bitwig Track ${trackIndex} ... SL88 ${sl88trackIndex}`);
      slapi.loadProgram(trackIndex)
    }
}

/** Called when a short MIDI message is received on MIDI input port 0. */
function onMidi(status: number, data1: number, data2: number) {
  switch (status) {
    case 0xee: // Pitchbend Stick 1 X
      return;
    case 0xef: // Pitchbend Stick 1 Y
      return;

    case 0xcf: // ProgramChange ch 16: Track Select 
      sl88trackIndex = data1;
      if (sl88trackIndex !== trackIndex && sl88trackIndex < trackCount) {
        var track = trackBank.getItemAt(sl88trackIndex);
        track.selectInEditor();
        track.selectInMixer();
      }
      return;

    case 0xbe: // ChannelController ch 15
      switch (data1) {
        case 32: bankLSB = data2; return;
        case 0: bankMSB = data2; return;
      }
      return;

    case 0xce: // ProgramChange ch 15: Patch Select
      // use MSB and LSB
      return;
  }
  return;

  switch (status & 0xf0) {
    case 0xb0: // ChannelController
      switch (data1) {
        case 32: bankLSB = data2; break;
        case 0: bankMSB = data2; break;
        default:
          trackCursor.sendMidi(status, data1, data2);
      }
      break;
    case 0xc0: // ProgramChange
      var program = data1;
      switch (bankMSB) {

        case 0x7f: // track select
          if (program < trackCount) {
            var track = trackBank.getItemAt(program);
            track.selectInEditor();
            track.selectInMixer();
          }
          break;

        case 0x7e: // send CC on channel identified by Midi MSB
          // println(`sending CC  ${bankLSB} = ${program}`);
          trackCursor.sendMidi(0xB0 | (status & 0x0f), bankLSB, program);
          break;

        case 0x7d:
          // 96 & 95 don't seem to work
          var ch = 15;
          for (; program >= 32; program -= 32) ch--;
          var cc = 84 + program;

          println(`sending ch ${1 + ch} CC ${1 + cc} = 127 -> 0`);
          var sts = 0xB0 | ch;
          trackCursor.sendMidi(sts, cc, 127);
          // trackCursor.sendMidi(sts, cc, 0);
          break;

        default:
          trackCursor.sendMidi(status, data1, data2);
      }
      break;
  }
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

      //println(`${name}: ` + r.toString());
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
  // trackBank.cursorIndex().addValueObserver(trackCursorIndexChanged, -1);
  trackCursor.position().addValueObserver(trackCursorIndexChanged, -1);

  var sl88sx = new MidiPair("SL88sx", host.getMidiInPort(1), host.getMidiOutPort(1));
  slDevice = new SL.SLDevice(sl88sx);
  slDevice.onUnhandledSysex = hex => println('sl88 unhandled: ' + hex);
  slDevice.registerListener(makeListener('SL88'));
  slapi = new SL88API(slDevice);
  host.getMidiInPort(0).createNoteInput('SL88', '80????', '90????', 'A0????', 'D0????', 'E0????');
  host.getMidiInPort(0).setMidiCallback(onMidi);
  initializeSL88();
}

function exit() { }

function flush() { }
