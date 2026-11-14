import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const textures = [
  ["earth-bluemarble-2048.jpg", "earth-bluemarble-2048-heimdall.webp"],
  ["earth-bluemarble-4k.jpg", "earth-bluemarble-4k-heimdall.webp"],
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyHeimdallPalette(pixels) {
  for (let index = 0; index < pixels.length; index += 3) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const ocean = blue > red * 1.25 && blue > green * 1.2;
    const tint = ocean ? [17, 9, 31] : [21, 132, 110];
    const shade = ocean
      ? 0.45 + clamp(luminance / 80, 0, 1) * 0.7
      : 0.35 + (luminance / 255) * 0.8;

    pixels[index] = Math.round(tint[0] * shade);
    pixels[index + 1] = Math.round(tint[1] * shade);
    pixels[index + 2] = Math.round(tint[2] * shade);
  }
}

for (const [sourceName, outputName] of textures) {
  const sourcePath = path.join(projectRoot, "public", "textures", sourceName);
  const outputPath = path.join(projectRoot, "public", "textures", outputName);
  const { data, info } = await sharp(sourcePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  applyHeimdallPalette(data);
  await sharp(data, { raw: info }).webp({ quality: 88, effort: 6 }).toFile(outputPath);
  console.log(`${outputName}: ${info.width}×${info.height}`);
}
