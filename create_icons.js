import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1x1 Transparent PNG
const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
    0xAE, 0x42, 0x60, 0x82
]);

// Construct ICO
const icoHeader = Buffer.from([
    0x00, 0x00, // Reserved
    0x01, 0x00, // Type (1=ICO)
    0x01, 0x00  // Count (1 image)
]);

const icoEntry = Buffer.alloc(16);
icoEntry.writeUInt8(1, 0); // Width
icoEntry.writeUInt8(1, 1); // Height
icoEntry.writeUInt8(0, 2); // Colors
icoEntry.writeUInt8(0, 3); // Reserved
icoEntry.writeUInt16LE(1, 4); // Planes
icoEntry.writeUInt16LE(32, 6); // BPP
icoEntry.writeUInt32LE(pngBuffer.length, 8); // Size
icoEntry.writeUInt32LE(22, 12); // Offset (6+16)

const icoBuffer = Buffer.concat([icoHeader, icoEntry, pngBuffer]);

const iconDir = path.join(__dirname, 'src-tauri', 'icons');
if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
}

fs.writeFileSync(path.join(iconDir, '32x32.png'), pngBuffer);
fs.writeFileSync(path.join(iconDir, '128x128.png'), pngBuffer);
fs.writeFileSync(path.join(iconDir, '128x128@2x.png'), pngBuffer);
fs.writeFileSync(path.join(iconDir, 'icon.png'), pngBuffer);
fs.writeFileSync(path.join(iconDir, 'icon.ico'), icoBuffer);

console.log('Valid ICO and PNGs created successfully.');
