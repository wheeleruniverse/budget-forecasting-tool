import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpenseTableDialogComponent } from './expense-table-dialog.component';

describe('ExpenseTableDialogComponent', () => {
  let component: ExpenseTableDialogComponent;
  let fixture: ComponentFixture<ExpenseTableDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExpenseTableDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseTableDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
