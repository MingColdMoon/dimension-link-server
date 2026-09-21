import { createReadStream } from "node:fs";
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Middleware } from "koa";
import { AppError, ErrorCode } from "./errors.js";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isIllustrationUrl(url: string): boolean {
  return /^illustration:\d{1,3}$/.test(url);
}

export async function saveChatImage(base64: string, mimeType = "image/jpeg"): Promise<string> {
  const ext = MIME_EXT[mimeType.toLowerCase()];
  if (!ext) {
    throw new AppError(422, ErrorCode.INVALID_IMAGE, "只支持 jpg / png / webp / gif");
  }
  const raw = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(raw, "base64");
  } catch {
    throw new AppError(422, ErrorCode.INVALID_IMAGE, "图片数据读不出来");
  }
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new AppError(422, ErrorCode.INVALID_IMAGE, "图片太大了，试试 2MB 以内");
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

export function serveUploads(): Middleware {
  return async (ctx, next) => {
    if (!ctx.path.startsWith("/uploads/")) {
      await next();
      return;
    }
    const filename = path.basename(ctx.path);
    if (!filename || filename !== path.posix.basename(ctx.path)) {
      ctx.status = 404;
      return;
    }
    const file = path.join(UPLOAD_DIR, filename);
    try {
      const info = await stat(file);
      if (!info.isFile()) {
        ctx.status = 404;
        return;
      }
    } catch {
      ctx.status = 404;
      return;
    }
    ctx.type = path.extname(filename);
    ctx.body = createReadStream(file);
  };
}
