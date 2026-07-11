# Lovebirds Budget Software: Project Specification & Design System

This document serves as the single source of truth for Project Unified Finance. It outlines the design tokens, layout interfaces, interactivity guidelines, database architecture, and global state logic for the application.

---

## 1. Design Tokens & Visual Theme (Quiet Luxury)

The application adheres to a curated, high-end "Quiet Luxury" aesthetic. Use these design tokens exclusively when styling elements.

### Color Palette
*   **Primary Accent (Deep Pine)**: `var(--color-primary-accent)` -> `#1E352F` (Primary numbers, headers, active states)
*   **Secondary Accent (Sage/Olive)**: `var(--color-secondary-accent)` -> `#4A5D4E` (Borders, labels, normal progress bars)
*   **Base Canvas (Rich Cream)**: `var(--color-base-canvas)` -> `#FDFBF7` (Background canvas color)
*   **Surface Variant (Warm Sand)**: `var(--color-surface-variant)` -> `#F4EFE3` (Pill groups, header cards, table headers)
*   **Surface Card (White)**: `var(--color-surface-card)` -> `#FFFFFF` (Card background canvas)
*   **Font Primary (Dark Walnut)**: `var(--color-font-primary)` -> `#2B2421` (Main text, titles)
*   **Font Secondary (Soft Earth)**: `var(--color-font-secondary)` -> `#6E6560` (Subheadings, captions, secondary text)
*   **Alert (Crimson Glow)**: `var(--color-alert)` -> `#A34843` (Negative balances, over-budget warnings, delete buttons)
*   **Success (Muted Emerald)**: `var(--color-success)` -> `#2E5C4E` (Income inflows, positive balances, active states)
*   **Success Light**: `var(--color-success-light)` -> `#EBF5F1` (Achieved goal card backgrounds)
*   **Savings Gold (Warm Gold)**: `var(--color-savings-gold)` -> `#D4A373` (Savings indicators, >70% budget warnings)

### Typography
*   **Font Family**: `'Inter'`, sans-serif.
*   **Tabular Numbers**: Apply class `.tabular-nums` (`font-variant-numeric: tabular-nums`) to all financial values, lists, and tables to align columns cleanly.

### Layout Details & Animations
*   **Border Radii**:
    *   Small: `var(--border-radius-sm)` -> `8px` (Buttons, inputs, form inputs)
    *   Medium: `var(--border-radius-md)` -> `14px` (Cards, expanded blocks)
    *   Large: `var(--border-radius-lg)` -> `24px` (Main wrappers)
*   **Transitions**:
    *   Page Glide: `var(--transition-glide)` -> `cubic-bezier(0.16, 1, 0.3, 1)` with `--time-glide` (`350ms`)
    *   Drawer Expand: `var(--transition-expand)` -> `cubic-bezier(0.4, 0, 0.2, 1)` with `--time-expand` (`300ms`)

---

## 2. Page Views & Interactivity Specifications

### View 1: Outflows Ledger (Transaction List)
*   **Summary Cards**:
    *   *Total Inflow*: Sums all incomes matching the scoped period.
    *   *Total Spent*: Sums all expenses matching the scoped period.
*   **Time Scope Controls**: Pill-shaped toggle group (Month, Year, All-Time).
    *   Changing the scope updates the summary metrics, the table registers, and the Category Distribution Bar.
    *   Active pill style: Primary Accent color, text Base Canvas, slight shadow.
    *   Inactive hover: Light sand overlay, soft drift animation.
*   **Category Distribution Bar**:
    *   Segmented progress bar (`#ledger-expense-progress-container`) dividing expense totals.
    *   Colors are mapped using `LEDGER_COLORS` (orange, purple, blue, green, and light varieties) mapped consistently based on category index.
    *   Legend displays color dots, category names, total amounts, and percentage shares.
*   **Ledger Register**:
    *   Lists all scoped transactions (Expenses + Incomes).
    *   Clicking a row displays the details modal (with edit/delete buttons).

### View 2: Budget Category Tracking (Limits)
*   **Category List**: Education, Food, Transportation, Dating, Travel, Hygiene, Play, Housing, Donations, Wedding, Other.
*   **Unexpanded Card States**:
    *   Shows remaining capacity in the category (e.g. `"$120.00 remaining"` or `"$20.00 over"`).
    *   *Dynamic Color Indicators*:
        *   **Red (`var(--color-alert)`)**: Used when spent exceeds the limit (over budget).
        *   **Gold (`var(--color-savings-gold)`)**: Used when spent is between 70% and 100% of the limit (warning state).
        *   **Primary Accent (default)**: Used when spent is under 70% of the limit.
    *   *Progress Bar fill*: Matches the warning colors (Sage/Olive, Gold, or Red).
*   **Expanded Tile State**:
    *   Displays Remaining Budget Capacity box (highlighted red if over).
    *   Loads dynamically generated custom SVG Pie Chart of category subgroups.
    *   Shows subgroup list, history ledger, and "Adjust Monthly Budget Limit" form.

### View 3: Savings Target Structures
*   **Unexpanded Card**: Displays account balance and target progress bar.
*   **Expanded Card**:
    *   *Balance Adjustment Panel*: Inbound / Outbound transfer controls with safety overdraft protection.
    *   *Adjust Goal Target Panel*: Inline forms to update target amounts and deadlines.
    *   *Delete Account Panel*: Same-line grouped buttons ("Update Goal", "Delete Account"). Deleting triggers a confirmation modal detailing the refund amount. Any balance remaining in the account is automatically refunded back to Free Cash.

### View 4: Income & Debts
*   **Income Performance Dashboard**:
    *   Renders segmented progress bar showing earned income by source.
    *   Segments map to `INCOME_COLORS` deterministically.
    *   If total income <= goal, segments represent percentage of the goal (remainder stays empty). If total income exceeds the goal (or no goal exists), bar fills 100% and scales segments proportionally.
    *   Legend renders below the progress bar with colored source names and totals.
*   **Debts (Payables & Receivables)**:
    *   Payables (Owed Out) and Receivables (Owed In) ledgers.
    *   Receivable settlements write transactions logged under `"Other"` source subgroup.

---

## 3. Database Architecture & State Calculations

All database methods are located in `db.js`. Fallbacks are cached in `localStorage` when Google OAuth2 connection is absent.

### Schemas

#### 1. Category Taxonomy (`categories`)
*   Object key represents the group, value is an array of subgroups:
    `{ "Education": ["Textbooks", "Fees", "Software", Tuition", "Other"], ... }`

#### 2. Outflows Transactions (`transactions`)
*   `id` (UUID), `date` (YYYY-MM-DD), `group` (Category Group), `subgroup` (Subgroup), `amount` (Float), `description` (String), `savings_account_id` (String/Nullable).

#### 3. Inbound Revenue Ledger (`income_ledger`)
*   `id` (UUID), `date` (YYYY-MM-DD), `source` (String), `amount` (Float), `description` (String).

#### 4. Savings Accounts (`savings_accounts`)
*   `account_id` (Lowercase slug), `account_name` (String), `target_amount` (Float), `target_date` (YYYY-MM-DD), `date_logged` (YYYY-MM-DD), `amount_added` (Float), `ref_id` (UUID).
*   *Note*: A savings account's balance is the sum of `amount_added` across all allocations matching `account_id`.

#### 5. Debt Ledger (`debt_ledger`)
*   `id` (UUID), `type` ("Payable" | "Receivable"), `description` (String), `total_amount` (Float), `date_logged` (YYYY-MM-DD).

#### 6. Monthly Configurations (`monthly_configs`)
*   `month_year` (MM-YYYY), `config_type` ("Budget_Limit" | "Savings_Goal" | "Income_Goal"), `key_name` (String), `allocated_value` (Float).

---

## 4. Key Calculation Formulas

### Cash Balance (Liquid Cash)
Total cash not locked in savings (Free Checking/Cash):
$$\text{Liquid Cash} = \sum(\text{Income Inflows}) - \sum(\text{Transaction Outflows}) - \sum(\text{Savings Allocations})$$

### Free Cash
Cash available to allocate after factoring in budgeted (expected) expenses:
$$\text{Free Cash} = \max(0, \text{Liquid Cash} - \text{Remaining Budget Caps})$$
$$\text{Remaining Budget Caps} = \sum(\text{Monthly Budget Limit}) - \sum(\text{Active Month Spent})$$

---

## 5. Security & Safety Rules

1.  **Overdraft Protection**: All forms adding money to savings, withdrawing from savings, or creating expense transactions must check `currentLiquidCash` first. Show `showWarningModal` block if a transaction would push checking/savings balances below 0.
2.  **Schema Versioning**: Upon change to DEFAULT data structures, increment the schema version `categorySchemaVersion` in `initLocalData()` to force-refresh local storage tables.
