import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { JsonPipe, NgForOf } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { ExpenseTableComponent } from './expense-table/expense-table.component';

interface TimelineEntry {
  label: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    JsonPipe,
    NgForOf,
    MatTableModule,
    ExpenseTableComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  timeline: TimelineEntry[] = [];

  private readonly months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];

  ngOnInit(): void {
    const d = new Date();
    d.setDate(1);
    for (let i = 0; i < 12; i++) {
      this.timeline.push({
        label:
          this.months[d.getMonth()] +
          ' ' +
          d.getFullYear().toString().substring(2, 4),
      });
      d.setMonth(d.getMonth() + 1);
    }
  }
}
