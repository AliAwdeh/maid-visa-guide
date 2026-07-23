/**
 * Unguessable, URL-safe public identifier for a generated guide. 16 random
 * bytes → 22-char base64url. This is what appears in /Views/<token>; the real
 * CLIENT_ID never leaves the database.
 */
export function newToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}
