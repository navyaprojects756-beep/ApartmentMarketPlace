import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const uploadDirectory = path.resolve(process.cwd(), 'uploads');
const allowedImages = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export async function saveImageDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) throw new Error('IMAGE_FORMAT_NOT_SUPPORTED');
  const mimeType = match[1];
  const extension = allowedImages.get(mimeType);
  if (!extension) throw new Error('IMAGE_FORMAT_NOT_SUPPORTED');
  const buffer = Buffer.from(match[2].replaceAll(/\s/g, ''), 'base64');
  if (buffer.length === 0 || buffer.length > 1.5 * 1024 * 1024) throw new Error('IMAGE_SIZE_INVALID');
  await mkdir(uploadDirectory, { recursive: true });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(uploadDirectory, filename), buffer, { flag: 'wx' });
  return { filename, mimeType, url: `/uploads/${filename}` };
}
