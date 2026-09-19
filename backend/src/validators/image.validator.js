import { AppError } from "../lib/app-error.js";
const allowedMediaTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
function hasExpectedSignature(buffer, mimeType) {
  if (mimeType === "image/jpeg") return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (mimeType === "image/webp") return buffer.subarray(0, 4).equals(Buffer.from("RIFF")) && buffer.subarray(8, 12).equals(Buffer.from("WEBP"));
  return false;
}
export function isAllowedImageMimeType(mimeType) { return allowedMediaTypes.has(mimeType); }
export function validateImage(file, maxImageBytes) {
  if (!file?.buffer?.length) throw new AppError(400, "An empty image was supplied.");
  if (file.size > maxImageBytes) throw new AppError(413, "Each image must be 15 MB or smaller.");
  if (!isAllowedImageMimeType(file.mimetype)) throw new AppError(415, "Only JPEG, PNG, and WebP images are allowed.");
  if (!hasExpectedSignature(file.buffer, file.mimetype)) throw new AppError(415, "Image file signature is invalid.");
}
