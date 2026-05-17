/**
 * generate-icons.js — Creates PWA icons (192x192 and 512x512 PNG) 
 * using sharp (preferred), canvas, or SVG fallbacks.
 * Runs seamlessly on all platforms (Windows, macOS, Linux).
 */

const fs   = require('fs');
const path = require('path');

// Dynamically check for sharp (robust, cross-platform, pre-compiled on Windows)
const sharp = (() => {
  try { return require('sharp'); } catch { return null; }
})();

// Dynamically check for node-canvas
const { createCanvas } = (() => {
  try { return require('canvas'); } catch { return null; }
})() || {};

const outDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const SVG_CONTENT = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#020617"/>
  <radialGradient id="g" cx="50%" cy="45%" r="50%">
    <stop offset="0%" stop-color="#22C55E" stop-opacity="0.2"/>
    <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
  </radialGradient>
  <rect width="512" height="512" fill="url(#g)"/>
  <ellipse cx="256" cy="192" rx="140" ry="40" fill="#1E293B" stroke="#22C55E" stroke-width="5"/>
  <rect x="116" y="192" width="280" height="160" fill="#0F172A"/>
  <ellipse cx="256" cy="352" rx="140" ry="40" fill="#0F172A" stroke="#22C55E" stroke-width="5"/>
  <line x1="116" y1="272" x2="396" y2="272" stroke="rgba(34,197,94,0.4)" stroke-width="3"/>
  <ellipse cx="256" cy="192" rx="140" ry="40" fill="#1E293B" stroke="#22C55E" stroke-width="5"/>
  <circle cx="256" cy="192" r="18" fill="#22C55E"/>
  <text x="256" y="430" font-family="monospace" font-weight="bold" font-size="68" fill="#F8FAFC" text-anchor="middle">db</text>
</svg>`;

async function writeSharpIcons() {
  const svgBuffer = Buffer.from(SVG_CONTENT);
  for (const size of [192, 512]) {
    const pngPath = path.join(outDir, `icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(pngPath);
    console.log(`✓ icon-${size}.png rendered perfectly using sharp`);
  }
}

function writeCanvasIcons() {
  [192, 512].forEach(size => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    drawIconOnCanvas(ctx, size);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(outDir, `icon-${size}.png`), buf);
    console.log(`✓ icon-${size}.png written using canvas`);
  });
}

function drawIconOnCanvas(ctx, size) {
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 512;

  // Background
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, size, size);

  // Glow
  const grd = ctx.createRadialGradient(cx, cy - 20 * scale, 10 * scale, cx, cy, size * 0.55);
  grd.addColorStop(0, 'rgba(34,197,94,0.18)');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);

  // Database cylinder — top ellipse
  const rX = 110 * scale, rY = 32 * scale;
  const top = cy - 80 * scale;
  const bot = cy + 80 * scale;
  const h   = bot - top;

  // Body
  ctx.beginPath();
  ctx.ellipse(cx, top + rY, rX, rY, 0, Math.PI, 0);
  ctx.lineTo(cx + rX, bot);
  ctx.ellipse(cx, bot, rX, rY, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = '#0F172A';
  ctx.fill();
  ctx.strokeStyle = '#22C55E';
  ctx.lineWidth = 4 * scale;
  ctx.stroke();

  // Middle line
  ctx.beginPath();
  ctx.ellipse(cx, cy, rX, rY, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(34,197,94,0.5)';
  ctx.lineWidth = 2.5 * scale;
  ctx.stroke();

  // Top cap
  ctx.beginPath();
  ctx.ellipse(cx, top + rY, rX, rY, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1E293B';
  ctx.fill();
  ctx.strokeStyle = '#22C55E';
  ctx.lineWidth = 4 * scale;
  ctx.stroke();

  // Green dot on top cap
  ctx.beginPath();
  ctx.arc(cx, top + rY, 14 * scale, 0, Math.PI * 2);
  ctx.fillStyle = '#22C55E';
  ctx.fill();

  // "db" label
  ctx.fillStyle = '#F8FAFC';
  ctx.font = `bold ${52 * scale}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('db', cx, bot + 52 * scale);
}

function writeSVGIcons() {
  [192, 512].forEach(size => {
    // Write customized sizes of SVGs as well for high-compatibility
    const resizedSvg = SVG_CONTENT
      .replace('width="512"', `width="${size}"`)
      .replace('height="512"', `height="${size}"`);
    fs.writeFileSync(path.join(outDir, `icon-${size}.svg`), resizedSvg);
    console.log(`✓ icon-${size}.svg written (vector source)`);
  });
}

function writePlaceholderIcons() {
  // Real PNG magic bytes for a 1x1 transparent PNG to act as non-404 placeholder
  const png1x1 = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000a49444154789c6260000000000200016617683200000000049454e44ae426082', 'hex'
  );
  [192, 512].forEach(size => {
    fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png1x1);
    console.log(`✓ icon-${size}.png written as 1x1 transparent placeholder`);
  });
}

// Run the main flow
(async () => {
  try {
    // Always create vector SVG sources
    writeSVGIcons();

    if (sharp) {
      console.log('\n🎨 sharp found! Creating beautiful high-resolution PNG icons...');
      await writeSharpIcons();
    } else if (createCanvas) {
      console.log('\n🎨 canvas found! Drawing PNG icons via Canvas context...');
      writeCanvasIcons();
    } else {
      console.log('\n⚠️  No image processing library (sharp or canvas) detected.');
      console.log('   The PNG icons in public/icons are currently 1x1 transparent placeholders.');
      console.log('   To render perfect, high-resolution PNG icons, please run:');
      console.log('     npm install -D sharp');
      console.log('     node generate-icons.js\n');
      writePlaceholderIcons();
    }
    console.log('✨ Icon generation process complete.');
  } catch (error) {
    console.error('❌ Error during icon generation:', error);
    process.exit(1);
  }
})();
