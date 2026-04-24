/**
 * safe-redirect — sanitize user-supplied redirect targets.
 *
 * Two modes:
 *   - safeRedirectPath(next): accept only same-origin relative paths
 *     ("/dashboard"). Rejects "//evil.com", "/\evil.com", control chars, and
 *     any absolute URL. Use for auth callback `?next=` / `?redirect=` params.
 *   - safeRedirectUrl(target, allowedHosts, fallback): allow absolute URLs
 *     only if the host is in a known allowlist. Use for "leaving the site"
 *     flows where you must land on a specific external origin.
 *
 * Default-deny: anything we can't positively validate returns the fallback.
 * Dependency-free; copy across apps.
 */

export function safeRedirectPath(
  next: string | null | undefined,
  fallback = '/',
): string {
  if (!next) return fallback;
  // Protocol-relative (//evil.com) and backslash-smuggling (/\evil.com)
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback;
  // Must be a root-relative path
  if (!next.startsWith('/')) return fallback;
  // Backslashes: some browsers normalize to slashes — reject outright
  if (next.includes('\\')) return fallback;
  // Control characters (including NUL, CR, LF) — header injection surface
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(next)) return fallback;
  return next;
}

export function safeRedirectUrl(
  target: string | null | undefined,
  allowedHosts: string[],
  fallback: string,
): string {
  if (!target) return fallback;

  // Allow same-origin relative paths via the path validator.
  if (target.startsWith('/')) return safeRedirectPath(target, fallback);

  try {
    const url = new URL(target);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;
    if (!allowedHosts.some((h) => h === url.hostname)) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}
