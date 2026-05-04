// One-shot script: render public/icon.svg to PNG sizes for iOS / PWA.
// Run via: node scripts/generate-icons.js
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const svgPath = path.join(__dirname, "..", "public", "icon.svg");
const svg = fs.readFileSync(svgPath);

const sizes = [
  { size: 180, name: "apple-icon.png" },
  { size: 192, name: "icon-192.png" },
  { size: 512, name: "icon-512.png" },
];

(async () => {
  for (const { size, name } of sizes) {
    const out = path.join(__dirname, "..", "public", name);
    await sharp(svg).resize(size, size).png().toFile(out);
    console.log(`Generated ${name} (${size}x${size})`);
  }
})();
