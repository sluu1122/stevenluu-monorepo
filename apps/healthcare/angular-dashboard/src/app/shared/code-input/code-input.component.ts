import {
  Component, DestroyRef, ElementRef, Input, computed, effect, forwardRef, inject,
  Injector, input, OnInit, output, signal, viewChild, ViewEncapsulation,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NgControl } from '@angular/forms';

export interface SuggestionItem {
  code: string;
  description: string;
}

@Component({
  selector: 'app-code-input',
  standalone: true,
  templateUrl: './code-input.component.html',
  encapsulation: ViewEncapsulation.None,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CodeInputComponent), multi: true },
  ],
})
export class CodeInputComponent implements ControlValueAccessor, OnInit {
  private readonly injector    = inject(Injector);
  private readonly destroyRef  = inject(DestroyRef);
  private readonly inputEl     = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  private destroyed = false;

  readonly suggestions = input<SuggestionItem[]>([]);
  readonly queryChange = output<string>();

  @Input() placeholder = 'Type code, press Enter…';
  @Input() inputId?: string;
  /** Explicit error override for group-level validators where the control itself is always valid. */
  @Input() hasError = false;

  protected readonly codes        = signal<string[]>([]);
  protected readonly disabled     = signal(false);
  protected readonly activeIdx    = signal(-1);
  protected readonly showDropdown = computed(() => this.suggestions().length > 0);

  protected ngControl: NgControl | null = null;

  private _onChange: (v: string[]) => void = () => {};
  private _onTouched: () => void = () => {};

  constructor() {
    this.destroyRef.onDestroy(() => { this.destroyed = true; });
    // Reset keyboard selection whenever the suggestions list changes.
    effect(() => { this.suggestions(); this.activeIdx.set(-1); });
  }

  ngOnInit(): void {
    // Deferred lookup avoids the NG_VALUE_ACCESSOR ↔ NgControl circular dependency.
    this.ngControl = this.injector.get(NgControl, null, { self: true, optional: true });
  }

  // --- ControlValueAccessor ---

  writeValue(codes: string[] | null): void {
    this.codes.set(codes ?? []);
  }

  registerOnChange(fn: (v: string[]) => void): void { this._onChange = fn; }
  registerOnTouched(fn: () => void): void          { this._onTouched = fn; }
  setDisabledState(isDisabled: boolean): void      { this.disabled.set(isDisabled); }

  // --- Internal logic ---

  private commit(raw: string): void {
    const current  = this.codes();
    const incoming = raw.split(/[,\s]+/)
      .map(s => s.trim().toUpperCase())
      .filter(s => s && !current.includes(s));
    if (!incoming.length) return;
    this.codes.set([...current, ...incoming]);
    this._onChange(this.codes());
    this._onTouched();
  }

  protected removeCode(code: string): void {
    this.codes.update(cs => cs.filter(c => c !== code));
    this._onChange(this.codes());
    this._onTouched();
  }

  protected selectSuggestion(s: SuggestionItem): void {
    this.commit(s.code);
    const el = this.inputEl()?.nativeElement;
    if (el) el.value = '';
    this.activeIdx.set(-1);
    this.queryChange.emit('');
  }

  protected onInput(event: Event): void {
    this.queryChange.emit((event.target as HTMLInputElement).value);
  }

  protected onKey(event: KeyboardEvent): void {
    const suggs = this.suggestions();

    if (suggs.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.activeIdx.update(i => Math.min(i + 1, suggs.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.activeIdx.update(i => Math.max(i - 1, -1));
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.activeIdx.set(-1);
        this.queryChange.emit('');
        return;
      }
    }

    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const el = event.target as HTMLInputElement;
      const ai = this.activeIdx();
      if (suggs.length > 0 && ai >= 0) {
        this.selectSuggestion(suggs[ai]);
      } else if (el.value.trim()) {
        this.commit(el.value);
        el.value = '';
        this.queryChange.emit('');
      }
    }
  }

  protected onBlur(event: FocusEvent): void {
    if (this.destroyed) return;
    const el = event.target as HTMLInputElement;
    if (el.value.trim()) { this.commit(el.value); el.value = ''; }
    this.queryChange.emit('');
    this._onTouched();
  }
}
