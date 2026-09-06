

import { Component, inject } from '@angular/core';
import { AuthService } from '../../../../core/services/auth.service';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ceo-dashboard',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './ceo-dashboard.html',
  styleUrl: './ceo-dashboard.scss',
})
export class CeoDashboard {


  readonly authService = inject(AuthService);

  readonly summary = [
    {
      label: 'Pending',
      value: 24,
      description: 'Items awaiting action'
    },
    {
      label: 'Overdue',
      value: 5,
      description: 'Require attention'
    },
    {
      label: 'Today',
      value: 8,
      description: 'Items due today'
    },
    {
      label: 'Completed',
      value: 42,
      description: 'Completed this month'
    }
  ];

  readonly schedule = [
    {
      time: '09:00 AM',
      title: 'Executive Board Meeting',
      type: 'Meeting'
    },
    {
      time: '11:30 AM',
      title: 'Budget Proposal Review',
      type: 'Review'
    },
    {
      time: '02:00 PM',
      title: 'Strategy Meeting',
      type: 'Meeting'
    }
  ];

  readonly attentionItems = [
    {
      title: 'Laptop Purchase Approval',
      type: 'Approval Request',
      priority: 'URGENT'
    },
    {
      title: 'Q3 Financial Report',
      type: 'Overdue Task',
      priority: 'HIGH'
    },
    {
      title: 'Annual Contract Review',
      type: 'Document Review',
      priority: 'MEDIUM'
    }
  ];
}
