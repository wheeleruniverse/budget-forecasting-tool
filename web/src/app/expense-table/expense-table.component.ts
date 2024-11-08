import { CurrencyPipe, NgForOf } from '@angular/common';
import { Component, inject, model, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { ExpenseTableDialogComponent } from './expense-table-dialog/expense-table-dialog.component';

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
  imports: [
    MatTableModule,
    MatIconModule,
    NgForOf,
    CurrencyPipe,
    MatLabel,
    MatFormField,
    FormsModule,
    MatInput,
    MatButton,
  ],
  templateUrl: './expense-table.component.html',
  styleUrl: './expense-table.component.scss',
})
export class ExpenseTableComponent implements OnInit {
  readonly animal = signal('');
  readonly name = model('');
  readonly dialog = inject(MatDialog);

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
        valueMap: new Map(this.valueMapKeys.map(key => [key, i.toString()])),
      });
    }
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(ExpenseTableDialogComponent, {
      data: { name: this.name(), animal: this.animal() },
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('The dialog was closed');
      if (result !== undefined) {
        this.animal.set(result);
      }
    });
  }

  createExpense(): void {
    this.dataSource.push({
      name: 'createExpenseTest',
      type: ExpenseType.Fixed,
      valueMap: new Map(this.valueMapKeys.map(key => [key, '100'])),
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
