import { Component, input, computed } from '@angular/core';
import { initialsOf } from '../initials';

interface Tint { bg: string; color: string; border: string; }

const TINT_DEFAULT: Tint = { bg: '#f4f6f9', color: '#475569', border: '#e6eaf0' };
const TINT_MAP: [string, Tint][] = [
  ['lin',      { bg: '#eafaf1', color: '#0f7a4f', border: '#cdeedd' }],
  ['okafor',   { bg: '#f3eefe', color: '#6b4fc7', border: '#e4d9fb' }],
  ['medicare', { bg: '#f3eefe', color: '#6b4fc7', border: '#e4d9fb' }],
  ['aetna',    { bg: '#eef3fe', color: '#2a5fd0', border: '#d6e2fb' }],
  ['cigna',    { bg: '#eafaf1', color: '#0f7a4f', border: '#cdeedd' }],
  ['united',   { bg: '#fdf5e9', color: '#9a6212', border: '#f3e2c4' }],
];

function resolveTint(source: string): Tint {
  const s = source.toLowerCase();
  return TINT_MAP.find(([key]) => s.includes(key))?.[1] ?? TINT_DEFAULT;
}

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <div
      [class]="cssClass()"
      [style.background]="tint().bg"
      [style.color]="tint().color"
      [style.borderColor]="tint().border"
    >{{ initials() }}</div>
  `,
  host: { style: 'display:contents' },
})
export class AvatarComponent {
  /** Display name — drives initials. */
  readonly name     = input.required<string>();
  /** Optional separate source for tint color (e.g. pass payer name while name is the patient name). */
  readonly tintName = input<string>('');
  readonly cssClass = input<string>('');

  protected readonly initials = computed(() => initialsOf(this.name()));

  protected readonly tint = computed<Tint>(() =>
    resolveTint(this.tintName() || this.name())
  );
}
