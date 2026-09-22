import assert from "node:assert/strict";
import { test } from "node:test";
import { joinSpeech, pcmToWav, wavSamples } from "../src/audio.js";
import { GoogleError } from "../src/google.js";

test("WAV samples preserve rate and skip padded metadata", () => {
    const pcm = Buffer.from([1, 2, 3, 4]);
    const wav = pcmToWav(pcm, 16000);
    const metadata = Buffer.from([74, 85, 78, 75, 1, 0, 0, 0, 42, 0]);
    const result = wavSamples(Buffer.concat([wav.subarray(0, 12), metadata, wav.subarray(12)]));
    assert.deepEqual(result, { pcm, rate: 16000 });
});

test("truncated WAV format and partial samples fail without leaking a RangeError", () => {
    const wav = pcmToWav(Buffer.alloc(4));
    for (const bad of [wav.subarray(0, 22), wav.subarray(0, 45)]) {
        assert.throws(() => wavSamples(bad), GoogleError);
    }
});

test("stereo WAV is not repackaged as mono", () => {
    const wav = pcmToWav(Buffer.alloc(4));
    wav.writeUInt16LE(2, 22);
    assert.throws(() => wavSamples(wav), GoogleError);
});

test("speech chunks must share a sample rate to avoid changing speed at the join", () => {
    const a = { pcm: Buffer.alloc(4), rate: 16000 };
    const b = { pcm: Buffer.alloc(4), rate: 24000 };
    assert.throws(() => joinSpeech([a, b]), GoogleError);
    assert.deepEqual(wavSamples(joinSpeech([a, a])), { pcm: Buffer.alloc(8), rate: 16000 });
});
