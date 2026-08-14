// slate-500 (inactive label color) <-> white (active), blended by `t` (0-1). A plain
// RGB lerp rather than `color-mix()` so this stays trivially predictable — no
// interpolation-space surprises — for a value that's recomputed on every pointermove
// during a drag. Shared by both levers (ModeSwitch's Production/Recognition track and
// ScopeSwitch's Scope/Search track) so their label colors blend identically.
const INACTIVE_RGB: [number, number, number] = [100, 116, 139];

export function lerpLabelColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const [r, g, b] = INACTIVE_RGB.map(c => Math.round(c + clamped * (255 - c)));
  return `rgb(${r}, ${g}, ${b})`;
}
