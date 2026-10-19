import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { LoadingService } from '../../services/loading.service';

@Component({
  selector: 'app-loading-overlay',
  imports: [NgOptimizedImage],
  templateUrl: './loading-overlay.html',
  styleUrl: './loading-overlay.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingOverlay {
  protected readonly loading = inject(LoadingService);
}
