import { Component, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { NgForOf } from '@angular/common';

interface Expense {
  name: string;
  type: 'fixed' | 'debt';
  valueMap: Map<string, string>;
}

@Component({
  selector: 'app-expense-table',
  standalone: true,
  imports: [MatTableModule, MatIconModule, NgForOf],
  templateUrl: './expense-table.component.html',
  styleUrl: './expense-table.component.scss',
})
export class ExpenseTableComponent implements OnInit {
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

  dataSource: Expense[] = [];
  displayedColumns: string[] = [];
  valueMapKeys: string[] = [];

  ngOnInit(): void {
    const name = 'Test123';
    const type = 'fixed';
    const valueMap = new Map<string, string>();

    const expense: Expense = {
      name,
      type,
      valueMap,
    };
    this.dataSource.push(expense);

    const d = new Date();
    d.setDate(1);
    for (let i = 0; i < 36; i++) {
      const shortMonth = this.months[d.getMonth()];
      const shortYear = d.getFullYear().toString().substring(2, 4);
      expense.valueMap.set(`${shortMonth} ${shortYear}`, 'value' + i);

      d.setMonth(d.getMonth() + 1);
    }

    this.valueMapKeys = Array.from(expense.valueMap.keys());

    this.displayedColumns = ['name', ...this.valueMapKeys, 'more'];
  }

  moreClick(): void {
    console.log('more clicked');
  }
}
