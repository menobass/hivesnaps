// Utility to detect if a post was created via the HiveSnaps app
// Accepts any object that may have json_metadata or posting_json_metadata
export function wasPostedViaHiveSnaps(input: {
  json_metadata?: unknown;
  posting_json_metadata?: unknown;
}): boolean {
  const tryParse = (val: unknown): any => {
    if (!val) return null;
    if (typeof val === 'object') return val as any;
    if (typeof val !== 'string') return null;
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  };

  // Prefer posting_json_metadata when present, fallback to json_metadata
  const meta =
    tryParse(input.posting_json_metadata) || tryParse(input.json_metadata) || null;

  const app: unknown = meta?.app;
  if (typeof app === 'string' && /hivesnaps/i.test(app)) return true;

  const client: unknown = meta?.client;
  if (typeof client === 'string' && /hivesnaps/i.test(client)) return true;

  // Fallback: some legacy content may include a friendly string marker
  const metaString =
    typeof input.json_metadata === 'string' ? input.json_metadata : '';
  if (/HiveSnaps\s*1\.0/i.test(metaString)) return true;

  return false;
}
