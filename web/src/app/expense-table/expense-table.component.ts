import { Component, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { CurrencyPipe, NgForOf } from '@angular/common';

enum ExpenseType {
  Fixed,
}

interface Expense {
  name: string;
  type: ExpenseType;
  valueMap: Map<string, string>;
}

@Component({
  selector: 'app-expense-table',
  standalone: true,
  imports: [MatTableModule, MatIconModule, NgForOf, CurrencyPipe],
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
  columns: string[] = [];
  valueMapKeys: string[] = [];

  ngOnInit(): void {
    this.buildColumns();

    for (let i = 1; i < 1; i++) {
      this.dataSource.push({
        name: 'Test' + i,
        type: ExpenseType.Fixed,
        valueMap: new Map(this.valueMapKeys.map((key) => [key, i.toString()])),
      });
    }
  }

  createExpense(): void {
    this.dataSource.push({
      name: 'createExpenseTest',
      type: ExpenseType.Fixed,
      valueMap: new Map(this.valueMapKeys.map((key) => [key, '100'])),
    });

    // refresh the table
    this.dataSource = [...this.dataSource];
  }

  moreClick(): void {
    console.log('more clicked');
  }

  private buildColumns() {
    const d = new Date();
    d.setDate(1);
    for (let i = 0; i < 36; i++) {
      const shortMonth = this.months[d.getMonth()];
      const shortYear = d.getFullYear().toString().substring(2, 4);
      this.valueMapKeys.push(`${shortMonth} ${shortYear}`);

      d.setMonth(d.getMonth() + 1);
    }

    this.columns = ['name', ...this.valueMapKeys, 'more'];
  }
}
