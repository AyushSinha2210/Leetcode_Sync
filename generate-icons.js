const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makePng(size) {
  const width = size;
  const height = size;
  const rawData = Buffer.alloc(height * (width * 4 + 1));

  let pos = 0;
  for (let y = 0; y < height; y++) {
    rawData[pos++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      // Calculate normalized coords [0, 1]
      const nx = x / (width - 1);
      const ny = y / (height - 1);
      
      // Rounded rect mask
      const cx = nx - 0.5;
      const cy = ny - 0.5;
      const r = Math.sqrt(cx * cx + cy * cy);
      
      // Gradient: LeetCode orange #FFA116 to Emerald #10B981
      const rVal = Math.round(255 * (1 - ny) + 16 * ny);
      const gVal = Math.round(161 * (1 - ny) + 185 * ny);
      const bVal = Math.round(22 * (1 - ny) + 129 * ny);

      // Icon: draw a code sync symbol or brackets `< / >`
      let isSymbol = false;
      
      // Center circle / sync loop or brackets
      const dx = (nx - 0.5) * size;
      const dy = (ny - 0.5) * size;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ringOuter = size * 0.38;
      const ringInner = size * 0.24;

      // Draw sync arrows ring
      if (dist >= ringInner && dist <= ringOuter) {
        // Cut out gaps for arrows
        const angle = Math.atan2(dy, dx);
        if (!((angle > 0.3 && angle < 0.9) || (angle < -2.2 && angle > -2.8))) {
          isSymbol = true;
        }
      }

      // Rounded squircle background
      const cornerR = size * 0.22;
      const insideBoxX = Math.abs(x - width / 2) - (width / 2 - cornerR);
      const insideBoxY = Math.abs(y - height / 2) - (height / 2 - cornerR);
      const isCorner = insideBoxX > 0 && insideBoxY > 0;
      const cornerDist = Math.sqrt(Math.max(0, insideBoxX) ** 2 + Math.max(0, insideBoxY) ** 2);
      
      if (isCorner && cornerDist > cornerR) {
        // Transparent outside rounded corner
        rawData[pos++] = 0;
        rawData[pos++] = 0;
        rawData[pos++] = 0;
        rawData[pos++] = 0;
      } else if (isSymbol) {
        // Crisp white symbol
        rawData[pos++] = 255;
        rawData[pos++] = 255;
        rawData[pos++] = 255;
        rawData[pos++] = 255;
      } else {
        // Gradient background with dark border
        rawData[pos++] = rVal;
        rawData[pos++] = gVal;
        rawData[pos++] = bVal;
        rawData[pos++] = 255;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Signature
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bit
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  function createChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);
    const crcBuf = Buffer.concat([Buffer.from(type), data]);
    buf.writeUInt32BE(crc32(crcBuf), 8 + len);
    return buf;
  }

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 32, 48, 128].forEach(size => {
  const png = makePng(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png (${png.length} bytes)`);
});
