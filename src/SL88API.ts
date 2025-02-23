class SL88API {
    //TODO Build out the API
    device: SL.SLDevice;

    constructor(midi: SL.SLDevice | MidiPair) {
        this.device = midi instanceof MidiPair ? new SL.SLDevice(midi) : midi;
    }

    writeProgram(programNo: number, program: SL.Program) {
        const hex = SL.ProgramDump.hex(programNo, program);
        this.device.send(hex);
    }
  
    async loadProgram(programNo: number = 16383) {
        var r = await this.device.requestObjectAsync(SL.RecallProgram.hex(programNo), SL.ProgramDump.from);
        // println(`program received : ${r.programNo} - ${r.program.name}`);
        // println(r.program.data.join(","));
        // //r.program.device = this.device;       // make it "live" so that changes are recorded to ram
        return r.program;
    }

    async getConfigDump() {
        println('Requesting config dump');
        var result = {
            activeProgramNo: -1,
            activeProgram: {} as SL.Program,
            names: [] as string[],
            curves: [] as any[]
        }
        try {
            var r = await this.device.requestObjectAsync("0010", SL.try_decode);
            while (true) {
                if (!r) {
                    println('unknown: ' + this.device.mostRecentlyReceived);
                    break;
                }
                if (SL.isProgramName(r))
                    result.names[r.programNo] = r.name;
                else if (SL.isRecallProgram(r))
                    result.activeProgramNo = r.programNo;
                else if (SL.isProgramDump(r))
                    result.activeProgram = r.program;
                else if (SL.isVelocityCurve(r))
                    result.curves[r.curveNo] = {
                        name: r.name,
                        type: r.type,
                        velocities: r.velocities,
                        xy_points: r.xy_points
                    }
                else if (SL.isEndOfProgramNameDump(r)) {
                    println('End of Dump');
                    break;
                }
                // else if (SL.isSetMode2(r)) {
                //     // println(r.toString());
                // }
                // else if (SL.isSetSessionMode(r)) {
                //     // println(r.toString());
                // }
                // else {
                //     println(r.toString());
                // }
                r = await this.device.awaitReply(SL.try_decode);
            }
        } catch (e) {
            println(`Error occured retrieving SL88 config dump: ${e}`);
        }
        return result;
    }

    /** Creates track selection programs at a given slot as well as a tracks group*/
    async createTrackPrograms(trackPrograms :number = 30, firstSlot: number = 0, groupSlot: number = 0) {
        const prog = SL.Program.newDefault();
        const indices = [];
        for (var i = 0; i < trackPrograms; i++) {
            prog.name = `Track ${1 + i}`;

            prog.zones[0].instrument = `Track ${1 + i}`;
            prog.zones[0].sound = 'Keys (ch1)';
            prog.zones[3].programChange = i;
            prog.zones[3].LSB = 'Off';  // track mode
            prog.zones[3].MSB = 'Off';  // track number
            prog.zones[3].stick1Y = "pitchbend";

            var programNo = firstSlot + i;
            if(i < 30)
                indices.push(programNo);
            // println(`Creating ${prog.name}`);
            await this.device.sendAsync(new SL.ProgramDump(programNo, prog).toHex());
        }
        await this.device.sendAsync(new SL.GroupDump(groupSlot, 'TRACKS', indices, true).toHex());
    }

    async setTracksInGroup(numberOfTracks: number, firstTrackProgram: number = 0, tracksGroup: number = 0) {
        const indices = Array(numberOfTracks).map((_, i) => firstTrackProgram + i);
        await this.device.sendAsync(new SL.GroupDump(tracksGroup, 'TRACKS', indices, true).toHex());
    }

    // createProgramTemplate() {
    //     const prog = new SL.Program(SL.Program.template);
    //     prog.name = `INIT PROGRAM`;
    //     for (let zone of prog.zones) {
    //       zone.instrument = '';
    //       zone.sound = '';
    //       zone.enabled = 'Disabled';
    //       zone.midiChannel = 0;
    //       zone.midiPort = "USB";
    //       zone.volume = 'Off';
    //       zone.programChange = 'Off';
    //       zone.LSB = 'Off';
    //       zone.MSB = 'Off';
    //       zone.stick1X = "Off";
    //       zone.stick1Y = 'Off';
    //       zone.stick2X = 'Off';
    //       zone.stick2Y = 'Off';
    //       zone.stick3X = 'Off';
    //       zone.stick3Y = 'Off';
    //       zone.pedal1 = 'Off';
    //       zone.pedal2 = 'Off';
    //       zone.pedal3 = 'Off';
    //       zone.pedal4 = 'Off';
    //       zone.afterTouch = true;
    //       zone.curveType = 'Linear';
    //       zone.octave = 0;
    //       zone.transpose = 0;
    //       zone.lowVel = 0;
    //       zone.highVel = 127;
    //       zone.lowKey = 21;
    //       zone.highKey = 108;
    //     }


    //     prog.zones[0].enabled = 'On';
    //     prog.zones[0].stick2X = 'pitchbend';
    //     prog.zones[0].stick2Y = 'modulation';
    //     prog.zones[0].stick3X = 'sound1';
    //     prog.zones[0].stick3Y = 'sound4';
    //     prog.zones[0].pedal1 = 'damperPedal';
    //     prog.zones[0].pedal3 = 'aftertouch';
    //     prog.zones[0].curveType = 'User1';
    //     println('[' + prog.data.map(x => x || 0).join(",") + '];')
    //   }
}