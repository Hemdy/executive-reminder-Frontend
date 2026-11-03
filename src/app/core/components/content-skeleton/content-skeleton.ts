import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-content-skeleton',
  standalone: true,
  templateUrl: './content-skeleton.html',
  styleUrl: './content-skeleton.scss',
})
export class ContentSkeleton {
  @Input() kind: 'table' | 'list' | 'dashboard' | 'form' = 'table';
  readonly rows = Array.from({ length: 5 }, (_, index) => index);
  readonly summaryCards = Array.from({ length: 4 }, (_, index) => index);
  readonly dashboardCards = Array.from({ length: 6 }, (_, index) => index);
  readonly formSections = Array.from({ length: 2 }, (_, index) => index);
  readonly formFields = Array.from({ length: 4 }, (_, index) => index);
}
