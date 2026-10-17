import fs from "fs/promises";
import path from "path";
import { ZipEntry } from "./zip";

export const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
export const AVATAR_UPLOAD_DIR = process.env.AVATAR_UPLOAD_DIR || "./uploads/avatars";

/**
 * Traverses a directory recursively and returns relative file paths and buffers.
 */
async function scanDirectoryRecursive(
  dirPath: string,
  basePath: string = ""
): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      const relativePath = path.join(basePath, item.name);

      if (item.isDirectory()) {
        const sub = await scanDirectoryRecursive(fullPath, relativePath);
        entries.push(...sub);
      } else if (item.isFile()) {
        const data = await fs.readFile(fullPath);
        entries.push({
          path: `uploads/${relativePath.replace(/\\/g, "/")}`,
          data,
        });
      }
    }
  } catch {
    // Directory might not exist yet, safe to ignore
  }
  return entries;
}

/**
 * Collects all uploaded media, documentation photos, avatars, and file attachments
 * to bundle into the backup.
 */
export async function collectAllUploadFiles(): Promise<{
  entries: ZipEntry[];
  totalFiles: number;
  totalBytes: number;
}> {
  const uploadResolved = path.resolve(process.cwd(), UPLOAD_DIR);
  const entries = await scanDirectoryRecursive(uploadResolved);

  let totalBytes = 0;
  for (const entry of entries) {
    totalBytes += entry.data.length;
  }

  return {
    entries,
    totalFiles: entries.length,
    totalBytes,
  };
}

/**
 * Restores all upload files from a backup back to their proper destination on disk.
 */
export async function restoreUploadFiles(
  entries: ZipEntry[]
): Promise<{ restoredCount: number; restoredBytes: number }> {
  let restoredCount = 0;
  let restoredBytes = 0;
  const uploadResolved = path.resolve(process.cwd(), UPLOAD_DIR);

  for (const entry of entries) {
    // Match any entry that begins with uploads/ or files/
    if (entry.path.startsWith("uploads/") || entry.path.startsWith("files/")) {
      const subPath = entry.path.replace(/^(uploads|files)\//, "");
      const targetDiskPath = path.join(uploadResolved, subPath);

      // Prevent directory traversal attacks
      if (!targetDiskPath.startsWith(uploadResolved)) {
        continue;
      }

      await fs.mkdir(path.dirname(targetDiskPath), { recursive: true });
      await fs.writeFile(targetDiskPath, entry.data);
      restoredCount++;
      restoredBytes += entry.data.length;
    }
  }

  return { restoredCount, restoredBytes };
}
