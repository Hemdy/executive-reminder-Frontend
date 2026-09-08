
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [  RouterOutlet,
    Sidebar,
    Topbar],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {

  readonly sidebarCollapsed = signal(false);
  readonly mobileSidebarOpen = signal(false);

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
