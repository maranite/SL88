
///--------------

function hex2byte(hex: string): number {
  return parseInt(hex.substring(0, 2), 16);
}

function byte2hex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function hex2word(hex: string): number {
  return (parseInt(hex.substring(2, 4), 16) << 7) + parseInt(hex.substring(0, 2), 16);
}

function word2hex(value: number): string {
  return byte2hex(value & 0x7F) + byte2hex((value >> 7) & 0x7F);
}

function ascii2hex(ascii: string, maxlen?: number) {
  maxlen = maxlen || ascii.length;
  var str = "";
  for (let i = 0; i < maxlen; i++)
    str += (i < ascii.length && i < maxlen - 1) ? byte2hex(ascii.charCodeAt(i)) : "00";
  return str;
}

function hex2ascii(hex: string) {
  var str = '';
  for (var i = 0; (i < hex.length && hex.substring(i, i + 2) !== '00'); i += 2)
    str += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
  return str.trim();
}

function unicode2hex(uni: string, maxlen?: number) {
  maxlen = maxlen || uni.length;
  var hex = "";
  for (let i = 0; i < maxlen; i++)
    hex += (i < uni.length && i < maxlen - 1) ? word2hex(uni.charCodeAt(i)) : "0000";
  return hex;
}

function hex2unicode(hex: string) {
  var str = '';
  for (var i = 0; i < hex.length; i += 4) {
    const val = hex2word(hex.substring(i, i + 4));
    if (val == 0)
      break;
    str += String.fromCharCode(val);
  }
  return str.trim();
}

function array2hex(values: number[], forceLen?: number) {
  var result = values.map(word2hex).join("");
  if (forceLen && values.length < forceLen)
    result.padEnd(forceLen - values.length, "0000");
  return result;
}

function hex2array(hex: string): number[] {
  return hex.match(/([0-9a-fA-F]{4})/g)?.map(hex2word) || [];
}

function string2unicodes(str: string, maxlen?: number): number[] {
  maxlen = maxlen || str.length;
  var r: number[] = Array(maxlen);
  for (let i = 0; i < maxlen; i++)
    r[i] = (i < str.length && i < maxlen - 1) ? str.charCodeAt(i) : 0;
  return r;
}

function unicodes2string(charCodes: number[]) {
  var result = "";
  for (let charCode of charCodes) {
    if (charCode == 0) break;
    result += String.fromCharCode(charCode);
  }
  return result.trim();
}

const toTitleCase = (str: string) => {
  return str.toLowerCase().split(' ').map(function (word) {
    return word.replace(word[0], word[0].toUpperCase());
  }).join(' ');
}

///---------------------------------------
/** A callback which removes an element from an array */
type Remover = () => boolean;

interface Array<T> {
  /** Returns a callback which removes element from the array */
  getRemover(element: T): Remover;
  pushWithRemover(element: T): Remover
  unshiftWithRemover(element: T): Remover
}

Array.prototype.getRemover = function (this: Array<any>, element: any) {
  return () => {
    var index = this.indexOf(element);
    if (index > -1)
      this.splice(index, 1);
    return (index > -1);
  };
}

Array.prototype.pushWithRemover = function (this: Array<any>, element: any) {
  this.push(element);
  return this.getRemover(element);
}

Array.prototype.unshiftWithRemover = function (this: Array<any>, element: any) {
  this.unshift(element);
  return this.getRemover(element);
}


///---------------------------------------

/** A callback which processes a sysex message. Returns true if the message was handled by the callback, else false. */
type SysexListener = (hex: string) => boolean;


abstract class SysexBase {

  /** Called when any qualifying systex message is received */
  onAllSysex(hex: string) { }

  /** Called when a received message was not handled by any registered listener */
  onUnhandledSysex(hex: string) { } //println("Unhandled sysex: " + hex); }

  /** Provides handling of qualified sysex messages */
  processSysex(hex: string) {
    this.mostRecentlyReceived = hex;
    try {
      this.onAllSysex(hex);
      for (let listener of this.sysexListeners) {
        if (listener(hex))
          return true;
      }
      this.onUnhandledSysex(hex);
    } catch (error) {
      errorln(String(error));
    }
    return false;
  }

  /**
   * A chain of callbacks which listen for Sysex messages.
   * The first listener to return True is regarded as having consumed the message, and subsequent listeners are not called.
  */
  sysexListeners: ((hexString: string) => boolean)[] = [];

  /** The last sysex message to have been received */
  mostRecentlyReceived: string = "";

  /**
   * Registers a listener at the start of the listened chain.
   * @param listener a SysexListener which should return true if it handles the message.
   * @returns a function which, when called, removed the listener.
  */
  registerListener(listener: SysexListener): Remover {
    return this.sysexListeners.unshiftWithRemover(listener);
  }

  /** Sends a sysex message immediately. */
  abstract send(hex: string): void;

  /** Sends a sysex message and waits a while for the device to process it. */
  async sendAsync(hex: string) {
    return new Promise<void>((resolve, reject) => {
      this.send(hex);
      //println(hex);
      host.scheduleTask(resolve, 100);
    })
  }

  /**
   * Sends a sysex message and waits for a response.
   * @param hex string of hex data to send
   * @param expect optional regular expression denoting what response to expect.
   * @returns a promise which resolves to the regex match result.
   */
  async awaitReply<T>(decode: (hex: string) => T) {
    return new Promise<T>((resolve, reject) => {
      const fulfill = this.registerListener((data: string) => {
        var result = decode(data);
        if (result)
          if (fulfill()) {
            resolve(result);
            return true;
          }
        return false;
      });
      host.scheduleTask(() => {
        if (fulfill()) {
          reject("Timed out");
          println("Timed out");
        }
      }, 500);
    })
  }

  async requestObjectAsync<T>(hex: string, decode: (hex: string) => T) {
    this.send(hex);
    return this.awaitReply(decode);
  }

  async echoMostRecentReceived<T>(decode: (hex: string) => T) {
    return this.requestObjectAsync(this.mostRecentlyReceived, decode);
  }
}


/**
 * Pairs Midi In and Out ports to enable promise based communication with a Midi device/
 */
class MidiPair extends SysexBase {

  constructor(public name: string, public midiIn: API.MidiIn, public midiOut: API.MidiOut) {
    super();
    midiIn.setSysexCallback(hex => this.processSysex(hex));
  }

  /** Sends a sysex message immediately. */
  send(hex: string) {
    this.midiOut.sendSysex(hex);
  }
}


/** A shim which interprets sysex messages which are specific to a device - typically having a fixed preamble */
class DeviceSysex extends SysexBase {

  public prefix: string;
  public suffix: string;

  constructor(public midi: MidiPair, prefix: string = '', suffix: string = '') {
    super();
    this.prefix = 'f0' + prefix;
    this.suffix = suffix + 'f7';
    var deviceMatch = new RegExp(this.prefix + "([0-9a-f]+)" + this.suffix, "i");
    midi.registerListener(hex => {
      const matched = hex.match(deviceMatch);
      if (matched && matched.length == 2)
        return this.processSysex(matched[1]);
      return false;
    });
  }

  send(hex: string): void {
    // println('sending ' + hex);
    this.midi.send(this.prefix + hex + this.suffix);
  }
}

//----------------------------------------------

/** Provides a map of standard Midi CC controls */
const midiCC = {
  /** Allows user to switch bank for program selection. Program change used with Bank Select. MIDI can access 16,384 programes per MIDI channel. */
  bankSelect: 0,
  /** Generally this CC controls a vibrato effect (pitch, loudness, brighness). What is modulated is based on the program. */
  modulation: 1,
  /** Oftentimes associated with aftertouch messages. It was originally intended for use with a breath MIDI  in which blowing harder produced higher MIDI control values. It can be used for modulation as well. */
  breath: 2,
  /** */
  cc03: 3,
  /** Often used with aftertouch messages. It can send a continuous stream of values based on how the pedal is used. */
  foot: 4,
  /** Controls portamento rate to slide between 2 notes played subsequently. */
  portamentoTime: 5,
  /** Controls Value for NRPN or RPN parameters. */
  dataEntry: 6,
  /** Controls the volume of the channel. */
  channelVolume: 7,
  /** Controls the left and right balance, generally for stereo programes. A value of 64 equals the center. */
  balance: 8,
  /** */
  cc09: 9,
  /** Controls the left and right balance, generally for mono programes. A value of 64 equals the center. */
  pan: 10,
  /** Expression is a percentage of volume (CC7). */
  expression: 11,
  /** Usually used to control a parameter of an effect within the synth or workstation. */
  effect1: 12,
  /** Usually used to control a parameter of an effect within the synth or workstation. */
  effect2: 13,
  cc14: 14,
  cc15: 15,
  generalPurpose1: 16,
  generalPurpose2: 17,
  generalPurpose3: 18,
  generalPurpose4: 19,
  cc20: 20,
  cc21: 21,
  cc22: 22,
  cc23: 23,
  cc24: 24,
  cc25: 25,
  cc26: 26,
  cc27: 27,
  cc28: 28,
  cc29: 29,
  cc30: 30,
  cc31: 31,
  bankSelectFine: 32,
  modulationFine: 33,
  breathFine: 34,
  cc35: 35,
  footFine: 36,
  portamentoTimeFine: 37,
  dataEntryFine: 38,
  channelVolumeFine: 39,
  balanceFine: 40,
  cc41: 41,
  panFine: 42,
  expressionFine: 43,
  effect1Fine: 44,
  effect2Fine: 45,
  cc46: 46,
  cc47: 47,
  cc48: 48,
  cc49: 49,
  cc50: 50,
  cc51: 51,
  cc52: 52,
  cc53: 53,
  cc54: 54,
  cc55: 55,
  cc56: 56,
  cc57: 57,
  cc58: 58,
  cc59: 59,
  cc60: 60,
  cc61: 61,
  cc62: 62,
  cc63: 63,
  /** ≤63 off, ≥64 on	Controls sustain pedal. Nearly every synth will react to CC 64. (See also Sostenuto CC 66) */
  damperPedal: 64,
  /** ≤63 off, ≥64 on */
  portamento: 65,
  /** ≤63 off, ≥64 on	Like the Sustain  (CC 64) but only holds notes that were “On” when the pedal was pressed. */
  sostenuto: 66,
  /** ≤63 off, ≥64 on	Lowers the volume of notes played. */
  softPedal: 67,
  /** ≤63 off, ≥64 on	Turns Legato effect between 2 subsequent notes on or off. */
  legatoFootswitch: 68,
  /** ≤63 off, ≥64 on	Another way to “hold notes” (s 64 a 66). However notes fade out according to their release parameter rather than when the pedal is released.*/
  hold2: 69,
  /** Usually controls the way a sound is produced. Default = Sound Variation. */
  sound1: 70,
  /** Allows shaping the Voltage Controlled Filter (VCF). Default = Resonance also (Timbre or Harmonics) */
  sound2: 71,
  /** Controls release time of the Voltage controlled Amplifier (VCA). Default = Release Time. */
  sound3: 72,
  /** Controls the “Attack’ of a sound. The attack is the amount of time it takes for the sound to reach maximum amplitude. */
  sound4: 73,
  /** Controls VCFs cutoff frequency of the filter. */
  sound5: 74,
  /** Generic – Some manufacturers may use to further shave their sounds. */
  sound6: 75,
  /** Generic – Some manufacturers may use to further shave their sounds. */
  sound7: 76,
  /** Generic – Some manufacturers may use to further shave their sounds. */
  sound8: 77,
  /** Generic – Some manufacturers may use to further shave their sounds. */
  sound9: 78,
  /** Generic – Some manufacturers may use to further shave their sounds. */
  sound10: 79,
  /** Decay Generic or on/off switch ≤63 off, ≥64 on */
  generalPurpose5: 80,
  /** Hi-Pass Filter Frequency or Generic on/off switch ≤63 off, ≥64 on */
  generalPurpose6: 81,
  /** Generic on/off switch  ≤63 off, ≥64 on */
  generalPurpose7: 82,
  /** Generic on/off switch  ≤63 off, ≥64 on */
  generalPurpose8: 83,
  /** Controls the amount of Portamento. */
  portamentoControl: 84,
  cc85: 85,
  cc86: 86,
  cc87: 87,
  cc88: 88,
  cc89: 89,
  cc90: 90,
  /** Usually controls reverb send amount */
  effects1Depth: 91,
  /** Usually controls tremolo amount */
  effects2Depth: 92,
  /** Usually controls chorus amount */
  effects3Depth: 93,
  /** Usually controls detune amount */
  effects4Depth: 94,
  /** Usually controls phaser amount */
  effects5Depth: 95,
  /** Usually used to increment data for RPN and NRPN messages. */
  dataIncrement: 96,
  /** Usually used to decrement data for RPN and NRPN messages. */
  dataDecrement: 97,
  /** For s 6, 38, 96, and 97, it selects the NRPN parameter. */
  NRPN_LSB: 98,
  /** For s 6, 38, 96, and 97, it selects the NRPN parameter. */
  NRPN_MSB: 99,
  /** For s 6, 38, 96, and 97, it selects the RPN parameter. */
  RPN_LSB: 100,
  /** For s 6, 38, 96, and 97, it selects the RPN parameter. */
  RPN_MSB: 101,
  cc102: 102,
  cc103: 103,
  cc104: 104,
  cc105: 105,
  cc106: 106,
  cc107: 107,
  cc108: 108,
  cc109: 109,
  cc110: 110,
  cc111: 111,
  cc112: 112,
  cc113: 113,
  cc114: 114,
  cc115: 115,
  cc116: 116,
  cc117: 117,
  cc118: 118,
  cc119: 119
  // allSoundOff: 120,
  // resetAlls: 121,
  // localControlOnOff: 122,
  // allNotesOff: 123,
  // omniModeOff: 124,
  // omniModeOn: 125,
  // monoOperation: 126,
  // polyOperation: 127
};