import { Component, input, computed } from '@angular/core';

interface Tint { bg: string; color: string; border: string; }

function tintByName(name: string): Tint {
  const n = name.toLowerCase();
  if (n.includes('lin'))    return { bg: '#eafaf1', color: '#0f7a4f', border: '#cdeedd' };
  if (n.includes('okafor')) return { bg: '#f3eefe', color: '#6b4fc7', border: '#e4d9fb' };
  return                           { bg: '#eef3fe', color: '#2a5fd0', border: '#d6e2fb' };
}

function tintByPayer(payer: string): Tint {
  const p = payer.toLowerCase();
  if (p.includes('medicare')) return { bg: '#f3eefe', color: '#6b4fc7', border: '#e4d9fb' };
  if (p.includes('aetna'))    return { bg: '#eef3fe', color: '#2a5fd0', border: '#d6e2fb' };
  if (p.includes('cigna'))    return { bg: '#eafaf1', color: '#0f7a4f', border: '#cdeedd' };
  if (p.includes('united'))   return { bg: '#fdf5e9', color: '#9a6212', border: '#f3e2c4' };
  return                             { bg: '#f4f6f9', color: '#475569', border: '#e6eaf0' };
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
  readonly tintBy   = input<'name' | 'payer'>('name');
  readonly cssClass = input<string>('');

  protected readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return parts.map(w => w[0]).slice(-2).join('').toUpperCase();
  });

  protected readonly tint = computed<Tint>(() => {
    const source = this.tintName() || this.name();
    return this.tintBy() === 'payer' ? tintByPayer(source) : tintByName(source);
  });
}
