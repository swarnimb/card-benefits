/**
 * Card-face gradient helpers — ported verbatim from the design source
 * (`docs/design-source/Cards.jsx`). The design mock keyed the fill off an
 * issuer lookup; the real data carries a per-card hex (`card.defaultColor`),
 * so these operate directly on that hex.
 *
 * `cardGradient(hex)` is the design's vivid-top-left → dark-bottom-right depth
 * gradient: lighten 8% → base color 35% → darken 22%.
 */

/** Darken a #rrggbb hex toward black by `amount` (0..1), returning an rgb() string. */
export function darken(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = (n: number) => Math.max(0, Math.min(255, Math.round(n * (1 - amount))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** Lighten a #rrggbb hex toward white by `amount` (0..1), returning an rgb() string. */
export function lighten(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = (n: number) => Math.max(0, Math.min(255, Math.round(n + (255 - n) * amount)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

/** The design's 150deg depth gradient from a single base hex. */
export function cardGradient(hex: string): string {
  return `linear-gradient(150deg, ${lighten(hex, 0.08)} 0%, ${hex} 35%, ${darken(hex, 0.22)} 100%)`;
}
