/** Lightweight in-repo fingerprint (not cryptographic attestation). */
export function fingerprintText(parts: string[]): string {
  let hash = 5381;
  for (const part of parts) {
    for (let i = 0; i < part.length; i += 1) {
      hash = (hash * 33) ^ part.charCodeAt(i);
    }
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
