import zlib from "zlib";

/**
 * High-performance, zero-dependency ZIP archive generator & parser
 * using Node.js standard built-in `node:zlib`.
 * Fully compatible with PKZIP 2.0 (Windows Explorer, WinRAR, 7-Zip, macOS, Linux).
 */

// Precomputed CRC32 table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

export function calculateCrc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  path: string;
  data: Buffer;
  mtime?: Date;
}

/**
 * Creates a standard .zip archive buffer from a list of file entries.
 */
export function createZipArchive(entries: ZipEntry[]): Buffer {
  const localFileChunks: Buffer[] = [];
  const centralDirectoryChunks: Buffer[] = [];
  let currentOffset = 0;

  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate();

  for (const entry of entries) {
    // Normalize path with forward slashes and trim leading slashes
    const cleanPath = entry.path.replace(/\\/g, "/").replace(/^\/+/, "");
    const nameBuffer = Buffer.from(cleanPath, "utf8");
    const uncompressedData = entry.data;
    const crc = calculateCrc32(uncompressedData);

    // Compress with raw deflate
    const compressedData = zlib.deflateRawSync(uncompressedData, { level: 6 });

    // 1. Local File Header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local header signature
    localHeader.writeUInt16LE(20, 4); // Version needed to extract (2.0)
    localHeader.writeUInt16LE(0x0800, 6); // General purpose flag: UTF-8 filename
    localHeader.writeUInt16LE(8, 8); // Compression method: 8 (Deflate)
    localHeader.writeUInt16LE(dosTime, 10); // Last mod file time
    localHeader.writeUInt16LE(dosDate, 12); // Last mod file date
    localHeader.writeUInt32LE(crc, 14); // CRC-32
    localHeader.writeUInt32LE(compressedData.length, 18); // Compressed size
    localHeader.writeUInt32LE(uncompressedData.length, 22); // Uncompressed size
    localHeader.writeUInt16LE(nameBuffer.length, 26); // Filename length
    localHeader.writeUInt16LE(0, 28); // Extra field length

    localFileChunks.push(localHeader, nameBuffer, compressedData);

    // 2. Central Directory Header (46 bytes + filename)
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0); // Central directory signature
    cdHeader.writeUInt16LE(20, 4); // Version made by (2.0)
    cdHeader.writeUInt16LE(20, 6); // Version needed to extract (2.0)
    cdHeader.writeUInt16LE(0x0800, 8); // General purpose flag: UTF-8
    cdHeader.writeUInt16LE(8, 10); // Compression method: 8
    cdHeader.writeUInt16LE(dosTime, 12); // Last mod file time
    cdHeader.writeUInt16LE(dosDate, 14); // Last mod file date
    cdHeader.writeUInt32LE(crc, 16); // CRC-32
    cdHeader.writeUInt32LE(compressedData.length, 20); // Compressed size
    cdHeader.writeUInt32LE(uncompressedData.length, 24); // Uncompressed size
    cdHeader.writeUInt16LE(nameBuffer.length, 28); // Filename length
    cdHeader.writeUInt16LE(0, 30); // Extra field length
    cdHeader.writeUInt16LE(0, 32); // File comment length
    cdHeader.writeUInt16LE(0, 34); // Disk number start
    cdHeader.writeUInt16LE(0, 36); // Internal file attributes
    cdHeader.writeUInt32LE(0x81a40000, 38); // External file attributes (regular file rw-r--r--)
    cdHeader.writeUInt32LE(currentOffset, 42); // Relative offset of local header

    centralDirectoryChunks.push(cdHeader, nameBuffer);

    currentOffset += 30 + nameBuffer.length + compressedData.length;
  }

  const centralDirectoryStart = currentOffset;
  let centralDirectorySize = 0;
  for (const chunk of centralDirectoryChunks) {
    centralDirectorySize += chunk.length;
  }

  // 3. End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4); // Number of this disk
  eocd.writeUInt16LE(0, 6); // Disk where central directory starts
  eocd.writeUInt16LE(entries.length, 8); // Entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // Total entries
  eocd.writeUInt32LE(centralDirectorySize, 12); // Size of central directory
  eocd.writeUInt32LE(centralDirectoryStart, 16); // Offset of start of central directory
  eocd.writeUInt16LE(0, 20); // ZIP file comment length

  return Buffer.concat([
    ...localFileChunks,
    ...centralDirectoryChunks,
    eocd,
  ]);
}

/**
 * Parses and extracts all files from a standard .zip archive buffer.
 */
export function parseZipArchive(buffer: Buffer): ZipEntry[] {
  if (buffer.length < 22) {
    throw new Error("Berkas ZIP tidak valid: ukuran berkas terlalu kecil.");
  }

  // Find End of Central Directory Record (EOCD: 0x06054b50) scanning backwards
  let eocdOffset = -1;
  const searchLimit = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= searchLimit; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("Berkas ZIP tidak valid: header EOCD tidak ditemukan.");
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  const files: ZipEntry[] = [];
  let currentPos = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (buffer.readUInt32LE(currentPos) !== 0x02014b50) {
      throw new Error(`Header Central Directory rusak pada entri ke-${i + 1}`);
    }

    const compressionMethod = buffer.readUInt16LE(currentPos + 10);
    const compressedSize = buffer.readUInt32LE(currentPos + 20);
    const filenameLength = buffer.readUInt16LE(currentPos + 28);
    const extraLength = buffer.readUInt16LE(currentPos + 30);
    const commentLength = buffer.readUInt16LE(currentPos + 32);
    const localHeaderOffset = buffer.readUInt32LE(currentPos + 42);

    const filename = buffer
      .subarray(currentPos + 46, currentPos + 46 + filenameLength)
      .toString("utf8")
      .replace(/\\/g, "/");

    // Read from local header to skip variable local extra field
    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Header lokal berkas "${filename}" tidak valid.`);
    }

    const localFilenameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart =
      localHeaderOffset + 30 + localFilenameLength + localExtraLength;
    const compressedData = buffer.subarray(
      dataStart,
      dataStart + compressedSize
    );

    // Skip directory entries ending with '/'
    if (!filename.endsWith("/")) {
      let data: Buffer;
      if (compressionMethod === 0) {
        // Stored (no compression)
        data = Buffer.from(compressedData);
      } else if (compressionMethod === 8) {
        // Deflated
        data = zlib.inflateRawSync(compressedData);
      } else {
        throw new Error(
          `Metode kompresi ${compressionMethod} pada "${filename}" tidak didukung.`
        );
      }

      files.push({
        path: filename,
        data,
      });
    }

    currentPos += 46 + filenameLength + extraLength + commentLength;
  }

  return files;
}
