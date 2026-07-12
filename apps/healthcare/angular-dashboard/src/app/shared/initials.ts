export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.map(w => w[0]).slice(-2).join('').toUpperCase();
}
