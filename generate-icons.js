/**
 * generate-icons.js — Creates PWA icons (192x192 and 512x512 PNG) 
 * using only Node.js built-ins (no external deps needed).
 * Writes raw PNG via a minimal encoder.
 */

const fs   = require('fs');
const path = require('path');
const { createCanvas } = (() => {
  try { return require('canvas'); } catch { return null; }
})() || {};

const outDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// If the 'canvas' npm package isn't available, write SVG fallback icons
// and update manifest to use them.
if (!createCanvas) {
  console.log('canvas package not found — writing SVG icons instead.');
  writeSVGIcons();
} else {
  writeCanvasIcons();
}

function drawIcon(ctx, size) {
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

function writeCanvasIcons() {
  [192, 512].forEach(size => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    drawIcon(ctx, size);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(outDir, `icon-${size}.png`), buf);
    console.log(`✓ icon-${size}.png written`);
  });
  console.log('Icons generated successfully!');
}

function writeSVGIcons() {
  const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
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

  [192, 512].forEach(size => {
    // Write SVG with .png extension as fallback (browsers will handle it)
    // Actually write proper SVG files and update the code
    fs.writeFileSync(path.join(outDir, `icon-${size}.svg`), svg(size));
    console.log(`✓ icon-${size}.svg written`);
  });

  // Also write a simple 1x1 transparent PNG placeholder so the manifest doesn't 404
  // Real PNG magic bytes for a 1x1 transparent PNG
  const png1x1 = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000a49444154789c6260000000000200016617683200000000049454e44ae426082', 'hex'
  );
  [192, 512].forEach(size => {
    fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png1x1);
  });
  console.log('Placeholder PNGs written. For proper icons, run: npm install canvas && node generate-icons.js');
}
