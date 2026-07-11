/* ==========================================================================
   Project Unified Finance: Database & Google Sheets API Integration Layer (Globals)
   ========================================================================== */

// Default Category Configuration (Transposed Columns)
const DEFAULT_CATEGORIES = {
  "Education": ["Textbooks", "Fees", "Software", "Tuition", "Other"],
  "Groceries": ["Groceries", "Other"],
  "Eat Out": ["Meal", "Treats", "Work/Education", "Other"],
  "Transportation": ["Fuel", "Maintenance", "Repairs", "Public Transport", "Insurance", "Other"],
  "Dating": ["Activities", "Eat Out", "Treats", "Flowers", "Other"],
  "Travel": ["Activities", "Airline Tickets", "Public Transport", "Hotels", "Food", "Fees", "Other"],
  "Hygiene": ["Haircut", "Clothing", "Products", "Other"],
  "Play": ["Activities", "Gifts", "Other"],
  "Housing": ["Rent", "Supplies", "Appliances", "Other"],
  "Donations": ["Tithing", "Other"],
  "Wedding": ["Direct", "Indirect", "Rings"],
  "Subscriptions": ["Entertainment", "Education", "Services", "Other"],
  "Other": ["Banking Fee", "Work Expense", "Emergency", "Taxes", "Other"],
  "Income": ["Black Bear Sprinkler Repair", "BYU Research", "BYU TA", "Piano Tuning", "Loan", "Scholarship", "Gift", "Help", "Other"]
};

// Default sample data for Local Sandbox
const DEFAULT_TRANSACTIONS = [];
const DEFAULT_INCOME_LEDGER = [];
const DEFAULT_SAVINGS_ACCOUNTS = [];
const DEFAULT_DEBT_LEDGER = [];
const DEFAULT_MONTHLY_CONFIGS = [];

class Database {
  constructor() {
    this.mode = localStorage.getItem('puf_db_mode') || 'local'; // 'local' or 'sheets'
    this.spreadsheetId = localStorage.getItem('puf_sheets_id') || '1bl4XWI-D5QaXBBMQA2Rhf9kd4UT9IRtFlvdNtXxnEKI';
    this.oauthToken = null; // Stored in-memory, set on connect
    this.localData = {};
    
    this.initLocalData();
  }

  initLocalData() {
    const categorySchemaVersion = "v7_budget_categories_reset";
    const currentVersion = localStorage.getItem('puf_category_schema_version');
    if (currentVersion !== categorySchemaVersion) {
      localStorage.setItem('puf_category_schema_version', categorySchemaVersion);
      localStorage.removeItem('puf_local_categories');
      localStorage.removeItem('puf_local_transactions');
      localStorage.removeItem('puf_local_income');
      localStorage.removeItem('puf_local_monthly_configs');
      localStorage.removeItem('puf_local_savings');
      localStorage.removeItem('puf_local_debts');
    }

    // Check if localStorage has tables, otherwise initialize with defaults
    const getOrSet = (key, val) => {
      let stored = localStorage.getItem(key);
      if (!stored) {
        localStorage.setItem(key, JSON.stringify(val));
        return val;
      }
      return JSON.parse(stored);
    };

    this.localData.categories = getOrSet('puf_local_categories', DEFAULT_CATEGORIES);
    this.localData.transactions = getOrSet('puf_local_transactions', DEFAULT_TRANSACTIONS);
    this.localData.income_ledger = getOrSet('puf_local_income', DEFAULT_INCOME_LEDGER);
    this.localData.savings_accounts = getOrSet('puf_local_savings', DEFAULT_SAVINGS_ACCOUNTS);
    this.localData.debt_ledger = getOrSet('puf_local_debts', DEFAULT_DEBT_LEDGER);
    this.localData.monthly_configs = getOrSet('puf_local_monthly_configs', DEFAULT_MONTHLY_CONFIGS);
  }

  saveLocal(key) {
    if (key === 'categories') localStorage.setItem('puf_local_categories', JSON.stringify(this.localData.categories));
    if (key === 'transactions') localStorage.setItem('puf_local_transactions', JSON.stringify(this.localData.transactions));
    if (key === 'income_ledger') localStorage.setItem('puf_local_income', JSON.stringify(this.localData.income_ledger));
    if (key === 'savings_accounts') localStorage.setItem('puf_local_savings', JSON.stringify(this.localData.savings_accounts));
    if (key === 'debt_ledger') localStorage.setItem('puf_local_debts', JSON.stringify(this.localData.debt_ledger));
    if (key === 'monthly_configs') localStorage.setItem('puf_local_monthly_configs', JSON.stringify(this.localData.monthly_configs));
  }

  isGoogleConnected() {
    return this.mode === 'sheets' && this.oauthToken !== null && this.spreadsheetId !== '';
  }

  connectGoogle(token, spreadsheetId) {
    this.oauthToken = token;
    this.spreadsheetId = spreadsheetId;
    this.mode = 'sheets';
    localStorage.setItem('puf_db_mode', 'sheets');
    localStorage.setItem('puf_sheets_id', spreadsheetId);
  }

  disconnectGoogle() {
    this.oauthToken = null;
    this.spreadsheetId = '';
    this.mode = 'local';
    localStorage.setItem('puf_db_mode', 'local');
    localStorage.removeItem('puf_sheets_id');
  }

  // ==========================================================================
  // Generic Sheets API calls helper
  // ==========================================================================
  async apiRequest(path, method = 'GET', body = null) {
    if (!this.oauthToken) throw new Error("Google account authorization token is missing.");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}${path}`;
    const headers = {
      'Authorization': `Bearer ${this.oauthToken}`,
      'Content-Type': 'application/json'
    };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (!response.ok) {
      if (response.status === 401) {
        this.oauthToken = null;
        if (typeof this.onTokenExpired === 'function') {
          this.onTokenExpired();
        }
      }
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Sheets API error: ${response.statusText}`);
    }
    return response.json();
  }

  // Helper to read a cell range
  async readRange(range) {
    const data = await this.apiRequest(`/values/${encodeURIComponent(range)}`);
    return data.values || [];
  }

  // Helper to append a row
  async appendRow(range, rowValues) {
    return this.apiRequest(`/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, 'POST', {
      values: [rowValues]
    });
  }

  // Helper to clear a range or write multiple values
  async updateRange(range, values) {
    return this.apiRequest(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, 'PUT', {
      values
    });
  }

  // Programmatically initialize spreadsheet
  async createSpreadsheet(token) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    const body = {
      properties: { title: "Lovebirds Finance: Budget Workbook" },
      sheets: [
        { properties: { title: "transactions" } },
        { properties: { title: "income_ledger" } },
        { properties: { title: "savings_accounts" } },
        { properties: { title: "debt_ledger" } },
        { properties: { title: "monthly_configs" } },
        { properties: { title: "categories_config" } }
      ]
    };
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Spreadsheet initialization failed: ${response.statusText}`);
    const data = await response.json();
    
    // We will now write headers to each sheet
    this.spreadsheetId = data.spreadsheetId;
    this.oauthToken = token;
    
    await this.updateRange("transactions!A1:G1", [["id", "date", "group", "subgroup", "amount", "description", "savings_account_id"]]);
    await this.updateRange("income_ledger!A1:F1", [["id", "date", "source", "amount", "description", "tithable"]]);
    await this.updateRange("savings_accounts!A1:G1", [["account_id", "account_name", "target_amount", "target_date", "date_logged", "amount_added", "ref_id"]]);
    await this.updateRange("debt_ledger!A1:E1", [["id", "type", "description", "total_amount", "date_logged"]]);
    await this.updateRange("monthly_configs!A1:D1", [["month_year", "config_type", "key_name", "allocated_value"]]);

    // Initial Transposed Categories Configuration
    const categoriesRows = [];
    const headersList = Object.keys(DEFAULT_CATEGORIES);
    categoriesRows.push(headersList);
    
    // Find maximum subgroup length
    let maxLen = 0;
    for (const h of headersList) maxLen = Math.max(maxLen, DEFAULT_CATEGORIES[h].length);
    
    for (let r = 0; r < maxLen; r++) {
      const row = [];
      for (const h of headersList) {
        row.push(DEFAULT_CATEGORIES[h][r] || "");
      }
      categoriesRows.push(row);
    }
    await this.updateRange("categories_config!A1:Z100", categoriesRows);
    
    // Seed some initial data to avoid cold start issues
    for (const t of DEFAULT_TRANSACTIONS) await this.appendRow("transactions!A:G", [t.id, t.date, t.group, t.subgroup, t.amount, t.description, ""]);
    for (const i of DEFAULT_INCOME_LEDGER) await this.appendRow("income_ledger!A:E", [i.id, i.date, i.source, i.amount, i.description]);
    for (const s of DEFAULT_SAVINGS_ACCOUNTS) await this.appendRow("savings_accounts!A:G", [s.account_id, s.account_name, s.target_amount, s.target_date, s.date_logged, s.amount_added, ""]);
    for (const d of DEFAULT_DEBT_LEDGER) await this.appendRow("debt_ledger!A:E", [d.id, d.type, d.description, d.total_amount, d.date_logged]);
    for (const c of DEFAULT_MONTHLY_CONFIGS) await this.appendRow("monthly_configs!A:D", [c.month_year, c.config_type, c.key_name, c.allocated_value]);

    return this.spreadsheetId;
  }

  // ==========================================================================
  // Categories Taxonomy & Transposition Methods
  // ==========================================================================
  async getCategories() {
    if (this.isGoogleConnected()) {
      try {
        const matrix = await this.readRange("categories_config!A1:Z100");
        if (matrix.length === 0) return {};
        
        const headers = matrix[0];
        const taxonomy = {};
        for (let col = 0; col < headers.length; col++) {
          const groupName = headers[col];
          if (!groupName || groupName.trim() === "") continue;
          taxonomy[groupName] = [];
          for (let row = 1; row < matrix.length; row++) {
            const cellValue = matrix[row][col];
            if (cellValue !== undefined && cellValue !== null && cellValue.trim() !== "") {
              taxonomy[groupName].push(cellValue.trim());
            }
          }
        }
        return taxonomy;
      } catch (e) {
        console.error("Failed to fetch categories from Sheets API, falling back to local storage.", e);
      }
    }
    return this.localData.categories;
  }

  async addIncomeSourceToTaxonomy(sourceName) {
    sourceName = sourceName.trim();
    if (this.isGoogleConnected()) {
      try {
        const taxonomy = await this.getCategories();
        const incomeIndex = Object.keys(taxonomy).indexOf("Income");
        if (incomeIndex === -1) throw new Error("Income column not found in taxonomy config.");
        
        // Find how many items exist in Income column to determine insertion cell
        const currentItems = taxonomy["Income"] || [];
        if (currentItems.includes(sourceName)) return; // already exists
        
        const cellColChar = String.fromCharCode(65 + incomeIndex); // 'A', 'B', etc.
        const targetCell = `categories_config!${cellColChar}${currentItems.length + 2}`; // +1 for index, +1 for row 1 headers
        await this.updateRange(targetCell, [[sourceName]]);
        return;
      } catch (e) {
        console.error("Sheets taxonomy write failed, attempting local save.", e);
      }
    }
    
    if (!this.localData.categories["Income"].includes(sourceName)) {
      this.localData.categories["Income"].push(sourceName);
      this.saveLocal('categories');
    }
  }

  // ==========================================================================
  // Transactions Methods
  // ==========================================================================
  async getTransactions(monthYear = null) {
    let rows = [];
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("transactions!A2:G");
        rows = data.map(r => ({
          id: r[0] || "",
          date: r[1] || "",
          group: r[2] || "",
          subgroup: r[3] || "",
          amount: parseFloat(r[4] || "0"),
          description: r[5] || "",
          savings_account_id: r[6] || ""
        }));
      } catch (e) {
        console.error("Sheets transactions read failed, falling back.", e);
        rows = this.localData.transactions;
      }
    } else {
      rows = this.localData.transactions;
    }

    if (monthYear) {
      // monthYear is MM-YYYY, date is YYYY-MM-DD
      return rows.filter(r => {
        if (!r.date) return false;
        const [y, m, d] = r.date.split('-');
        return `${m}-${y}` === monthYear;
      });
    }
    return rows;
  }

  async addTransaction(transaction) {
    if (!transaction.id) transaction.id = window.generateUUID();
    if (this.isGoogleConnected()) {
      try {
        await this.appendRow("transactions!A:G", [
          transaction.id,
          transaction.date,
          transaction.group,
          transaction.subgroup,
          transaction.amount,
          transaction.description || "",
          transaction.savings_account_id || ""
        ]);
        return;
      } catch (e) {
        console.error("Sheets transaction insert failed.", e);
      }
    }
    this.localData.transactions.push(transaction);
    this.saveLocal('transactions');
  }

  async deleteTransaction(id) {
    // Delete associated savings allocations
    await this.deleteSavingsAllocationByRef(id);

    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("transactions!A2:G");
        const allTransactions = data.map(r => ({
          id: r[0] || "",
          date: r[1] || "",
          group: r[2] || "",
          subgroup: r[3] || "",
          amount: parseFloat(r[4] || "0"),
          description: r[5] || "",
          savings_account_id: r[6] || ""
        }));
        const filtered = allTransactions.filter(t => t.id !== id);
        
        // Clear existing range by writing empty rows
        const clearMatrix = Array(allTransactions.length + 10).fill(["", "", "", "", "", "", ""]);
        await this.updateRange(`transactions!A2:G${allTransactions.length + 12}`, clearMatrix);
        
        // Write the filtered list
        if (filtered.length > 0) {
          const writeMatrix = filtered.map(t => [
            t.id,
            t.date,
            t.group,
            t.subgroup,
            t.amount,
            t.description || "",
            t.savings_account_id || ""
          ]);
          await this.updateRange("transactions!A2", writeMatrix);
        }
        return;
      } catch (e) {
        console.error("Sheets deleteTransaction failed, falling back to local.", e);
      }
    }
    this.localData.transactions = this.localData.transactions.filter(t => t.id !== id);
    this.saveLocal('transactions');
  }

  async updateTransaction(transaction) {
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("transactions!A2:G");
        const allTransactions = data.map(r => ({
          id: r[0] || "",
          date: r[1] || "",
          group: r[2] || "",
          subgroup: r[3] || "",
          amount: parseFloat(r[4] || "0"),
          description: r[5] || "",
          savings_account_id: r[6] || ""
        }));
        const idx = allTransactions.findIndex(t => t.id === transaction.id);
        if (idx !== -1) {
          const cellRow = idx + 2;
          await this.updateRange(`transactions!A${cellRow}:G${cellRow}`, [[
            transaction.id,
            transaction.date,
            transaction.group,
            transaction.subgroup,
            transaction.amount,
            transaction.description || "",
            transaction.savings_account_id || ""
          ]]);
          return;
        }
      } catch (e) {
        console.error("Sheets updateTransaction failed, falling back to local.", e);
      }
    }
    const idx = this.localData.transactions.findIndex(t => t.id === transaction.id);
    if (idx !== -1) {
      this.localData.transactions[idx] = transaction;
      this.saveLocal('transactions');
    }
  }

  // ==========================================================================
  // Income Ledger Methods
  // ==========================================================================
  async getIncome(monthYear = null) {
    let rows = [];
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("income_ledger!A2:F");
        rows = data.map(r => ({
          id: r[0] || "",
          date: r[1] || "",
          source: r[2] || "",
          amount: parseFloat(r[3] || "0"),
          description: r[4] || "",
          tithable: r[5] === "TRUE" || r[5] === true
        }));
      } catch (e) {
        console.error("Sheets income read failed.", e);
        rows = this.localData.income_ledger;
      }
    } else {
      rows = this.localData.income_ledger;
    }

    if (monthYear) {
      return rows.filter(r => {
        if (!r.date) return false;
        const [y, m, d] = r.date.split('-');
        return `${m}-${y}` === monthYear;
      });
    }
    return rows;
  }

  async addIncome(income) {
    if (!income.id) income.id = window.generateUUID();
    if (this.isGoogleConnected()) {
      try {
        await this.appendRow("income_ledger!A:F", [
          income.id,
          income.date,
          income.source,
          income.amount,
          income.description || "",
          income.tithable || false
        ]);
        return;
      } catch (e) {
        console.error("Sheets income insert failed.", e);
      }
    }
    this.localData.income_ledger.push(income);
    this.saveLocal('income_ledger');
  }

  async deleteIncome(id) {
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("income_ledger!A2:F");
        const allIncome = data.map(r => ({
          id: r[0] || "",
          date: r[1] || "",
          source: r[2] || "",
          amount: parseFloat(r[3] || "0"),
          description: r[4] || "",
          tithable: r[5] === "TRUE" || r[5] === true
        }));
        const filtered = allIncome.filter(i => i.id !== id);
        
        // Clear existing range by writing empty rows
        const clearMatrix = Array(allIncome.length + 10).fill(["", "", "", "", "", ""]);
        await this.updateRange(`income_ledger!A2:F${allIncome.length + 12}`, clearMatrix);
        
        // Write the filtered list
        if (filtered.length > 0) {
          const writeMatrix = filtered.map(i => [
            i.id,
            i.date,
            i.source,
            i.amount,
            i.description || "",
            i.tithable || false
          ]);
          await this.updateRange("income_ledger!A2", writeMatrix);
        }
        return;
      } catch (e) {
        console.error("Sheets deleteIncome failed, falling back to local.", e);
      }
    }
    this.localData.income_ledger = this.localData.income_ledger.filter(i => i.id !== id);
    this.saveLocal('income_ledger');
  }

  async updateIncome(income) {
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("income_ledger!A2:F");
        const allIncome = data.map(r => ({
          id: r[0] || "",
          date: r[1] || "",
          source: r[2] || "",
          amount: parseFloat(r[3] || "0"),
          description: r[4] || "",
          tithable: r[5] === "TRUE" || r[5] === true
        }));
        const idx = allIncome.findIndex(i => i.id === income.id);
        if (idx !== -1) {
          const cellRow = idx + 2;
          await this.updateRange(`income_ledger!A${cellRow}:F${cellRow}`, [[
            income.id,
            income.date,
            income.source,
            income.amount,
            income.description || "",
            income.tithable || false
          ]]);
          return;
        }
      } catch (e) {
        console.error("Sheets updateIncome failed, falling back to local.", e);
      }
    }
    const idx = this.localData.income_ledger.findIndex(i => i.id === income.id);
    if (idx !== -1) {
      this.localData.income_ledger[idx] = income;
      this.saveLocal('income_ledger');
    }
  }

  // ==========================================================================
  // Savings Accounts Methods
  // ==========================================================================
  async getSavingsAccounts() {
    let rows = [];
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("savings_accounts!A2:G");
        rows = data.map(r => ({
          account_id: r[0] || "",
          account_name: r[1] || "",
          target_amount: r[2] ? parseFloat(r[2]) : null,
          target_date: r[3] || null,
          date_logged: r[4] || "",
          amount_added: parseFloat(r[5] || "0"),
          ref_id: r[6] || ""
        }));
      } catch (e) {
        console.error("Sheets savings read failed.", e);
        rows = this.localData.savings_accounts;
      }
    } else {
      rows = this.localData.savings_accounts;
    }
    return rows;
  }

  async addSavingsAllocation(allocation) {
    if (this.isGoogleConnected()) {
      try {
        await this.appendRow("savings_accounts!A:G", [
          allocation.account_id,
          allocation.account_name,
          allocation.target_amount,
          allocation.target_date,
          allocation.date_logged,
          allocation.amount_added,
          allocation.ref_id || ""
        ]);
        return;
      } catch (e) {
        console.error("Sheets savings insert failed.", e);
      }
    }
    this.localData.savings_accounts.push(allocation);
    this.saveLocal('savings_accounts');
  }

  async deleteSavingsAllocationByRef(refId) {
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("savings_accounts!A2:G");
        const allSavings = data.map(r => ({
          account_id: r[0] || "",
          account_name: r[1] || "",
          target_amount: r[2] ? parseFloat(r[2]) : null,
          target_date: r[3] || null,
          date_logged: r[4] || "",
          amount_added: parseFloat(r[5] || "0"),
          ref_id: r[6] || ""
        }));
        const filtered = allSavings.filter(s => s.ref_id !== refId);
        
        // Clear
        const clearMatrix = Array(allSavings.length + 10).fill(["", "", "", "", "", "", ""]);
        await this.updateRange(`savings_accounts!A2:G${allSavings.length + 12}`, clearMatrix);
        
        // Rewrite
        if (filtered.length > 0) {
          const writeMatrix = filtered.map(s => [
            s.account_id,
            s.account_name,
            s.target_amount,
            s.target_date,
            s.date_logged,
            s.amount_added,
            s.ref_id || ""
          ]);
          await this.updateRange("savings_accounts!A2", writeMatrix);
        }
        return;
      } catch (e) {
        console.error("Sheets deleteSavingsAllocationByRef failed, falling back to local.", e);
      }
    }
    this.localData.savings_accounts = this.localData.savings_accounts.filter(s => s.ref_id !== refId);
    this.saveLocal('savings_accounts');
  }

  async upsertSavingsAllocationByRef(allocation) {
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("savings_accounts!A2:G");
        const allSavings = data.map(r => ({
          account_id: r[0] || "",
          account_name: r[1] || "",
          target_amount: r[2] ? parseFloat(r[2]) : null,
          target_date: r[3] || null,
          date_logged: r[4] || "",
          amount_added: parseFloat(r[5] || "0"),
          ref_id: r[6] || ""
        }));
        const idx = allSavings.findIndex(s => s.ref_id === allocation.ref_id);
        if (idx !== -1) {
          // Update specific row
          const cellRow = idx + 2;
          await this.updateRange(`savings_accounts!A${cellRow}:G${cellRow}`, [[
            allocation.account_id,
            allocation.account_name,
            allocation.target_amount,
            allocation.target_date,
            allocation.date_logged,
            allocation.amount_added,
            allocation.ref_id || ""
          ]]);
          return;
        } else {
          // Append new
          await this.appendRow("savings_accounts!A:G", [
            allocation.account_id,
            allocation.account_name,
            allocation.target_amount,
            allocation.target_date,
            allocation.date_logged,
            allocation.amount_added,
            allocation.ref_id || ""
          ]);
          return;
        }
      } catch (e) {
        console.error("Sheets upsertSavingsAllocationByRef failed, falling back to local.", e);
      }
    }
    const idx = this.localData.savings_accounts.findIndex(s => s.ref_id === allocation.ref_id);
    if (idx !== -1) {
      this.localData.savings_accounts[idx] = allocation;
    } else {
      this.localData.savings_accounts.push(allocation);
    }
    this.saveLocal('savings_accounts');
  }

  async updateSavingsAccountTargets(accountId, targetAmount, targetDate) {
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("savings_accounts!A2:G");
        const allSavings = data.map(r => ({
          account_id: r[0] || "",
          account_name: r[1] || "",
          target_amount: r[2] ? parseFloat(r[2]) : null,
          target_date: r[3] || null,
          date_logged: r[4] || "",
          amount_added: parseFloat(r[5] || "0"),
          ref_id: r[6] || ""
        }));
        
        const updated = allSavings.map(s => {
          if (s.account_id === accountId) {
            return {
              ...s,
              target_amount: targetAmount,
              target_date: targetDate
            };
          }
          return s;
        });

        // Clear
        const clearMatrix = Array(allSavings.length + 10).fill(["", "", "", "", "", "", ""]);
        await this.updateRange(`savings_accounts!A2:G${allSavings.length + 12}`, clearMatrix);
        
        // Rewrite
        if (updated.length > 0) {
          const writeMatrix = updated.map(s => [
            s.account_id,
            s.account_name,
            s.target_amount,
            s.target_date,
            s.date_logged,
            s.amount_added,
            s.ref_id || ""
          ]);
          await this.updateRange("savings_accounts!A2", writeMatrix);
        }
        return;
      } catch (e) {
        console.error("Sheets updateSavingsAccountTargets failed, falling back to local.", e);
      }
    }
    
    this.localData.savings_accounts = this.localData.savings_accounts.map(s => {
      if (s.account_id === accountId) {
        return {
          ...s,
          target_amount: targetAmount,
          target_date: targetDate
        };
      }
      return s;
    });
    this.saveLocal('savings_accounts');
  }

  async deleteSavingsAccount(accountId) {
    let accountName = "";
    
    // Find account name from existing allocations
    let allSavings = [];
    if (this.isGoogleConnected()) {
      try {
        const data = (await this.readRange("savings_accounts!A2:G")) || [];
        allSavings = data.map(r => ({
          account_id: r[0] || "",
          account_name: r[1] || "",
          target_amount: r[2] ? parseFloat(r[2]) : null,
          target_date: r[3] || null,
          date_logged: r[4] || "",
          amount_added: parseFloat(r[5] || "0"),
          ref_id: r[6] || ""
        }));
      } catch (e) {
        console.error("Sheets savings read failed during delete.", e);
        allSavings = this.localData.savings_accounts;
      }
    } else {
      allSavings = this.localData.savings_accounts;
    }
    
    const accAllocations = allSavings.filter(s => s.account_id === accountId);
    if (accAllocations.length > 0) {
      accountName = accAllocations[0].account_name;
    }
    
    // 1. Delete all allocations for this account_id
    if (this.isGoogleConnected()) {
      try {
        const filteredSavings = allSavings.filter(s => s.account_id !== accountId);
        
        // Clear range
        const clearMatrix = Array(allSavings.length + 10).fill(["", "", "", "", "", "", ""]);
        await this.updateRange(`savings_accounts!A2:G${allSavings.length + 12}`, clearMatrix);
        
        // Rewrite
        if (filteredSavings.length > 0) {
          const writeMatrix = filteredSavings.map(s => [
            s.account_id,
            s.account_name,
            s.target_amount,
            s.target_date,
            s.date_logged,
            s.amount_added,
            s.ref_id || ""
          ]);
          await this.updateRange("savings_accounts!A2", writeMatrix);
        }
      } catch (e) {
        console.error("Sheets deleteSavingsAccount allocations failed.", e);
      }
    }
    
    // Local fallback/sync
    this.localData.savings_accounts = this.localData.savings_accounts.filter(s => s.account_id !== accountId);
    this.saveLocal('savings_accounts');
    
    // 2. Delete monthly config for Savings_Goal with key_name === accountName
    if (accountName) {
      if (this.isGoogleConnected()) {
        try {
          const data = (await this.readRange("monthly_configs!A2:D")) || [];
          const allConfigs = data.map(r => ({
            month_year: r[0] || "",
            config_type: r[1] || "",
            key_name: r[2] || "",
            allocated_value: parseFloat(r[3] || "0")
          }));
          
          const filteredConfigs = allConfigs.filter(c => !(c.config_type === 'Savings_Goal' && c.key_name === accountName));
          
          const clearMatrix = Array(allConfigs.length + 10).fill(["", "", "", ""]);
          await this.updateRange(`monthly_configs!A2:D${allConfigs.length + 12}`, clearMatrix);
          
          if (filteredConfigs.length > 0) {
            const writeMatrix = filteredConfigs.map(c => [
              c.month_year,
              c.config_type,
              c.key_name,
              c.allocated_value
            ]);
            await this.updateRange("monthly_configs!A2", writeMatrix);
          }
        } catch (e) {
          console.error("Sheets deleteSavingsAccount configs failed.", e);
        }
      }
      
      // Local fallback/sync
      this.localData.monthly_configs = this.localData.monthly_configs.filter(
        c => !(c.config_type === 'Savings_Goal' && c.key_name === accountName)
      );
      this.saveLocal('monthly_configs');
    }
  }

  // ==========================================================================================
  // Debt Ledger Methods
  // ==========================================================================
  async getDebts() {
    let rows = [];
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("debt_ledger!A2:E");
        rows = data.map(r => ({
          id: r[0] || "",
          type: r[1] || "",
          description: r[2] || "",
          total_amount: parseFloat(r[3] || "0"),
          date_logged: r[4] || ""
        }));
      } catch (e) {
        console.error("Sheets debts read failed.", e);
        rows = this.localData.debt_ledger;
      }
    } else {
      rows = this.localData.debt_ledger;
    }
    return rows;
  }

  async addDebt(debt) {
    if (!debt.id) debt.id = window.generateUUID();
    if (this.isGoogleConnected()) {
      try {
        await this.appendRow("debt_ledger!A:E", [
          debt.id,
          debt.type,
          debt.description,
          debt.total_amount,
          debt.date_logged
        ]);
        return;
      } catch (e) {
        console.error("Sheets debt insert failed.", e);
      }
    }
    this.localData.debt_ledger.push(debt);
    this.saveLocal('debt_ledger');
  }

  async settleDebt(debtId, amount, date) {
    try {
      const debts = await this.getDebts();
      let targetDebtIndex = debts.findIndex(d => d.id === debtId);
      
      // Robust Fallbacks if ID is not found (e.g. if IDs got mismatched in localStorage)
      if (targetDebtIndex === -1 && debtId) {
        targetDebtIndex = debts.findIndex(d => d.description.trim().toLowerCase() === debtId.trim().toLowerCase());
      }
      if (targetDebtIndex === -1 && debtId) {
        // Broad search checking both ID and description equality
        for (let i = 0; i < debts.length; i++) {
          if (debts[i].id === debtId || debts[i].description === debtId) {
            targetDebtIndex = i;
            break;
          }
        }
      }

      if (targetDebtIndex === -1) {
        throw new Error(`Debt record reference "${debtId}" was not found in your ledger.`);
      }
      
      const targetDebt = debts[targetDebtIndex];
      const newTotal = parseFloat((targetDebt.total_amount - amount).toFixed(2));
      
      if (this.isGoogleConnected()) {
        try {
          const cellRow = targetDebtIndex + 2;
          await this.updateRange(`debt_ledger!D${cellRow}`, [[newTotal]]);
          
          if (targetDebt.type === 'Payable') {
            await this.addTransaction({
              id: window.generateUUID(),
              date,
              group: "Debt",
              subgroup: "Repayment",
              amount,
              description: `Settle Debt: ${targetDebt.description}`
            });
          } else {
            await this.addIncome({
              id: window.generateUUID(),
              date,
              source: "Other",
              amount,
              description: `Settle Debt: ${targetDebt.description}`
            });
          }
          return;
        } catch (e) {
          console.error("Sheets debt settlement write failed, reverting to local.", e);
        }
      }
      
      this.localData.debt_ledger[targetDebtIndex].total_amount = newTotal;
      this.saveLocal('debt_ledger');
      
      if (targetDebt.type === 'Payable') {
        this.localData.transactions.push({
          id: window.generateUUID(),
          date,
          group: "Debt",
          subgroup: "Repayment",
          amount,
          description: `Settle Debt: ${targetDebt.description}`
        });
        this.saveLocal('transactions');
      } else {
        this.localData.income_ledger.push({
          id: window.generateUUID(),
          date,
          source: "Other",
          amount,
          description: `Settle Debt: ${targetDebt.description}`
        });
        this.saveLocal('income_ledger');
      }
    } catch (err) {
      console.error("settleDebt error: ", err);
      throw err;
    }
  }

  // ==========================================================================
  // Monthly Configuration Methods
  // ==========================================================================
  async getAllMonthlyConfigs() {
    let rows = [];
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("monthly_configs!A2:D");
        rows = data.map(r => ({
          month_year: r[0] || "",
          config_type: r[1] || "",
          key_name: r[2] || "",
          allocated_value: parseFloat(r[3] || "0")
        }));
      } catch (e) {
        console.error("Sheets monthly config read failed.", e);
        rows = this.localData.monthly_configs;
      }
    } else {
      rows = this.localData.monthly_configs;
    }
    return rows;
  }

  async getMonthlyConfig(monthYear) {
    const rows = await this.getAllMonthlyConfigs();
    return rows.filter(r => r.month_year === monthYear);
  }

  async saveMonthlyConfig(monthYear, configs) {
    // configs is an array of { config_type, key_name, allocated_value }
    if (this.isGoogleConnected()) {
      try {
        // Read all configs first to keep other months intact
        const data = await this.readRange("monthly_configs!A2:D");
        const allConfigs = data.map(r => ({
          month_year: r[0] || "",
          config_type: r[1] || "",
          key_name: r[2] || "",
          allocated_value: parseFloat(r[3] || "0")
        }));
        
        // Filter out current month configs
        const otherMonthsConfigs = allConfigs.filter(r => r.month_year !== monthYear);
        
        // Merge in the new configs
        const updatedConfigsList = [...otherMonthsConfigs, ...configs.map(c => ({
          month_year: monthYear,
          config_type: c.config_type,
          key_name: c.key_name,
          allocated_value: c.allocated_value
        }))];
        
        // Rewrite monthly_configs starting at cell A2
        // First clear all existing rows
        const clearMatrix = Array(data.length + 10).fill(["", "", "", ""]);
        await this.updateRange("monthly_configs!A2:D1000", clearMatrix);
        
        // Write the fresh array
        const writeMatrix = updatedConfigsList.map(c => [
          c.month_year,
          c.config_type,
          c.key_name,
          c.allocated_value
        ]);
        await this.updateRange("monthly_configs!A2", writeMatrix);
        return;
      } catch (e) {
        console.error("Sheets monthly config save failed, writing locally.", e);
      }
    }
    
    // Local fallback
    this.localData.monthly_configs = this.localData.monthly_configs.filter(r => r.month_year !== monthYear);
    configs.forEach(c => {
      this.localData.monthly_configs.push({
        month_year: monthYear,
        config_type: c.config_type,
        key_name: c.key_name,
        allocated_value: c.allocated_value
      });
    });
    this.saveLocal('monthly_configs');
  }

  async updateMonthlyBudgetLimit(monthYear, categoryName, newValue) {
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("monthly_configs!A2:D");
        const allConfigs = data.map(r => ({
          month_year: r[0] || "",
          config_type: r[1] || "",
          key_name: r[2] || "",
          allocated_value: parseFloat(r[3] || "0")
        }));
        
        let found = false;
        const updated = allConfigs.map(c => {
          if (c.month_year === monthYear && c.config_type === 'Budget_Limit' && c.key_name === categoryName) {
            found = true;
            return { ...c, allocated_value: newValue };
          }
          return c;
        });

        if (!found) {
          updated.push({
            month_year: monthYear,
            config_type: 'Budget_Limit',
            key_name: categoryName,
            allocated_value: newValue
          });
        }

        const clearMatrix = Array(allConfigs.length + 10).fill(["", "", "", ""]);
        await this.updateRange(`monthly_configs!A2:D${allConfigs.length + 12}`, clearMatrix);
        
        const writeMatrix = updated.map(c => [
          c.month_year,
          c.config_type,
          c.key_name,
          c.allocated_value
        ]);
        await this.updateRange("monthly_configs!A2", writeMatrix);
        return;
      } catch (e) {
        console.error("Sheets updateMonthlyBudgetLimit failed, fallback to local.", e);
      }
    }
    
    // Local update
    const idx = this.localData.monthly_configs.findIndex(
      c => c.month_year === monthYear && c.config_type === 'Budget_Limit' && c.key_name === categoryName
    );
    if (idx !== -1) {
      this.localData.monthly_configs[idx].allocated_value = newValue;
    } else {
      this.localData.monthly_configs.push({
        month_year: monthYear,
        config_type: 'Budget_Limit',
        key_name: categoryName,
        allocated_value: newValue
      });
    }
    this.saveLocal('monthly_configs');
  }

  async updateCarryOverCash(monthYear, newValue) {
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("monthly_configs!A2:D");
        const allConfigs = data.map(r => ({
          month_year: r[0] || "",
          config_type: r[1] || "",
          key_name: r[2] || "",
          allocated_value: parseFloat(r[3] || "0")
        }));
        
        let found = false;
        const updated = allConfigs.map(c => {
          if (c.month_year === monthYear && c.config_type === 'Carry_Over' && c.key_name === 'Carry-over Cash') {
            found = true;
            return { ...c, allocated_value: newValue };
          }
          return c;
        });

        if (!found) {
          updated.push({
            month_year: monthYear,
            config_type: 'Carry_Over',
            key_name: 'Carry-over Cash',
            allocated_value: newValue
          });
        }

        const clearMatrix = Array(allConfigs.length + 10).fill(["", "", "", ""]);
        await this.updateRange(`monthly_configs!A2:D${allConfigs.length + 12}`, clearMatrix);
        
        const writeMatrix = updated.map(c => [
          c.month_year,
          c.config_type,
          c.key_name,
          c.allocated_value
        ]);
        await this.updateRange("monthly_configs!A2", writeMatrix);
        return;
      } catch (e) {
        console.error("Sheets updateCarryOverCash failed, fallback to local.", e);
      }
    }
    
    // Local update
    const idx = this.localData.monthly_configs.findIndex(
      c => c.month_year === monthYear && c.config_type === 'Carry_Over' && c.key_name === 'Carry-over Cash'
    );
    if (idx !== -1) {
      this.localData.monthly_configs[idx].allocated_value = newValue;
    } else {
      this.localData.monthly_configs.push({
        month_year: monthYear,
        config_type: 'Carry_Over',
        key_name: 'Carry-over Cash',
        allocated_value: newValue
      });
    }
    this.saveLocal('monthly_configs');
  }

  async updateMonthlySavingsGoal(monthYear, newValue) {
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("monthly_configs!A2:D");
        const allConfigs = data.map(r => ({
          month_year: r[0] || "",
          config_type: r[1] || "",
          key_name: r[2] || "",
          allocated_value: parseFloat(r[3] || "0")
        }));
        
        let found = false;
        const updated = allConfigs.map(c => {
          if (c.month_year === monthYear && c.config_type === 'Savings_Goal' && c.key_name === 'Monthly Savings Goal') {
            found = true;
            return { ...c, allocated_value: newValue };
          }
          return c;
        });

        if (!found) {
          updated.push({
            month_year: monthYear,
            config_type: 'Savings_Goal',
            key_name: 'Monthly Savings Goal',
            allocated_value: newValue
          });
        }

        const clearMatrix = Array(allConfigs.length + 10).fill(["", "", "", ""]);
        await this.updateRange(`monthly_configs!A2:D${allConfigs.length + 12}`, clearMatrix);
        
        const writeMatrix = updated.map(c => [
          c.month_year,
          c.config_type,
          c.key_name,
          c.allocated_value
        ]);
        await this.updateRange("monthly_configs!A2", writeMatrix);
        return;
      } catch (e) {
        console.error("Sheets updateMonthlySavingsGoal failed, fallback to local.", e);
      }
    }
    
    // Local update
    const idx = this.localData.monthly_configs.findIndex(
      c => c.month_year === monthYear && c.config_type === 'Savings_Goal' && c.key_name === 'Monthly Savings Goal'
    );
    if (idx !== -1) {
      this.localData.monthly_configs[idx].allocated_value = newValue;
    } else {
      this.localData.monthly_configs.push({
        month_year: monthYear,
        config_type: 'Savings_Goal',
        key_name: 'Monthly Savings Goal',
        allocated_value: newValue
      });
    }
    this.saveLocal('monthly_configs');
  }

  async updateMonthlyIncomeGoal(monthYear, newValue) {
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("monthly_configs!A2:D");
        const allConfigs = data.map(r => ({
          month_year: r[0] || "",
          config_type: r[1] || "",
          key_name: r[2] || "",
          allocated_value: parseFloat(r[3] || "0")
        }));
        
        let found = false;
        const updated = allConfigs.map(c => {
          if (c.month_year === monthYear && c.config_type === 'Income_Goal' && c.key_name === 'Salary') {
            found = true;
            return { ...c, allocated_value: newValue };
          }
          return c;
        });

        if (!found) {
          updated.push({
            month_year: monthYear,
            config_type: 'Income_Goal',
            key_name: 'Salary',
            allocated_value: newValue
          });
        }

        const clearMatrix = Array(allConfigs.length + 10).fill(["", "", "", ""]);
        await this.updateRange(`monthly_configs!A2:D${allConfigs.length + 12}`, clearMatrix);
        
        const writeMatrix = updated.map(c => [
          c.month_year,
          c.config_type,
          c.key_name,
          c.allocated_value
        ]);
        await this.updateRange("monthly_configs!A2", writeMatrix);
        return;
      } catch (e) {
        console.error("Sheets updateMonthlyIncomeGoal failed, fallback to local.", e);
      }
    }
    
    // Local update
    const idx = this.localData.monthly_configs.findIndex(
      c => c.month_year === monthYear && c.config_type === 'Income_Goal' && c.key_name === 'Salary'
    );
    if (idx !== -1) {
      this.localData.monthly_configs[idx].allocated_value = newValue;
    } else {
      this.localData.monthly_configs.push({
        month_year: monthYear,
        config_type: 'Income_Goal',
        key_name: 'Salary',
        allocated_value: newValue
      });
    }
    this.saveLocal('monthly_configs');
  }

  async deleteDebt(id) {
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("debt_ledger!A2:E");
        const allDebts = data.map(r => ({
          id: r[0] || "",
          type: r[1] || "",
          description: r[2] || "",
          total_amount: parseFloat(r[3] || "0"),
          date_logged: r[4] || ""
        }));
        const filtered = allDebts.filter(d => d.id !== id);
        
        const clearMatrix = Array(allDebts.length + 10).fill(["", "", "", "", ""]);
        await this.updateRange(`debt_ledger!A2:E${allDebts.length + 12}`, clearMatrix);
        
        if (filtered.length > 0) {
          const writeMatrix = filtered.map(d => [
            d.id,
            d.type,
            d.description,
            d.total_amount,
            d.date_logged
          ]);
          await this.updateRange("debt_ledger!A2", writeMatrix);
        }
        return;
      } catch (e) {
        console.error("Sheets deleteDebt failed, falling back to local.", e);
      }
    }
    this.localData.debt_ledger = this.localData.debt_ledger.filter(d => d.id !== id);
    this.saveLocal('debt_ledger');
  }

  async updateDebt(debt) {
    if (this.isGoogleConnected()) {
      try {
        const data = await this.readRange("debt_ledger!A2:E");
        const allDebts = data.map(r => ({
          id: r[0] || "",
          type: r[1] || "",
          description: r[2] || "",
          total_amount: parseFloat(r[3] || "0"),
          date_logged: r[4] || ""
        }));
        const idx = allDebts.findIndex(d => d.id === debt.id);
        if (idx !== -1) {
          const cellRow = idx + 2;
          await this.updateRange(`debt_ledger!A${cellRow}:E${cellRow}`, [[
            debt.id,
            debt.type,
            debt.description,
            debt.total_amount,
            debt.date_logged
          ]]);
          return;
        }
      } catch (e) {
        console.error("Sheets updateDebt failed, falling back to local.", e);
      }
    }
    const idx = this.localData.debt_ledger.findIndex(d => d.id === debt.id);
    if (idx !== -1) {
      this.localData.debt_ledger[idx] = debt;
      this.saveLocal('debt_ledger');
    }
  }
}

// Expose Database class on window explicitly
window.Database = Database;
