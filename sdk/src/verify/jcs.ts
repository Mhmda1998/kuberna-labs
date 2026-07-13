export function jcsCanonicalize(value: unknown): string {
  return canonicalize(value);
}

function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return numberCanonical(value);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return stringCanonical(value);
  if (Array.isArray(value)) return arrayCanonical(value);
  if (typeof value === 'object') return objectCanonical(value as Record<string, unknown>);
  return 'null';
}

function numberCanonical(n: number): string {
  if (!isFinite(n)) throw new Error('JCS does not support Infinity or NaN');
  if (Number.isInteger(n) && Math.abs(n) <= Number.MAX_SAFE_INTEGER) return n.toString();
  const s = n.toExponential().replace(/e\+?0*/, 'e');
  return s;
}

function stringCanonical(s: string): string {
  let result = '"';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x20) {
      switch (cp) {
        case 0x08: result += '\\b'; break;
        case 0x09: result += '\\t'; break;
        case 0x0a: result += '\\n'; break;
        case 0x0c: result += '\\f'; break;
        case 0x0d: result += '\\r'; break;
        default: result += `\\u${cp.toString(16).padStart(4, '0')}`;
      }
    } else if (cp === 0x22) {
      result += '\\"';
    } else if (cp === 0x5c) {
      result += '\\\\';
    } else if (cp >= 0x20 && cp <= 0x7e) {
      result += ch;
    } else if (cp <= 0xffff) {
      result += `\\u${cp.toString(16).padStart(4, '0')}`;
    } else {
      const hi = 0xd800 + ((cp - 0x10000) >> 10);
      const lo = 0xdc00 + ((cp - 0x10000) & 0x3ff);
      result += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
    }
  }
  return result + '"';
}

function arrayCanonical(arr: unknown[]): string {
  const items = arr.map(canonicalize);
  return '[' + items.join(',') + ']';
}

function objectCanonical(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(k => stringCanonical(k) + ':' + canonicalize(obj[k]));
  return '{' + pairs.join(',') + '}';
}

export function jcsHash(value: unknown): Promise<string> {
  const canonical = jcsCanonicalize(value);
  return sha256Hex(canonical);
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
