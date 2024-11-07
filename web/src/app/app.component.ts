import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ExpenseTableComponent } from './expense-table/expense-table.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ExpenseTableComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {}
