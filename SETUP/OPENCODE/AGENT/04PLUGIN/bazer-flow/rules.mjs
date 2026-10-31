/* Shared 2ad rules: danger commands, extra protected paths, credential mentions, redaction. */

export const DANGER = [
  /git\s+push\b[^\n]*\s(?:--force\w*|-f\w*|\+[A-Za-z0-9_.\/-]+|--delete)\b/i,
  /git\s+reset\s+--hard\b/i,
  /git\s+clean\s+-[a-z]*f/i,
  /git\s+branch\b[^\n]*(?:\s-D(?:\s|$)|--delete\s+--force)/i,
  /(?:^|[;&|{(])\s*(?:format(?:\.(?:com|exe))?|format-volume|diskpart)(?=\s|$)/i,
  /(?:^|[;&|{(])\s*(?:clear-disk|remove-partition|initialize-disk)(?=\s|$)/i,
  /(?:^|[;&|{(\s])reg(?:\.exe)?\s+(?:add|delete)\b/i,
  /(?:^|[;&|{(\s])set-itemproperty\b[^\n]*(?:hklm:|hkcu:|registry::)/i,
  /(?:^|[;&|{(\s])(?:add|set)-mppreference\b[^\n]*-(?:exclusionpath|exclusionprocess|exclusionextension|exclusionipaddress)/i,
  /(?:^|[;&|{(\s])start-process\b[^\n]*-verb\s+runas\b/i,
  /\b(?:127\.0\.0\.1|localhost):431[0-9]\b[^\n]*(?:\/api\/|api\/)/i,
  /(?:iwr|invoke-webrequest|curl|wget)\b[^\n|]*\|\s*(?:iex|invoke-expression|sh|bash)\b/i,
];

const EXTRA = [
  /(^|\/)\.opencode(\/|$)/,
  /(^|\/)opencode\.jsonc?$/,
  /(^|\/)\.git\/hooks(\/|$)/,
  /(^|\/)\.husky(\/|$)/,
  /(^|\/)var\/token-\d+$/,
];
const CRED = /(?:\.local[\\/]share[\\/]opencode[\\/][^\s"']*auth\.json|(?:^|[\\/"'\s])var[\\/]token-\d+)/i;

export function extraProtected(norm) { return EXTRA.some((re) => re.test(String(norm || ''))); }
export function credentialPath(s) { return CRED.test(String(s || '').replace(/\\/g, '/')); }
export function credentialMention(s) { return credentialPath(s); }

/** Strip controls and redact values after token/key/password/secret/authorization; cap 80. */
export function redact(text) {
  return String(text == null ? '' : text)
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\b(token|key|password|secret|authorization)\b\s*[:=]?\s*([^\s&;|]+)/gi, '$1=***')
    .slice(0, 80);
}
