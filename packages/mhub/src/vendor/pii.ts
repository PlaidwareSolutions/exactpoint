/**
 * Client-side PII pre-filter — mirrors the server's ingestion denylist
 * (server/src/events/ingest.ts). The server enforces regardless; filtering
 * here keeps PII off the wire entirely and surfaces mistakes to the client
 * app's developers immediately.
 *
 * `caller_e164` passes through: it is a PII-permitted TRANSIENT the server
 * consumes for call↔lead matching and never stores (DESIGN §16).
 */
export const PII_TOKEN =
  /(^|_)(name|first|last|email|phone|mobile|address|street|dob|birth|ssn|notes?|comments?|message|description)($|_)/i;

export interface FilterResult {
  clean: Record<string, unknown>;
  stripped: string[];
}

export function filterAttrs(
  attrs: Record<string, unknown>,
  allowlist: readonly string[] = []
): FilterResult {
  const allow = new Set(allowlist);
  const clean: Record<string, unknown> = {};
  const stripped: string[] = [];
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'caller_e164' || allow.has(key) || !PII_TOKEN.test(key)) clean[key] = value;
    else stripped.push(key);
  }
  return { clean, stripped };
}
