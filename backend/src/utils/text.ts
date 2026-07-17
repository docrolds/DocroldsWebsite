/**
 * Shared string-handling helpers used across route files (email validation,
 * HTML-escaping for email templates).
 */

/**
 * Validates email format. Rejects `<`, `>`, `"`, `'` in addition to the
 * basic shape check, since a permissive regex here would otherwise let an
 * email containing HTML metacharacters reach places it gets interpolated
 * into HTML (e.g. admin notification emails) - escaping on output is the
 * primary defense, but this closes the gap at the source too.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
  return emailRegex.test(email);
}

/**
 * Escapes HTML special characters for safe interpolation into email
 * templates built from user-supplied strings (names, notes, reasons).
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
