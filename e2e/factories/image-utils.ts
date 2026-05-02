import { mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 生成临时测试图像文件
 * @param label - 图像标签（用于生成文件名）
 * @returns 生成的图像文件路径
 */
export async function generateTempImage(): Promise<string> {
  const testDir = join(__dirname, "..", "..", "test-data");
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }

  const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fileName = `e2e_${uniqueId}.png`;
  const outputPath = join(testDir, fileName);

  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);

  await sharp({
    create: {
      width: 200,
      height: 100,
      channels: 3,
      background: `rgb(${r}, ${g}, ${b})`,
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
            <text x="100" y="55" font-size="12" fill="white" text-anchor="middle" font-family="monospace">
              ${uniqueId}
            </text>
          </svg>`,
        ),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toFile(outputPath);

  if (!existsSync(outputPath)) {
    throw new Error(`Failed to generate test image: ${outputPath}`);
  }

  return outputPath;
}
