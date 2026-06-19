const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Short, URL-safe, in-memory id. Collision-resistant enough for a single
 * package's element set. Not cryptographic, not persisted to `.sysml`.
 */
export function shortId(length = 8): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
