import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { env } from '../config/env.js';

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

  if (env.STORAGE_PROVIDER === 'cloudinary') {
    return saveToCloudinary(buffer, mimeType);
  }

  await mkdir(uploadDirectory, { recursive: true });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(uploadDirectory, filename), buffer, { flag: 'wx' });
  return { filename, mimeType, url: `/uploads/${filename}` };
}

async function saveToCloudinary(buffer: Buffer, mimeType: string) {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error('CLOUDINARY_NOT_CONFIGURED');

  const publicId = `gatedcart/${randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const signedParameters = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = createHash('sha1').update(`${signedParameters}${apiSecret}`).digest('hex');
  const form = new FormData();
  const blobBytes = new Uint8Array(buffer);
  form.append('file', new Blob([blobBytes.buffer as ArrayBuffer], { type: mimeType }), `${publicId}.image`);
  form.append('api_key', apiKey);
  form.append('public_id', publicId);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);

  const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const payload = await uploadResponse.json() as { secure_url?: string; public_id?: string; error?: { message?: string } };
  if (!uploadResponse.ok || !payload.secure_url) {
    throw new Error(`CLOUDINARY_UPLOAD_FAILED:${payload.error?.message || uploadResponse.statusText}`);
  }

  return {
    filename: payload.public_id || publicId,
    publicId: payload.public_id || publicId,
    mimeType,
    url: payload.secure_url,
  };
}
