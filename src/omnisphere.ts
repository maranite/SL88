load('java.js');



class RatedPatch {
    name: string = "";
    path: string = "";
    library: string = "";
    rating: number = 0
}

type MidiLearnPatch = {
    index : number;
    name: string;
    library: string;
    channel: number;
    cc: number;
}


class Omnisphere {
    constructor(public steam_folder: string = "C:\\ProgramData\\Spectrasonics\\STEAM\\") {
    }

    getSteamPath(...parts: string[]): ioPath {
        var path = ioFileSystems.getDefault().getPath(this.steam_folder);
        for (let part of parts)
            path = path?.resolve(part);
        return path;
    }

    readDefaultMulti(): string[] {
        var stream = this.getSteamPath('Omnisphere', 'Defaults', 'default multi.mlt_omn');
        if (!stream.toFile().exists()) {
            errorln(`Couldn't find Omnisphere's default multi.mlt_omn`);
            return [];
        }
        return [...ioFiles.readAllLines(stream, StandardCharsets.UTF_8)];
    }

    writeDefaultMulti(data: string[]) {
        var multi = this.getSteamPath('Omnisphere', 'Defaults', 'default multi.mlt_omn');
        if (multi.toFile().exists())
            multi.toFile().delete();
        var shring = Java.type("java.lang.String");
        var text = new shring(data.join("\n"));
        ioFiles.write(multi, text.getBytes());
    }

    findMidiLearnSection(rawXml: string[]) {
        // find the first SynthSubengine tag        
        var end = 0;
        while (end < rawXml.length && !rawXml[end].match(/<SynthSubEngine\s*>/))
            end += 1;

        if (end == rawXml.length) {
            errorln(`Couldn't find SynthSubEngine tag`);
            return [-1, -1];
        }

        // roll back to find the midilearn tag
        var start = end;
        if (rawXml[start - 1].match(/<\/MIDIlearn/)) {
            start -= 2;
            while (!rawXml[start].match(/<MIDIlearn/))
                start -= 1;
        }
        return [start, end - start];
    }

    setDefaultMultiMidiLearnAttributes(attributes: string) {
        var rawXml = this.readDefaultMulti();
        if (!rawXml) return;
        const [start, len] = this.findMidiLearnSection(rawXml);
        if (start > 0) {
            rawXml.splice(start, len, `<MIDIlearn ${attributes}>`, `</MIDIlearn>`);
            this.writeDefaultMulti(rawXml);
        }
    }

    getRatedPatches(minRating: number = 5, multi: boolean = false): RatedPatch[] {
        var steam = this.getSteamPath('Omnisphere', 'Settings Library', 'User Tags', multi ? 'mlt_omn.index' : 'prt_omn.index');
        var steamFile = steam.toFile();
        var result: RatedPatch[] = [];
        if (steamFile.exists()) {
            var lastMatch = new RatedPatch();
            var rawXml = ioFiles.readAllLines(steam, StandardCharsets.UTF_8);
            for (let line of rawXml) {
                var entryMatch = line.match(/<ENTRY NAME="([^"]+)" PATH="([^"].+)">/);
                if (entryMatch) {
                    lastMatch.name = decodeURI(entryMatch[1]);
                    lastMatch.path = decodeURI(entryMatch[2]);
                    continue;
                }
                if (entryMatch = line.match(/<ATTR NAME="Library" VALUE="([^"].+)" \/>/)) {
                    lastMatch.library = entryMatch[1];
                    continue;
                }
                if (entryMatch = line.match(/<ATTR NAME="Rtng" VALUE="(\d)" \/>/)) {
                    lastMatch.rating = parseInt(entryMatch[1]);
                    continue;
                }
                if (entryMatch = line.match(/<\/ENTRY>/)) {
                    if (lastMatch.rating >= minRating)
                        result.push(lastMatch);
                    lastMatch = new RatedPatch();
                    continue;
                }
            }
        }
        return result;
    }

    getTopRatedPatches(maxPatches: number = 220): RatedPatch[] {
        var patches = this.getRatedPatches(3);
        var all = [...patches];
        all.sort((a, b) => {
            var r = b.rating - a.rating;
            //r = r ? r : a.library.localeCompare(b.library);
            return r ? r : a.name.localeCompare(b.name);
        });
        all = all.splice(0, maxPatches);
        return all;
    }

    partitionRatedPatches(patches: RatedPatch[], minCC: number = 64, maxCC: number = 96, firstChannel: number = 8): MidiLearnPatch[] {
        const maxPatchesPerChannel = maxCC = minCC;
        return patches.map((r, i) => {
            return {
                index : i,
                name: r.name,
                library: r.library,
                channel: firstChannel + Math.floor(i / maxPatchesPerChannel),
                cc: minCC + (i % maxPatchesPerChannel)
            } as MidiLearnPatch;
        });
    }

    setMidiLearnPatches(patches: MidiLearnPatch[]) {
        var attributes = patches.map(r => {
            const ix = r.index;
            return `Ch${ix}="${r.channel}" Kind${ix}="176" ` + 
                   `ID${ix}="${r.cc}" End${ix}="0" ` + 
                   `NRPN${ix}="0" Patch${ix}="${r.name}" ` + 
                   `Lib${ix}="${r.library}" PN${ix}="0"`
        }).join(" ");
        this.setDefaultMultiMidiLearnAttributes(attributes);
    }

    getMidiLearnPatches(): MidiLearnPatch[] {
        var result: MidiLearnPatch[] = [];
        var rawXml = this.readDefaultMulti();
        if (!rawXml) return result;
        const [start, len] = this.findMidiLearnSection(rawXml);
        if (start > 0) {
            var line = rawXml[start];
            println(line)
            var rx = /Ch(?<preset>\d+)="(?<channel>\d+)"\s+Kind\k<preset>="176"\s+ID\k<preset>="(?<cc>\d+)".*?Patch\k<preset>="(?<name>[^"]+)"\s+Lib\k<preset>="(?<library>[^"]+)"/g;
            var group = rx.exec(line)?.groups;
            while (group) {
                const r = {
                    index : parseInt(group.preset),
                    name: group.name,
                    library: group.library,
                    channel: parseInt(group.channel),
                    cc: parseInt(group.cc)
                } as MidiLearnPatch;
                result.push(r);
                group = rx.exec(line)?.groups;
            }
        }
        return result;
    }
}
