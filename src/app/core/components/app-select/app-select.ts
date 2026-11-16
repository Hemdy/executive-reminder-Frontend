import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  forwardRef,
  HostListener,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  description?: string;
  icon?: string;
  dotColor?: string;
  disabled?: boolean;
}

interface MenuCoordinates {
  top: number | null;
  bottom: number | null;
  left: number;
  minWidth: number;
  maxHeight: number;
  openUpward: boolean;
}

let nextSelectId = 0;

@Component({
  selector: 'app-select',
  standalone: true,
  templateUrl: './app-select.html',
  styleUrl: './app-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppSelect),
      multi: true,
    },
  ],
})
export class AppSelect implements ControlValueAccessor {
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly triggerButton = viewChild<ElementRef<HTMLButtonElement>>('triggerBtn');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInputEl');

  readonly options = input<readonly SelectOption<string>[]>([]);
  readonly value = input<string | undefined>(undefined);
  readonly placeholder = input<string>('Select an option');
  readonly inputId = input<string>('');
  readonly ariaLabel = input<string>('');
  readonly disabled = input<boolean>(false);
  readonly invalid = input<boolean>(false);
  readonly size = input<'md' | 'sm'>('md');
  readonly variant = input<'default' | 'ghost'>('default');
  readonly leadingIcon = input<string>('');
  readonly leadingDotColor = input<string>('');
  readonly searchable = input<boolean>(false);
  readonly searchPlaceholder = input<string>('Search options...');

  readonly valueChange = output<string>();

  readonly instanceId = `app-select-${++nextSelectId}`;
  readonly listboxId = `${this.instanceId}-listbox`;

  private readonly cvaValue = signal<string>('');
  private readonly cvaDisabled = signal<boolean>(false);

  readonly isOpen = signal<boolean>(false);
  readonly searchTerm = signal<string>('');
  readonly highlightedIndex = signal<number>(-1);
  readonly menuCoords = signal<MenuCoordinates>({
    top: null,
    bottom: null,
    left: 0,
    minWidth: 180,
    maxHeight: 260,
    openUpward: false,
  });

  readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());
  readonly currentValue = computed(() => {
    const bound = this.value();
    return bound !== undefined ? bound : this.cvaValue();
  });

  readonly selectedOption = computed(() => {
    const val = this.currentValue();
    return this.options().find((opt) => opt.value === val) ?? null;
  });

  readonly filteredOptions = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return this.options();
    }
    return this.options().filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.description?.toLowerCase().includes(term) ?? false),
    );
  });

  readonly displayLabel = computed(() => {
    const selected = this.selectedOption();
    if (selected) {
      return selected.label;
    }
    return this.placeholder();
  });

  readonly isPlaceholderShown = computed(() => {
    const selected = this.selectedOption();
    return !selected || selected.value === '';
  });

  readonly resolvedDotColor = computed(
    () => this.selectedOption()?.dotColor || this.leadingDotColor(),
  );

  readonly resolvedIcon = computed(
    () => this.selectedOption()?.icon || this.leadingIcon(),
  );

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private removeWindowListeners: (() => void) | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.detachWindowListeners();
    });
  }

  writeValue(value: string | null): void {
    this.cvaValue.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
    if (isDisabled && this.isOpen()) {
      this.closeMenu(false);
    }
  }

  toggleMenu(): void {
    if (this.isDisabled()) {
      return;
    }

    if (this.isOpen()) {
      this.closeMenu(true);
    } else {
      this.openMenu();
    }
  }

  openMenu(): void {
    if (this.isDisabled() || this.isOpen()) {
      return;
    }

    this.searchTerm.set('');
    this.updateMenuPosition();
    this.isOpen.set(true);

    const activeIdx = this.filteredOptions().findIndex(
      (opt) => opt.value === this.currentValue() && !opt.disabled,
    );
    this.highlightedIndex.set(
      activeIdx >= 0
        ? activeIdx
        : this.filteredOptions().findIndex((opt) => !opt.disabled),
    );

    this.attachWindowListeners();

    if (this.searchable() && this.isBrowser) {
      setTimeout(() => {
        this.searchInput()?.nativeElement.focus();
      }, 0);
    }
  }

  closeMenu(markTouched = true): void {
    if (!this.isOpen()) {
      return;
    }

    this.isOpen.set(false);
    this.searchTerm.set('');
    this.highlightedIndex.set(-1);
    this.detachWindowListeners();

    if (markTouched) {
      this.onTouched();
    }
  }

  selectOption(option: SelectOption<string>): void {
    if (option.disabled) {
      return;
    }

    this.cvaValue.set(option.value);
    this.onChange(option.value);
    this.onTouched();
    this.valueChange.emit(option.value);
    this.closeMenu(false);
    this.triggerButton()?.nativeElement.focus();
  }

  onSearchInput(value: string): void {
    this.searchTerm.set(value);
    const firstEnabled = this.filteredOptions().findIndex((opt) => !opt.disabled);
    this.highlightedIndex.set(firstEnabled);
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.isDisabled()) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.isOpen()) {
          this.openMenu();
        } else {
          this.moveHighlight(1);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.isOpen()) {
          this.openMenu();
        } else {
          this.moveHighlight(-1);
        }
        break;
      case 'Home':
        if (this.isOpen()) {
          event.preventDefault();
          this.moveHighlightToEdge('start');
        }
        break;
      case 'End':
        if (this.isOpen()) {
          event.preventDefault();
          this.moveHighlightToEdge('end');
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!this.isOpen()) {
          this.openMenu();
        } else {
          const highlighted = this.filteredOptions()[this.highlightedIndex()];
          if (highlighted && !highlighted.disabled) {
            this.selectOption(highlighted);
          }
        }
        break;
      case 'Escape':
        if (this.isOpen()) {
          event.preventDefault();
          this.closeMenu(true);
        }
        break;
      case 'Tab':
        if (this.isOpen()) {
          this.closeMenu(true);
        } else {
          this.onTouched();
        }
        break;
    }
  }

  onMenuKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveHighlight(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveHighlight(-1);
        break;
      case 'Enter':
        event.preventDefault();
        {
          const highlighted = this.filteredOptions()[this.highlightedIndex()];
          if (highlighted && !highlighted.disabled) {
            this.selectOption(highlighted);
          }
        }
        break;
      case 'Escape':
        event.preventDefault();
        this.closeMenu(true);
        this.triggerButton()?.nativeElement.focus();
        break;
      case 'Tab':
        this.closeMenu(true);
        break;
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: Event): void {
    if (!this.isOpen()) {
      return;
    }

    const target = event.target as Node | null;
    if (target && !this.hostRef.nativeElement.contains(target)) {
      this.closeMenu(true);
    }
  }

  private moveHighlight(delta: 1 | -1): void {
    const items = this.filteredOptions();
    if (!items.length) {
      this.highlightedIndex.set(-1);
      return;
    }

    let index = this.highlightedIndex();
    for (let step = 0; step < items.length; step++) {
      index = (index + delta + items.length) % items.length;
      if (!items[index].disabled) {
        this.highlightedIndex.set(index);
        return;
      }
    }
  }

  private moveHighlightToEdge(edge: 'start' | 'end'): void {
    const items = this.filteredOptions();
    if (!items.length) {
      this.highlightedIndex.set(-1);
      return;
    }

    if (edge === 'start') {
      const idx = items.findIndex((opt) => !opt.disabled);
      this.highlightedIndex.set(idx);
      return;
    }

    for (let idx = items.length - 1; idx >= 0; idx--) {
      if (!items[idx].disabled) {
        this.highlightedIndex.set(idx);
        return;
      }
    }
  }

  private updateMenuPosition(): void {
    if (!this.isBrowser) {
      return;
    }

    const view = this.document.defaultView;
    const triggerEl = this.triggerButton()?.nativeElement;
    if (!view || !triggerEl) {
      return;
    }

    const rect = triggerEl.getBoundingClientRect();
    const viewportWidth = view.innerWidth || 1024;
    const viewportHeight = view.innerHeight || 768;
    const spaceBelow = Math.max(0, viewportHeight - rect.bottom - 12);
    const spaceAbove = Math.max(0, rect.top - 12);
    const openUpward = spaceBelow < 200 && spaceAbove > spaceBelow;

    const minWidth = Math.min(Math.max(rect.width, 190), Math.max(190, viewportWidth - 16));
    const maxLeft = Math.max(8, viewportWidth - minWidth - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);
    const maxHeight = Math.min(
      280,
      Math.max(140, openUpward ? spaceAbove : spaceBelow),
    );

    this.menuCoords.set({
      top: openUpward ? null : Math.max(8, rect.bottom + 6),
      bottom: openUpward ? Math.max(8, viewportHeight - rect.top + 6) : null,
      left,
      minWidth,
      maxHeight,
      openUpward,
    });
  }

  private attachWindowListeners(): void {
    if (!this.isBrowser || this.removeWindowListeners) {
      return;
    }

    const view = this.document.defaultView;
    if (!view) {
      return;
    }

    const onReposition = (): void => {
      if (this.isOpen()) {
        this.updateMenuPosition();
      }
    };

    view.addEventListener('resize', onReposition);
    view.addEventListener('scroll', onReposition, true);

    this.removeWindowListeners = () => {
      view.removeEventListener('resize', onReposition);
      view.removeEventListener('scroll', onReposition, true);
      this.removeWindowListeners = null;
    };
  }

  private detachWindowListeners(): void {
    this.removeWindowListeners?.();
  }
}
