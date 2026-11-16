
import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaDetectionService } from '../../core/services/pwa-detection.service';
import { MobileBottomNav } from '../mobile-bottom-nav/mobile-bottom-nav';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    Sidebar,
    Topbar,
    MobileBottomNav,
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  private readonly pwaDetection = inject(PwaDetectionService);
  private readonly clientReady = signal(false);

  readonly sidebarCollapsed = signal(false);
  readonly mobileSidebarOpen = signal(false);
  readonly showBottomNav = computed(
    () => this.clientReady() && this.pwaDetection.isInstalledCompactPwa(),
  );

  constructor() {
    afterNextRender(() => {
      this.clientReady.set(true);
    });
  }

  toggleSidebar(): void {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
      this.mobileSidebarOpen.update(open => !open);
      return;
    }

    this.sidebarCollapsed.update(collapsed => !collapsed);
  }

  closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update(open => !open);
  }
}
