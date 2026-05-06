# My Expenses — Project Specification

## Project Overview

Personal finance tracker for a single user managing income (salary + extra), recurring fixed expenses, one-off purchases, and credit card charges. Tracks money across multiple wallet accounts with monthly cashflow summaries, category breakdowns, 6-month history chart, and calendar view with income/expense/reminder dots.

---

## Tech Stack

- **Framework:** React 18 + Vite 5
- **Language:** TypeScript (relaxed)
- **Styling:** Tailwind CSS 3 + custom CSS variables
- **Components:** shadcn/ui (~40 components)
- **Backend:** Supabase (Postgres + Auth, RLS enabled)
- **Charts:** Recharts
- **Forms:** react-hook-form + Zod
- **Notifications:** Sonner toasts
- **Icons:** Lucide React
- **Date utils:** date-fns
- **Excel export:** xlsx
- **Deployment:** Vercel + GitHub

---

## Authentication

- **Supabase Auth** with email/password
- **Login page:** `/login` - centered form, dark theme, error handling
- **Session check:** On app load via `supabase.auth.getSession()`
- **State listener:** `onAuthStateChange` for login/logout events
- **Sign out:** Button in sidebar footer (Lucide LogOut icon)
- **RLS:** Authenticated users only policy enabled

---

## File Structure

```
src/
  App.tsx               # Root: QueryClient, BrowserRouter, ThemeProvider, routes, auth
  main.tsx             # Entry point
  pages/
    Login.tsx          # Auth login form
    Dashboard.tsx      # Overview/Dashboard/Monthly Statement tabs
    MyExpenses.tsx     # CRUD one-off expenses with month filter
    FixedExpenses.tsx  # Recurring bills with start/end dates, edit modal
    AddCharge.tsx      # Card charges: one-time/installment/recurring
    MySalary.tsx      # Salary entry per month (modal dialog)
    MyWallet.tsx       # Wallet balances + transfer modal
    ExtraIncome.tsx    # Non-salary income entries (modal dialog)
    Tables.tsx        # Unified CRUD for categories/cards/wallets
    NotFound.tsx      # 404
  components/
    AppLayout.tsx     # Sidebar + content shell wrapper
    AppSidebar.tsx    # Nav: Home direct, collapsible groups, sign out, theme toggle
    FloatingActionButton.tsx  # FAB with 4 actions (Reminders, Calculator, Converter, Notes)
    MonthSelector.tsx # Prev/next month picker
    MonthlyExpensesList.tsx  # Monthly view: expenses + fixed + card charges
    OverviewCalendar.tsx  # Large calendar with income/expense/reminder dots, day detail dialog
    AnimatedNumber.tsx  # Animated counter for dashboard totals
  integrations/supabase/
    client.ts        # createClient singleton with auth config
    types.ts         # Database type (generated)
  lib/
    format.ts        # formatMoney, startOfMonthISO, endOfMonthISO, monthShort
    utils.ts         # cn() utility
    theme.tsx        # next-themes dark/light toggle
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
| `card_charges` | id, description, card_id, category_id, type (one-time/installment/recurring), monthly_amount, total_installments, start_date, active |
| `charge_payments` | id, charge_id, month (yyyy-MM-01), paid (boolean), created_at |
| `card_payments` | id, card_id, month (yyyy-MM-01), amount, wallet_account_id, date, notes, created_at |
| `wallet_distributions` | wallet_account_id, month (yyyy-MM-01), amount |
| `wallet_transfers` | id, from_wallet_id, to_wallet_id, amount, date, notes, created_at |
| `reminders` | id, title, description, date, start_time, end_time, all_day, color, dismissed |

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

## Floating Action Button (FAB)

**Location:** Fixed bottom-right (24px from edges)

**Actions (4):**
1. **Reminders** (Bell icon): Popover with today's reminders, badge count, dismiss/dismiss-all
2. **Calculator** (Calculator icon): 320px panel, basic arithmetic, keyboard support (0-9, +, -, *, /, Enter, Backspace, C, Escape)
3. **Currency Converter** (DollarSign icon): 
   - Fetches from `https://dolarapi.com/v1/dolares`
   - Toggle ARS/USD input, pill tabs for Blue/Oficial/MEP/CCL
   - MEP maps to "bolsa", CCL maps to "contadoconliqui"
   - Live conversion as user types
   - SVG flags (Argentina 🇦🇷, USA 🇺🇸)
4. **Notes** (StickyNote icon): 
   - localStorage ("quick-notes" key), auto-save on keystroke
   - Green dot indicator when notes exist
   - Character count + Clear button

**Behavior:** Click outside FAB group closes menu. All panels stay open independently of FAB state.

---

## Reminders System

- **Table:** reminders (id, title, description, date, start_time, end_time, all_day, color, dismissed)
- **OverviewCalendar:** Shows colored dots per day (reminders + income + expenses). Click day opens dialog with reminders/incomes/expenses
- **ReminderBell:** FAB button with badge (count > 0), popover with today's reminders, dismiss/dismiss-all
- **ReminderAutoPopup:** Auto-opens on app load if any pending reminders (past or present, not dismissed)

---

## Deployment

- **Repository:** GitHub
- **Hosting:** Vercel
- **Database:** Own Supabase project (not Lovable)
- **Environment Variables:**
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## Current Status

- All core pages functional with Supabase Auth
- FAB with 4 independent actions working
- Currency converter using dolarapi.com
- Quick notes with localStorage persistence
- Calendar with income/expense/reminder dots
- Theme toggle (dark/light)
- Sign out in sidebar
- RLS enabled (authenticated users only)

---

## MercadoPago Integration

### Pages

- **MercadoPago:** `/mercadopago` - Connect API credentials, fetch monthly movements from Account Money API

### Tables

| Table | Key Fields |
|-------|------------|
| `mercado_pago_credentials` | id, user_id, public_key, access_token, country, created_at, updated_at |
| `mercado_pago_movements` | id, user_id, external_id, transaction_date, type, amount, currency, description, status, created_at |

### Backend Functions (Supabase Edge Functions)

| Function | Endpoint | Purpose |
|----------|----------|---------|
| `mercadopago-check-credentials` | `/functions/v1/mercadopago-check-credentials` | Verify if user has stored credentials |
| `mercadopago-save-credentials` | `/functions/v1/mercadopago-save-credentials` | Save/Update API credentials |
| `mercadopago-fetch-movements` | `/functions/v1/mercadopago-fetch-movements?month=YYYY-MM` | Fetch movements from Account Money API |

### Account Money API

- **Base URL:** `https://api.mercadopago.com`
- **Endpoints Used:**
  - `GET /v1/account/settlement_report/list` - List existing reports
  - `POST /v1/account/settlement_report` - Create new report
  - `GET /v1/account/settlement_report/{file_name}` - Download CSV report
- **Report Fields:** SOURCE_ID, TRANSACTION_DATE, TRANSACTION_AMOUNT, SETTLEMENT_NET_AMOUNT, TRANSACTION_TYPE, TRANSACTION_CURRENCY, EXTERNAL_REFERENCE
- **Transaction Types:** SETTLEMENT (cobros), WITHDRAWAL (retiros/transferencias), REFUND (devoluciones), CHARGEBACK

### UI Components

- **Summary Cards:** In (green), Out (red), Net (green/red based on sign) - Display totals for selected month
- **Movements Table:** Date, Description, Amount (green for positive, red for negative)
- **Month Selector:** Filter movements by month (YYYY-MM)