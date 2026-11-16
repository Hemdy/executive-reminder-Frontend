import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AppSelect, SelectOption } from './app-select';

@Component({
  standalone: true,
  imports: [AppSelect, ReactiveFormsModule],
  template: `
    <app-select
      [options]="options"
      [value]="boundValue()"
      (valueChange)="boundValue.set($event)"
      ariaLabel="Status filter"
    />
    <app-select
      [options]="options"
      [formControl]="control"
      [searchable]="true"
      ariaLabel="Form select"
    />
  `,
})
class TestHostComponent {
  readonly options: SelectOption[] = [
    { value: 'ALL', label: 'All statuses' },
    { value: 'PENDING', label: 'Pending', dotColor: '#b7791f' },
    { value: 'COMPLETED', label: 'Completed', dotColor: '#218739' },
  ];
  readonly boundValue = signal('ALL');
  readonly control = new FormControl('PENDING', { nonNullable: true });
}

describe('AppSelect', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('binds via [value] and (valueChange)', () => {
    const triggers = fixture.nativeElement.querySelectorAll('.select-trigger') as NodeListOf<HTMLButtonElement>;
    expect(triggers[0].textContent).toContain('All statuses');

    triggers[0].click();
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('.select-option') as NodeListOf<HTMLButtonElement>;
    expect(options.length).toBe(3);
    expect(options[0].getAttribute('aria-selected')).toBe('true');

    options[2].click();
    fixture.detectChanges();

    expect(host.boundValue()).toBe('COMPLETED');
    expect(triggers[0].textContent).toContain('Completed');
  });

  it('integrates with Reactive Forms via ControlValueAccessor', () => {
    const triggers = fixture.nativeElement.querySelectorAll('.select-trigger') as NodeListOf<HTMLButtonElement>;
    expect(triggers[1].textContent).toContain('Pending');

    triggers[1].click();
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('.select-option') as NodeListOf<HTMLButtonElement>;
    options[2].click();
    fixture.detectChanges();

    expect(host.control.value).toBe('COMPLETED');
    expect(host.control.touched).toBe(true);

    host.control.disable();
    fixture.detectChanges();
    expect(triggers[1].disabled).toBe(true);
  });

  it('supports keyboard navigation, search filtering, and outside-click close', () => {
    const triggers = fixture.nativeElement.querySelectorAll('.select-trigger') as NodeListOf<HTMLButtonElement>;
    const formTrigger = triggers[1];

    formTrigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    fixture.detectChanges();

    expect(formTrigger.getAttribute('aria-expanded')).toBe('true');

    const searchInput = fixture.nativeElement.querySelector('.select-search-input') as HTMLInputElement;
    expect(searchInput).toBeTruthy();
    searchInput.value = 'comp';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const filteredOptions = fixture.nativeElement.querySelectorAll('.select-option') as NodeListOf<HTMLButtonElement>;
    expect(filteredOptions.length).toBe(1);
    expect(filteredOptions[0].textContent).toContain('Completed');

    // Outside click closes menu
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(formTrigger.getAttribute('aria-expanded')).toBe('false');
  });
});
