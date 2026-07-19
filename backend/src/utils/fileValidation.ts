import fs from 'fs';

/**
 * Sanitizes a filename to prevent path traversal and invalid characters.
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 200);
}

/**
 * Magic-byte signatures for the audio/image formats accepted by beat and
 * stem uploads. multer's fileFilter only sees the client-supplied
 * Content-Type header, which is trivially spoofable (e.g. an .exe renamed
 * with Content-Type: audio/mpeg passes it) - checking actual bytes catches
 * that, since these files are either served back publicly (beats) or
 * downloaded by admin (stems).
 */
const FILE_SIGNATURES: Array<{ bytes: number[]; offset?: number }> = [
  { bytes: [0x49, 0x44, 0x33] }, // MP3 (ID3)
  { bytes: [0xff, 0xfb] }, // MP3 (no ID3, MPEG-1 Layer 3)
  { bytes: [0xff, 0xf3] }, // MP3 (MPEG-2 Layer 3)
  { bytes: [0xff, 0xf2] }, // MP3 (MPEG-2.5 Layer 3)
  { bytes: [0x52, 0x49, 0x46, 0x46] }, // WAV/RIFF container (also matches WebP)
  { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // MP4/M4A (ftyp box)
  { bytes: [0x4f, 0x67, 0x67, 0x53] }, // OGG
  { bytes: [0xff, 0xd8, 0xff] }, // JPEG
  { bytes: [0x89, 0x50, 0x4e, 0x47] }, // PNG
  { bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF
];

/**
 * Checks a buffer's leading bytes against the known signatures above.
 * Used for in-memory (multer memoryStorage) uploads.
 */
export function hasKnownFileSignatureBuffer(buffer: Buffer): boolean {
  return FILE_SIGNATURES.some(({ bytes, offset = 0 }) =>
    bytes.every((byte, i) => buffer[offset + i] === byte)
  );
}

/**
 * Reads the first 16 bytes of a file on disk and checks them against the
 * known signatures above. Used for disk-storage (multer diskStorage)
 * uploads.
 */
export function hasKnownFileSignatureFile(filePath: string): boolean {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(16);
    fs.readSync(fd, buffer, 0, 16, 0);
    return hasKnownFileSignatureBuffer(buffer);
  } finally {
    fs.closeSync(fd);
  }
}
