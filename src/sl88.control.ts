loadAPI(17);

load('java.js');
load('utils.js');
load('sl88syx.js');
load('omnisphere.js');

host.setShouldFailOnDeprecatedUse(true);
host.defineMidiPorts(1, 1);
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


// TODO: Experiment with getting Bitwig's presets (and loading them) without a visible popupbrowser

var trackCursor: API.CursorTrack;
var trackBank: API.TrackBank;
var trackCount: number = 0;
var bankLSB: number = 0;
var bankMSB: number = 0;

var ccs = [84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 13, 14];
/** Called when a short MIDI message is received on MIDI input port 0. */
function onMidi(status: number, data1: number, data2: number) {
  switch (status & 0xf0) {
    case 0xb0: // ChannelController
      //println(`CC ${data1} = ${data2}`);
      switch (data1) {
        case 0:
          bankMSB = data2;
          break;
        case 32:
          bankLSB = data2;
          break;
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
          // switch(cc) {
          //   case 94 : cc = 13; break;
          //   case 95 : cc = 14; break;
          // }
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

  var sl88sx = new MidiPair("SL88sx", host.getMidiInPort(1), host.getMidiOutPort(1));
  slDevice = new SL.SLDevice(sl88sx);
  slDevice.registerListener(makeListener('SL88'));
  slDevice.onUnhandledSysex = hex => println('sl88 unhandled: ' + hex);
  slapi = new SL88API(slDevice);

  host.getMidiInPort(0).createNoteInput('SL88', '80????', '90????', 'A0????', 'D0????', 'E0????');
  host.getMidiInPort(0).setMidiCallback(onMidi);
  println("SL88 initialized!!!");
}


function exit() { }

function flush() { }
