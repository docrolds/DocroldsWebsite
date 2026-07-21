/**
 * Generates a consistent gradient class (gradient-1..gradient-10, defined
 * in App.css) for a beat's placeholder artwork based on its id, so the
 * same beat always gets the same placeholder color across pages. Shared
 * by Beats.tsx (homepage widget) and BeatsPage.tsx (full catalog) - was
 * previously duplicated verbatim in both.
 */
export function getGradientClass(beatId: string | number): string {
  const hash = String(beatId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `gradient-${(hash % 10) + 1}`;
}
