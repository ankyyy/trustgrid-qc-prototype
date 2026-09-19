import fs from "node:fs/promises";
import path from "node:path";
const extensions = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
// Adapter boundary: replace this class with S3/GCS resumable uploads in production.
export class LocalImageStorage {
  constructor(uploadDir) { this.uploadDir = uploadDir; }
  async saveInspectionImages(inspectionId, files) {
    await fs.mkdir(this.uploadDir, { recursive: true });
    return Promise.all(files.map(async (file, index) => {
      const destination = path.join(this.uploadDir, `${inspectionId}-${index + 1}${extensions[file.mimetype]}`);
      await fs.writeFile(destination, file.buffer, { flag: "wx" });
      return destination;
    }));
  }
}
