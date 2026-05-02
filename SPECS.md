# My Expenses — Project Specification

## Project Overview

Personal finance tracker for a single user managing income (salary + extra), recurring fixed expenses, one-off purchases, and credit card charges. Tracks money across multiple wallet accounts with monthly cashflow summaries, category breakdowns, 6-month history chart, and calendar view with income/expense/reminder dots.

---

## Tech Stack

- **Framework:** React 18 + Vite 5
- **Language:** TypeScript (relaxed)
- **Styling:** Tailwind CSS 3 + custom CSS variables
- **Components:** shadcn/ui (~40 components)
- **Backend:** Supabase (Postgres + Auth, anon key embedded, no RLS)
- **Charts:** Recharts
- **Forms:** react-hook-form + Zod (unused currently)
- **Notifications:** Sonner toasts
- **Icons:** Lucide React
- **Date utils:** date-fns
- **Excel export:** xlsx

---

## File Structure

```
src/
  App.tsx                 # Root: QueryClient, BrowserRouter, ThemeProvider, routes
  main.tsx               # Entry point
  pages/
    Dashboard.tsx        # Overview/Dashboard/Monthly Statement tabs, income vs spent, pie/bar charts
    MyExpenses.tsx       # CRUD one-off expenses with month filter, dialog form
    FixedExpenses.tsx   # Recurring bills with start/end dates, edit modal
    AddCharge.tsx       # Card charges: one-time/installment/recurring, active toggle
    MySalary.tsx        # Salary entry per month (modal dialog)
    MyWallet.tsx        # Wallet balances + transfer modal
    ExtraIncome.tsx     # Non-salary income entries (modal dialog)
    MyCards.tsx         # Credit card CRUD
    Tables.tsx          # Unified CRUD for categories/cards/wallets
    Index.tsx           # Redirects to /expenses
    NotFound.tsx        # 404
  components/
    AppLayout.tsx       # Sidebar + content shell wrapper
    AppSidebar.tsx      # Nav: Home direct, collapsible groups (Income/Expenses/Accounts/Settings)
    MonthSelector.tsx  # Prev/next month picker
    MonthlyExpensesList.tsx  # Monthly view: expenses + fixed + card charges, toggle paid
    OverviewCalendar.tsx   # Large calendar with income/expense/reminder dots, day detail dialog, add reminder
    AnimatedNumber.tsx  # Animated counter for dashboard totals
    ReminderBell.tsx    # Floating bell, today's reminders popover, dismiss/dismiss-all
    ReminderAutoPopup.tsx # Auto-popup on load for due reminders
    ui/                 # shadcn/ui primitives (dialog, select, table, etc.)
  integrations/supabase/
    client.ts          # createClient singleton
    types.ts           # Database type (generated)
  lib/
    format.ts          # formatMoney, startOfMonthISO, endOfMonthISO, monthShort
    utils.ts           # cn() utility
    theme.tsx          # next-themes dark/light toggle
```

---

## Data Models

| Table | Key Fields |
|-------|------------|
| `categories` | id, name, color |
| `cards` | id, name, color |
| `wallet_accounts` | id, name, color |
| `salary` | id, month (yyyy-MM-01), amount, wallet_account_id, created_at |
| `extra_income` | id, concept, amount, date, wallet_account_id, notes, created_at |
| `expenses` | id, amount, category_id, date, wallet_account_id, description, created_at |
| `expense_payments` | id, expense_id, amount, wallet_account_id, date, paid (boolean), paid_at, created_at |
| `fixed_expenses` | id, description, amount, category_id, wallet_account_id, start_date, end_date (nullable), created_at |
| `fixed_expense_payments` | id, fixed_expense_id, month (yyyy-MM-01), paid (boolean), paid_at, amount, created_at |
| `card_charges` | id, description, card_id, category_id, type (one-time/installment/recurring), monthly_amount, total_installments, current_installment, start_date, active |
| `charge_payments` | id, charge_id, month (yyyy-MM-01), paid (boolean), created_at |
| `card_payments` | id, card_id, month (yyyy-MM-01), amount, wallet_account_id, date, notes, created_at |
| `wallet_distributions` | wallet_account_id, month (yyyy-MM-01), amount |
| `wallet_transfers` | id, from_wallet_id, to_wallet_id, amount, date, notes, created_at |
| `reminders` | id, title, description, date, start_time, end_time, all_day, color, dismissed |

**REMOVED:** fixed_expense_overrides table, expenses.paid column (not used)

---

## Key Patterns

- **Paid status:** Check payment table existence (`expense_payments.paid`, `fixed_expense_payments.paid`, `card_payments` existence)
- **Fixed expense amount:** `payment.amount ?? fixed_expense.amount`
- **New tables:** Queried with `as any` (not in Supabase types)
- **Month format:** `yyyy-MM-01` (e.g., "2025-05-01")
- **Money:** Stored as numeric, formatted with `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`
- **Wallet balance:** Computed on-the-fly from salary + extra + distributions + transfers in − paid expenses/fixed/card payments

---

## Pages

- **Dashboard:** 3 view modes (Overview/Dashboard/Monthly Statement). Overview: quick access cards + calendar. Dashboard: income/spent/committed/available, wallet snapshot, pie chart (by category), bar chart (6 months), top categories. Monthly Statement: table of all transactions, filter paid only, XLSX export.
- **MyExpenses:** CRUD one-off expenses, month filter, dialog form with amount/category/wallet/description/date.
- **FixedExpenses:** List of recurring bills with start/end dates, add/edit modal, delete (cascades to payments), monthly total.
- **AddCharge:** Create card charges (one-time/installment/recurring), toggle active. Payment via card_payments table.
- **MySalary:** Modal dialog, one record per month, assigned to wallet.
- **ExtraIncome:** Modal dialog, non-salary earnings, assigned to wallet.
- **MyWallet:** Wallet balances (computed), transfer modal, transfer history table, delete transfer.
- **MyCards:** CRUD credit cards (name, color).
- **Tables:** 3 tabs (categories/cards/wallets) for unified CRUD.

---

## Components

- **AppLayout:** Sidebar wrapper with title/subtitle/actions slot
- **AppSidebar:** Collapsible nav groups (Income/Expenses/Accounts/Settings), theme toggle
- **MonthSelector:** Prev/next month buttons with label
- **MonthlyExpensesList:** Tabbed view (Expenses/Fixed/Card Charges), toggle paid/unpaid, delete expense, no edit
- **OverviewCalendar:** Large month grid, green income dots / red expense dots / colored reminder dots, day click for detail + add reminder dialog
- **ReminderBell:** Fixed position bell, today's reminders popover, dismiss/dismiss-all
- **ReminderAutoPopup:** Auto-popup on app load for any due (past/present) reminders, grouped by date
- **AnimatedNumber:** Smooth counter animation for dashboard totals

---

## Current Status

- All core pages functional. Auth not enforced.
- Reminder system: add from calendar day dialog, view via bell icon, auto-popup on load
- Monthly Statement with XLSX export
- Card charges: three types (one-time/installment/recurring), active toggle
- Fixed expenses: amount override via fixed_expense_payments.amount