// Remove APP1 segments (EXIF/GPS and XMP) without decoding image pixels.
// Malformed segment lengths fail closed. Scan data is copied byte-for-byte.
export function stripJPEGMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 255 || bytes[1] !== 216) throw Error('Invalid JPEG.');
  const parts: Uint8Array[] = [bytes.slice(0, 2)]; let at = 2;
  while (at < bytes.length) {
    const start = at;
    if (bytes[at++] !== 255) throw Error('Invalid JPEG segment.');
    while (bytes[at] === 255) at++;
    const marker = bytes[at++];
    if (marker === 0xda || marker === 0xd9) { parts.push(bytes.slice(start)); break; }
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) { parts.push(bytes.slice(start, at)); continue; }
    if (at + 2 > bytes.length) throw Error('Truncated JPEG.');
    const length = bytes[at] * 256 + bytes[at + 1];
    if (length < 2 || at + length > bytes.length) throw Error('Invalid JPEG segment length.');
    if (marker !== 0xe1) parts.push(bytes.slice(start, at + length));
    at += length;
  }
  const result = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
