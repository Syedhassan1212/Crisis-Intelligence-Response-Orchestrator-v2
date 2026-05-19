const fs = require('fs');
const path = require('path');

function writeWav(filename, sampleRate, duration, sampleGenerator) {
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2; // 16-bit PCM
  const fileSize = 44 + dataSize;
  const buffer = Buffer.alloc(fileSize);

  // RIFF identifier
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write('WAVE', 8);

  // format subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate (sampleRate * 2 bytes/sample)
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // write samples
  for (let i = 0; i < numSamples; i++) {
    const val = sampleGenerator(i, sampleRate);
    const clamped = Math.max(-32768, Math.min(32767, Math.floor(val)));
    buffer.writeInt16LE(clamped, 44 + i * 2);
  }

  const destPath = path.join(__dirname, 'public', filename);
  fs.writeFileSync(destPath, buffer);
  console.log(`Wrote WAV file to ${destPath}`);
}

// Generate chirp.wav (Motorola-style dual-tone chirp)
writeWav('chirp.wav', 11025, 0.25, (i, s) => {
  const t = i / s;
  let freq = 1247;
  let amp = 0.45;
  if (t > 0.08) {
    freq = 880;
  }
  if (t > 0.20) {
    amp *= (0.25 - t) / 0.05;
  }
  return amp * 16384 * Math.sin(2 * Math.PI * freq * t);
});

// Generate static.wav (low background radio hum/static)
writeWav('static.wav', 11025, 4.0, (i, s) => {
  const t = i / s;
  const raw = Math.random() * 2.0 - 1.0;
  const volume = 0.05; // low background volume
  return raw * volume * 16384;
});
