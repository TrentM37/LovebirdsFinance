/* ==========================================================================
   Project Unified Finance: Core Controller & SPA View Router (Globals)
   ========================================================================== */

// Initialize Global Database (exposes window.Database)
const db = new window.Database();

// App State
const state = {
  currentView: 'dashboard',
  activeMonthYear: window.getCurrentMonthYear(), // MM-YYYY
  taxonomy: {},
  monthlyConfig: [],
  googleToken: null,
  editingTransactionId: null,
  editingTransactionType: null,
  editingDebtId: null,
  ledgerTimeScope: 'month',
  incomeTimeScope: 'month'
};

function getCarryOverCashVal() {
  if (!state.monthlyConfig) return 0;
  const carryOverConfig = state.monthlyConfig.find(
    c => c.config_type === 'Carry_Over' && c.key_name === 'Carry-over Cash'
  );
  return carryOverConfig ? carryOverConfig.allocated_value : 0;
}

// Wizard step state tracking
let currentWizardStep = 1;
const wizardState = {
  budgetLimits: {}, // { groupName: limitVal }
  savingsGoal: 0,
  incomeGoal: 0
};

// Map of view IDs to order index for glide transitions
const VIEW_ORDER = {
  'dashboard': 0,
  'ledger': 1,
  'budget': 2,
  'savings': 3,
  'debts': 4,
  'analytics': 5,
  'wizard': 6
};

// ==========================================================================
// Bootstrapping & Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Bind Nav buttons
  bindNavigation();
  
  // Bind FAB interactions
  bindFAB();
  
  // Bind Month selectors
  bindMonthSelector();
  
  // Bind forms & validation
  bindForms();
  
  // Bind Settings / Google Connect
  bindSettings();

  // Bind Analytics Insight Engine
  bindAnalytics();
  
  // Initial Boot load
  await refreshApplicationData();
  
  // Load default initial route
  navigateTo('dashboard');

  // Bind click-outside listeners to close popups
  bindOutsideClicks();

  // Initialize Welcome / Splash Screen Gate
  const welcomeScreen = document.getElementById('welcome-screen');

  if (welcomeScreen) {
    if (db.isGoogleConnected()) {
      // Keep overlay active for a brief split-second (1.5s) to show the animated entry
      setTimeout(() => {
        welcomeScreen.classList.add('hidden');
      }, 1500);
    } else {
      // Google not connected, keep user locked on the splash page until bypass/sign-in
      welcomeScreen.classList.remove('hidden');
    }
  }
});

function bindOutsideClicks() {
  // Close Form Overlay when clicking outside drawers
  const formOverlay = document.getElementById('form-overlay-container');
  if (formOverlay) {
    formOverlay.addEventListener('click', (e) => {
      if (e.target === formOverlay) {
        closeFormDrawer();
      }
    });
  }

  // Close Custom Confirmation/Warning Modal when clicking outside the modal box
  const confirmBackdrop = document.getElementById('modal-backdrop');
  if (confirmBackdrop) {
    confirmBackdrop.addEventListener('click', (e) => {
      if (e.target === confirmBackdrop) {
        confirmBackdrop.classList.remove('active');
        const btnNo = document.getElementById('confirm-modal-no');
        if (btnNo) {
          btnNo.style.display = "";
        }
        const btnYes = document.getElementById('confirm-modal-yes');
        if (btnYes) {
          btnYes.textContent = "Confirm";
        }
      }
    });
  }

  // Close Transaction Details Modal when clicking outside the details card
  const detailsBackdrop = document.getElementById('details-modal-backdrop');
  if (detailsBackdrop) {
    detailsBackdrop.addEventListener('click', (e) => {
      if (e.target === detailsBackdrop) {
        detailsBackdrop.classList.remove('active');
      }
    });
  }

  // Close Savings Transfer Details Modal when clicking outside the details card
  const savTransferBackdrop = document.getElementById('sav-transfer-modal-backdrop');
  if (savTransferBackdrop) {
    savTransferBackdrop.addEventListener('click', (e) => {
      if (e.target === savTransferBackdrop) {
        savTransferBackdrop.classList.remove('active');
      }
    });
  }
}

/**
 * Loads all taxonomy and configuration data from db
 */
async function refreshApplicationData() {
  state.taxonomy = await db.getCategories();
  state.monthlyConfig = await db.getMonthlyConfig(state.activeMonthYear);
  
  // Refresh whichever view is currently active, unless it is the wizard (to prevent focus loss during typing)
  if (state.currentView !== 'wizard') {
    renderActiveView();
  }
}

// ==========================================================================
// SPA View Router & Glide Animations
// ==========================================================================
function bindNavigation() {
  // Mobile Nav items
  document.querySelectorAll('.mobile-nav-bar .nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const viewId = item.getAttribute('data-view');
      if (viewId) navigateTo(viewId);
    });
  });

  // Desktop Sidebar items
  document.querySelectorAll('.desktop-sidebar .sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      const viewId = item.getAttribute('data-view');
      if (viewId) navigateTo(viewId);
    });
  });

  // Dashboard budget card shortcut link
  const budgetCard = document.getElementById('dash-budget-health-card');
  if (budgetCard) {
    budgetCard.addEventListener('click', () => {
      navigateTo('budget');
    });
  }

  // Dashboard savings card shortcut link
  const savingsCard = document.getElementById('dash-savings-goal-card');
  if (savingsCard) {
    savingsCard.addEventListener('click', () => {
      navigateTo('savings');
    });
  }

  // Dashboard aggregate card shortcut links
  const checkingCard = document.querySelector('.card-checking');
  if (checkingCard) {
    checkingCard.addEventListener('click', () => {
      navigateTo('ledger');
    });
  }

  const savingsBalanceCard = document.querySelector('.card-savings');
  if (savingsBalanceCard) {
    savingsBalanceCard.addEventListener('click', () => {
      navigateTo('savings');
    });
  }

  const netMonthlyCard = document.querySelector('.card-net-monthly');
  if (netMonthlyCard) {
    netMonthlyCard.addEventListener('click', () => {
      const segmentButtons = document.querySelectorAll('#analytics-segment-bar .segment-btn');
      segmentButtons.forEach(btn => {
        if (btn.getAttribute('data-segment') === 'net') {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      state.analyticsCategory = 'ALL';
      state.selectedAnalyticsMonthIndex = null;
      navigateTo('analytics');
    });
  }
}

/**
 * Transition to target view using lateral hardware-accelerated slide
 * @param {string} viewId 
 */
function navigateTo(viewId) {
  if (state.currentView === viewId) return;

  if (viewId === 'wizard' && !db.isGoogleConnected()) {
    showConfirmModal(
      "Sign In Required",
      "You are currently offline. Please sign in to your Google Account to plan your monthly budget.",
      () => {
        reauthorizeGoogleSheets();
      }
    );
    return;
  }
  
  const currentEl = document.getElementById(`view-${state.currentView}`);
  const targetEl = document.getElementById(`view-${viewId}`);
  if (!currentEl || !targetEl) return;
  
  // Close FAB if open
  document.querySelector('.flex-fab-container').classList.remove('open');
  
  const curIndex = VIEW_ORDER[state.currentView];
  const tarIndex = VIEW_ORDER[viewId];
  const direction = tarIndex > curIndex ? 'right' : 'left';
  
  const prevViewId = state.currentView;
  
  // Update state
  state.currentView = viewId;
  
  // Sync Nav highlight states
  document.querySelectorAll('.nav-item, .sidebar-item').forEach(item => {
    if (item.getAttribute('data-view') === viewId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Render view components
  renderActiveView();

  // Apply sliding animation classes (keep both active during transition)
  currentEl.className = 'app-view active';
  targetEl.className = 'app-view active';
  
  if (direction === 'right') {
    currentEl.classList.add('glide-out-left');
    targetEl.classList.add('glide-in-right');
  } else {
    currentEl.classList.add('glide-out-right');
    targetEl.classList.add('glide-in-left');
  }
  
  // Cleanup outgoing view after transition completes (350ms)
  setTimeout(() => {
    if (state.currentView !== prevViewId) {
      currentEl.className = 'app-view';
    }
  }, 350);
}

// Expose routing function globally
window.navigateTo = navigateTo;

/**
 * Route data rendering calls based on active view
 */
function renderActiveView() {
  switch (state.currentView) {
    case 'dashboard':
      renderDashboardView();
      break;
    case 'ledger':
      renderLedgerView();
      break;
    case 'budget':
      renderBudgetView();
      break;
    case 'savings':
      renderSavingsView();
      break;
    case 'debts':
      renderDebtsView();
      break;
    case 'analytics':
      renderAnalyticsView();
      break;
    case 'wizard':
      renderWizardView();
      break;
  }
}

// ==========================================================================
// Month Picker Logic
// ==========================================================================
function bindMonthSelector() {
  const monthInputs = document.querySelectorAll('.global-month-picker');
  const mLabel = document.getElementById('current-month-label');
  const dLabel = document.getElementById('desktop-month-label');
  
  if (monthInputs.length > 0) {
    // Set to current month by default
    const [m, y] = state.activeMonthYear.split('-');
    const valStr = `${y}-${m}`;
    
    monthInputs.forEach(input => {
      input.value = valStr;
    });
    
    // Update labels
    const readableMonth = window.formatMonthYearReadable(state.activeMonthYear);
    if (mLabel) mLabel.textContent = readableMonth;
    if (dLabel) dLabel.textContent = readableMonth;

    monthInputs.forEach(input => {
      if (!input.dataset.boundSelector) {
        input.dataset.boundSelector = "true";
        input.addEventListener('change', async (e) => {
          const val = e.target.value; // YYYY-MM
          if (!val) return;
          const [y, m] = val.split('-');
          state.activeMonthYear = `${m}-${y}`;
          
          // Sync all inputs
          monthInputs.forEach(inp => {
            inp.value = val;
          });
          
          const newReadable = window.formatMonthYearReadable(state.activeMonthYear);
          if (mLabel) mLabel.textContent = newReadable;
          if (dLabel) dLabel.textContent = newReadable;
          
          resetWizardState();
          await refreshApplicationData();
        });
      }
    });
  }
}

// ==========================================================================
// View Renders
// ==========================================================================

// --- 1. Dashboard View ---
async function renderDashboardView() {
  const transactions = await db.getTransactions(state.activeMonthYear);
  const incomeList = await db.getIncome(state.activeMonthYear);
  const savingsAllocations = await db.getSavingsAccounts();

  // Check if the plan for the active month is completed
  const hasPlanCompleted = state.monthlyConfig.some(
    c => c.config_type === 'Plan_Completed' && c.key_name === 'Completed' && c.allocated_value === 1
  );
  const promoTile = document.getElementById('dash-promo-wizard-container');
  if (promoTile) {
    // Check if the selected month is in the future relative to the actual system calendar date
    const today = new Date();
    const curSysM = today.getMonth() + 1;
    const curSysY = today.getFullYear();
    const [actM, actY] = state.activeMonthYear.split('-').map(Number);
    const isFutureMonth = (actY > curSysY) || (actY === curSysY && actM > curSysM);

    if (!isFutureMonth) {
      promoTile.style.display = 'block';
      const activeMonthName = getMonthName(state.activeMonthYear);
      const promoHeader = promoTile.querySelector('h2');
      const promoText = promoTile.querySelector('.text-meta');
      
      if (hasPlanCompleted) {
        if (promoHeader) {
          promoHeader.textContent = `Review ${activeMonthName} Plan`;
        }
        if (promoText) {
          promoText.textContent = `Click to view or adjust your budget limits, savings goals, and income goals for this cycle.`;
        }
      } else {
        if (promoHeader) {
          promoHeader.textContent = `Start ${activeMonthName}'s Monthly Plan`;
        }
        if (promoText) {
          promoText.textContent = `Set up your budget limits, savings goals, and income goals for the new cycle.`;
        }
      }
      
      promoTile.onclick = () => {
        navigateTo('wizard');
      };
    } else {
      promoTile.style.display = 'none';
    }
  }

  // Aggregate stats
  const spentTotal = transactions.reduce((sum, t) => sum + t.amount, 0);
  const incomeTotal = incomeList.reduce((sum, i) => sum + i.amount, 0);
  
  // Budget caps sum
  const budgetCaps = state.monthlyConfig.filter(c => c.config_type === 'Budget_Limit');
  const budgetTotalCap = budgetCaps.reduce((sum, c) => sum + c.allocated_value, 0);
  
  // Savings goals sum
  const savingsGoals = state.monthlyConfig.filter(c => c.config_type === 'Savings_Goal');
  const savingsTotalGoal = savingsGoals.reduce((sum, c) => sum + c.allocated_value, 0);
  
  // Actual Savings allocation during this month
  const savingsMonthAllocated = savingsAllocations
    .filter(s => {
      if (!s.date_logged) return false;
      const [y, m, d] = s.date_logged.split('-');
      return `${m}-${y}` === state.activeMonthYear;
    })
    .reduce((sum, s) => sum + s.amount_added, 0);

  // Render Aggregate Progress Cards
  const budgetPct = budgetTotalCap > 0 ? (spentTotal / budgetTotalCap) * 100 : 0;
  document.getElementById('dash-budget-progress-info').innerHTML = `
    <span>Monthly Budget Spent: <strong>${window.formatCurrency(spentTotal)}</strong></span>
    <span>Limit: ${window.formatCurrency(budgetTotalCap)}</span>
  `;
  const budgetFill = document.getElementById('dash-budget-progress-fill');
  budgetFill.style.width = `${Math.min(budgetPct, 100)}%`;
  budgetFill.className = `progress-bar-fill ${spentTotal > budgetTotalCap ? 'progress-alert' : 'progress-normal'}`;

  const goalPct = savingsTotalGoal > 0 ? (savingsMonthAllocated / savingsTotalGoal) * 100 : 0;
  document.getElementById('dash-goal-progress-info').innerHTML = `
    <span>Monthly Savings Allocated: <strong>${window.formatCurrency(savingsMonthAllocated)}</strong></span>
    <span>Target Goal: ${window.formatCurrency(savingsTotalGoal)}</span>
  `;
  const goalFill = document.getElementById('dash-goal-progress-fill');
  goalFill.style.width = `${Math.min(goalPct, 100)}%`;

  // Liquid assets calculations
  // Liquid Cash = Total Historical Inflows - Total Historical Outflows - Total Savings allocations
  const allHistoricalIn = (await db.getIncome()).reduce((sum, i) => sum + i.amount, 0);
  const allHistoricalOut = (await db.getTransactions()).reduce((sum, t) => sum + t.amount, 0);
  const allHistoricalSavings = savingsAllocations.reduce((sum, s) => sum + s.amount_added, 0);
  const liquidCash = allHistoricalIn - allHistoricalOut - allHistoricalSavings;

  // Savings Balances
  const uniqueAccounts = {};
  savingsAllocations.forEach(s => {
    uniqueAccounts[s.account_id] = (uniqueAccounts[s.account_id] || 0) + s.amount_added;
  });
  const totalSavingsVal = Object.values(uniqueAccounts).reduce((sum, val) => sum + val, 0);


  document.getElementById('cash-balance-val').textContent = window.formatCurrency(liquidCash);
  document.getElementById('savings-balance-val').textContent = window.formatCurrency(totalSavingsVal);

  // Cash availability visualizer updates
  // Checking/Liquid balance is liquidCash; savings is totalSavingsVal; carryOver is calculated via getCarryOverCashVal()
  const checkingBalance = liquidCash;
  const carryOver = getCarryOverCashVal();
  
  // Calculate expected expenses: remaining budget for that month (cap - spent)
  const remainingBudget = Math.max(0, budgetTotalCap - spentTotal);
  const expectedExpenses = remainingBudget;
  const savingsCashVal = Math.max(0, totalSavingsVal);

  // Free cash = Checking balance - expected monthly expenses - carry over. Can not be negative
  const freeCashRaw = checkingBalance - expectedExpenses - carryOver;
  const freeCash = Math.max(0, freeCashRaw);

  let freePct = 0;
  let expectedPct = 0;
  let savingsPct = 0;
  let carryOverPct = 0;
  let deficitPct = 0;
  
  // Deficit = basically what has gone over.
  // Only calculate the deficit if expected expenses are greater than available checking cash
  let deficitVal = 0;
  const availableChecking = checkingBalance - carryOver;
  if (expectedExpenses > availableChecking) {
    deficitVal = expectedExpenses - availableChecking;
  }

  const allocationCard = document.querySelector('.cash-allocation-card');
  const allocationBar = document.querySelector('.cash-allocation-bar');

  if (deficitVal > 0) {
    // Deficit case
    if (allocationCard) allocationCard.classList.add('has-deficit');
    if (allocationBar) allocationBar.classList.add('has-deficit');
    
    // Show deficit legend
    const legendDeficitContainer = document.getElementById('cash-legend-deficit-container');
    if (legendDeficitContainer) legendDeficitContainer.style.display = 'flex';
    const deficitEl = document.getElementById('cash-legend-deficit');
    if (deficitEl) deficitEl.textContent = window.formatCurrency(deficitVal);
    
    let coveredChecking = Math.max(0, checkingBalance);
    let coveredSavings = totalSavingsVal;
    if (checkingBalance < 0) {
      coveredSavings = Math.max(0, totalSavingsVal + checkingBalance);
    }

    const totalNeededChecking = expectedExpenses + carryOver;
    let ratio = 0;
    if (totalNeededChecking > 0) {
      ratio = coveredChecking / totalNeededChecking;
    }
    
    const coveredExpected = expectedExpenses * ratio;
    const coveredCarryOver = carryOver * ratio;
    
    const totalRequired = coveredSavings + coveredExpected + coveredCarryOver + deficitVal;
    
    if (totalRequired > 0) {
      savingsPct = (coveredSavings / totalRequired) * 100;
      expectedPct = (coveredExpected / totalRequired) * 100;
      carryOverPct = (coveredCarryOver / totalRequired) * 100;
      deficitPct = (deficitVal / totalRequired) * 100;
    }
  } else {
    // Normal case (no deficit)
    if (allocationCard) allocationCard.classList.remove('has-deficit');
    if (allocationBar) allocationBar.classList.remove('has-deficit');
    
    const legendDeficitContainer = document.getElementById('cash-legend-deficit-container');
    if (legendDeficitContainer) legendDeficitContainer.style.display = 'none';

    const totalCashForBar = freeCash + expectedExpenses + savingsCashVal + carryOver;
    
    if (totalCashForBar > 0) {
      freePct = (freeCash / totalCashForBar) * 100;
      expectedPct = (expectedExpenses / totalCashForBar) * 100;
      savingsPct = (savingsCashVal / totalCashForBar) * 100;
      carryOverPct = (carryOver / totalCashForBar) * 100;
    }
  }

  const totalCashActual = liquidCash + totalSavingsVal;
  document.getElementById('cash-allocation-total-lbl').textContent = `Total Cash: ${window.formatCurrency(totalCashActual)}`;
  document.getElementById('cash-bar-free').style.width = `${freePct}%`;
  document.getElementById('cash-bar-expected').style.width = `${expectedPct}%`;
  document.getElementById('cash-bar-savings').style.width = `${savingsPct}%`;
  document.getElementById('cash-bar-carry-over').style.width = `${carryOverPct}%`;
  document.getElementById('cash-bar-deficit').style.width = `${deficitPct}%`;
  
  document.getElementById('cash-legend-free').textContent = window.formatCurrency(freeCash);
  document.getElementById('cash-legend-expected').textContent = window.formatCurrency(expectedExpenses);
  document.getElementById('cash-legend-savings').textContent = window.formatCurrency(savingsCashVal);
  const legendCarryOverEl = document.getElementById('cash-legend-carry-over');
  if (legendCarryOverEl) legendCarryOverEl.textContent = window.formatCurrency(carryOver);
  
  const monthlyNetVal = incomeTotal - spentTotal;
  const netEl = document.getElementById('net-balance-val');
  const netCard = document.querySelector('.card-net-monthly');

  netEl.textContent = (monthlyNetVal >= 0 ? '+' : '') + window.formatCurrency(monthlyNetVal);

  if (monthlyNetVal >= 0) {
    if (netCard) {
      netCard.classList.remove('net-negative');
      netCard.classList.add('net-positive');
    }
    document.getElementById('net-balance-label').textContent = "Monthly Net Inflow";
  } else {
    if (netCard) {
      netCard.classList.remove('net-positive');
      netCard.classList.add('net-negative');
    }
    document.getElementById('net-balance-label').textContent = "Monthly Net Outflow";
  }
}

// --- 2. Ledger View ---
async function renderLedgerView() {
  const allTransactions = await db.getTransactions();
  const allIncomes = await db.getIncome();

  // Filter based on selected scope
  let activeTransactions = [];
  let activeIncomes = [];

  if (state.ledgerTimeScope === 'month') {
    activeTransactions = allTransactions.filter(r => {
      if (!r.date) return false;
      const [y, m, d] = r.date.split('-');
      return `${m}-${y}` === state.activeMonthYear;
    });
    activeIncomes = allIncomes.filter(r => {
      if (!r.date) return false;
      const [y, m, d] = r.date.split('-');
      return `${m}-${y}` === state.activeMonthYear;
    });
  } else if (state.ledgerTimeScope === 'year') {
    const activeYear = state.activeMonthYear.split('-')[1];
    activeTransactions = allTransactions.filter(r => {
      if (!r.date) return false;
      const [y, m, d] = r.date.split('-');
      return y === activeYear;
    });
    activeIncomes = allIncomes.filter(r => {
      if (!r.date) return false;
      const [y, m, d] = r.date.split('-');
      return y === activeYear;
    });
  } else {
    // all-time
    activeTransactions = allTransactions;
    activeIncomes = allIncomes;
  }

  // Summary Metrics
  const spentTotal = activeTransactions.reduce((sum, t) => sum + t.amount, 0);
  const incomeTotal = activeIncomes.reduce((sum, i) => sum + i.amount, 0);

  document.getElementById('ledger-total-in').textContent = window.formatCurrency(incomeTotal);
  document.getElementById('ledger-total-out').textContent = window.formatCurrency(spentTotal);

  // Update Pill Buttons active state
  const scopes = ['month', 'year', 'all-time'];
  scopes.forEach(s => {
    const btn = document.getElementById(`ledger-scope-${s === 'all-time' ? 'all' : s}`);
    if (btn) {
      if (state.ledgerTimeScope === s) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });

  // Calculate expenses by category for Segmented Bar
  const categoryTotals = {};
  activeTransactions.forEach(t => {
    categoryTotals[t.group] = (categoryTotals[t.group] || 0) + t.amount;
  });
  const sortedCategories = Object.keys(categoryTotals).sort((a, b) => categoryTotals[b] - categoryTotals[a]);

  const progressContainer = document.getElementById('ledger-expense-progress-container');
  if (progressContainer) {
    progressContainer.innerHTML = '';
  }

  const legendContainer = document.getElementById('ledger-expense-legend');
  if (legendContainer) {
    legendContainer.innerHTML = '';
  }

  const LEDGER_COLORS = [
    '#C98D65', // Muted Orange
    '#E2BCA4', // Muted Pale Terracotta
    '#7E6C87', // Muted Purple
    '#AFA1B5', // Muted Lilac/Lavender
    '#597387', // Muted Slate Blue
    '#91A5B4', // Muted Pale Blue
    '#536859', // Muted Sage/Olive
    '#859C8C', // Muted Mint/Teal
    '#C7A27C', // Muted Warm Gold
    '#A88C74', // Muted Taupe/Wood
    '#C07874', // Muted Dusty Rose
    '#8F997C', // Muted Moss Green
    '#6C7E8A', // Muted Steel Blue
    '#B0A695'  // Muted Warm Gray
  ];

  const knownCategories = Object.keys(state.taxonomy).filter(c => c !== 'Income');
  const getCategoryColor = (categoryName) => {
    const idx = knownCategories.indexOf(categoryName);
    if (idx === -1) return LEDGER_COLORS[LEDGER_COLORS.length - 1];
    return LEDGER_COLORS[idx % LEDGER_COLORS.length];
  };

  if (spentTotal > 0 && progressContainer) {
    sortedCategories.forEach(categoryName => {
      const amt = categoryTotals[categoryName];
      const pct = (amt / spentTotal) * 100;
      const color = getCategoryColor(categoryName);
      
      const segment = document.createElement('div');
      segment.style.height = '100%';
      segment.style.width = `${pct}%`;
      segment.style.backgroundColor = color;
      segment.style.transition = 'width 0.4s var(--transition-glide)';
      segment.title = `${categoryName}: ${window.formatCurrency(amt)} (${pct.toFixed(1)}%)`;
      progressContainer.appendChild(segment);

      if (legendContainer) {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.style.display = 'flex';
        legendItem.style.alignItems = 'center';
        legendItem.style.gap = '6px';
        legendItem.style.fontSize = '11px';
        
        const dot = document.createElement('span');
        dot.className = 'legend-dot';
        dot.style.width = '10px';
        dot.style.height = '10px';
        dot.style.borderRadius = '50%';
        dot.style.display = 'inline-block';
        dot.style.backgroundColor = color;
        
        const text = document.createElement('span');
        text.innerHTML = `${categoryName}: <strong>${window.formatCurrency(amt)}</strong> (${pct.toFixed(0)}%)`;
        
        legendItem.appendChild(dot);
        legendItem.appendChild(text);
        legendContainer.appendChild(legendItem);
      }
    });
  } else if (progressContainer) {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.width = '100%';
    emptyMsg.style.textAlign = 'center';
    emptyMsg.style.fontSize = '10px';
    emptyMsg.style.color = 'var(--color-font-secondary)';
    emptyMsg.style.lineHeight = '10px';
    emptyMsg.textContent = 'No expenses recorded.';
    progressContainer.appendChild(emptyMsg);
  }

  // Combine both expenses and incomes
  const combined = [
    ...activeTransactions.map(t => ({ ...t, type: 'expense' })),
    ...activeIncomes.map(i => ({ ...i, type: 'income', group: 'Income', subgroup: i.source }))
  ];

  // Sort by date newest first
  const sorted = combined.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const tbody = document.getElementById('ledger-tbody');
  tbody.innerHTML = '';
  
  if (sorted.length === 0) {
    const scopeLabel = state.ledgerTimeScope === 'month' ? 'this month' : (state.ledgerTimeScope === 'year' ? 'this year' : 'ever');
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-font-secondary);">No ledger records found ${scopeLabel}.</td></tr>`;
    return;
  }

  sorted.forEach(t => {
    const tr = document.createElement('tr');
    tr.style.cursor = 'pointer';
    
    const tdDate = document.createElement('td');
    tdDate.textContent = window.formatDateShort(t.date);
    
    const tdGroup = document.createElement('td');
    tdGroup.textContent = t.group;
    
    const tdSub = document.createElement('td');
    tdSub.textContent = t.subgroup;
    
    const tdAmt = document.createElement('td');
    if (t.type === 'expense') {
      tdAmt.className = 'tabular-nums amount-negative';
      tdAmt.textContent = `-${window.formatCurrency(t.amount)}`;
    } else {
      tdAmt.className = 'tabular-nums';
      tdAmt.textContent = `+${window.formatCurrency(t.amount)}`;
    }
    
    const tdInfo = document.createElement('td');
    tdInfo.style.textAlign = 'center';
    
    if (t.description && t.description.trim() !== "") {
      const infoBtn = document.createElement('button');
      infoBtn.className = 'info-btn';
      infoBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
      `;
      infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showTransactionDetails(t);
      });
      tdInfo.appendChild(infoBtn);
    }
    
    tr.appendChild(tdDate);
    tr.appendChild(tdGroup);
    tr.appendChild(tdSub);
    tr.appendChild(tdAmt);
    tr.appendChild(tdInfo);
    
    tr.addEventListener('click', () => {
      showTransactionDetails(t);
    });
    
    tbody.appendChild(tr);
  });
}

// --- 3. Budget Groups View ---
async function renderBudgetView() {
  const categories = state.taxonomy;
  const transactions = await db.getTransactions(state.activeMonthYear);
  const configs = state.monthlyConfig.filter(c => c.config_type === 'Budget_Limit');

  const container = document.getElementById('budget-groups-container');
  container.innerHTML = '';

  const groups = Object.keys(categories).filter(g => g !== 'Income');
  if (groups.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--color-font-secondary);">Configure categories inside the Month Plan Wizard.</div>`;
    return;
  }

  // Calculate totals for master budget summary
  let totalLimit = 0;
  let totalSpent = 0;
  let totalBudgetLeft = 0;
  let totalGoneOver = 0;

  groups.forEach(groupName => {
    const groupTransactions = transactions.filter(t => t.group === groupName);
    const spentVal = groupTransactions.reduce((sum, t) => sum + t.amount, 0);
    totalSpent += spentVal;

    const config = configs.find(c => c.key_name === groupName);
    const limitVal = config ? config.allocated_value : 0;
    totalLimit += limitVal;

    // Calculate how much we have left vs how much we have gone over for each category
    if (limitVal > spentVal) {
      totalBudgetLeft += (limitVal - spentVal);
    } else {
      totalGoneOver += (spentVal - limitVal);
    }
  });

  const leftLabel = document.getElementById('budget-master-left-label');
  const spentLabel = document.getElementById('budget-master-spent-label');
  const progressFill = document.getElementById('budget-master-progress-fill');

  if (leftLabel && spentLabel && progressFill) {
    const netRemaining = totalBudgetLeft - totalGoneOver;
    const totalPct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;

    spentLabel.textContent = `Spent: ${window.formatCurrency(totalSpent)} of ${window.formatCurrency(totalLimit)}`;
    progressFill.style.width = `${Math.min(totalPct, 100)}%`;

    if (netRemaining >= 0) {
      leftLabel.textContent = `${window.formatCurrency(netRemaining)} Remaining`;
      leftLabel.style.color = 'var(--color-primary-accent)';
      if (totalPct > 70) {
        progressFill.style.backgroundColor = 'var(--color-savings-gold)';
      } else {
        progressFill.style.backgroundColor = 'var(--color-secondary-accent)';
      }
    } else {
      leftLabel.textContent = `${window.formatCurrency(Math.abs(netRemaining))} Over Budget`;
      leftLabel.style.color = 'var(--color-alert)';
      progressFill.style.backgroundColor = 'var(--color-alert)';
    }
  }

  // Render & bind Carry-over Cash
  const carryOverValEl = document.getElementById('carry-over-val');
  if (carryOverValEl) {
    const carryOverVal = getCarryOverCashVal();
    carryOverValEl.textContent = window.formatCurrency(carryOverVal);

    // Bind Plus & Minus buttons
    const btnPlus = document.getElementById('carry-over-plus');
    const btnMinus = document.getElementById('carry-over-minus');

    if (btnPlus) {
      btnPlus.onclick = async (e) => {
        e.stopPropagation();
        if (carryOverValEl.querySelector('input')) return;
        const currentVal = getCarryOverCashVal();
        const newVal = currentVal + 10;
        await db.updateCarryOverCash(state.activeMonthYear, newVal);
        state.monthlyConfig = await db.getMonthlyConfig(state.activeMonthYear);
        await renderBudgetView();
      };
    }

    if (btnMinus) {
      btnMinus.onclick = async (e) => {
        e.stopPropagation();
        if (carryOverValEl.querySelector('input')) return;
        const currentVal = getCarryOverCashVal();
        const newVal = Math.max(0, currentVal - 10);
        await db.updateCarryOverCash(state.activeMonthYear, newVal);
        state.monthlyConfig = await db.getMonthlyConfig(state.activeMonthYear);
        await renderBudgetView();
      };
    }

    // Bind click-to-edit inline input
    carryOverValEl.onclick = (e) => {
      if (carryOverValEl.querySelector('input')) return;

      const currentVal = getCarryOverCashVal();
      carryOverValEl.innerHTML = `<span style="font-size:12px; font-weight:700;">$</span><input type="text" class="wizard-inline-input" value="${currentVal.toFixed(2)}" style="width: 70px; height: 22px; font-size: 12px; padding: 0 4px;">`;
      const input = carryOverValEl.querySelector('input');
      input.focus();
      input.select();
      bindATMInput(input);

      let updated = false;
      const saveVal = async () => {
        if (updated) return;
        updated = true;
        const newRaw = parseFloat(input.value.replace(/[^0-9.]/g, '')) || 0;
        await db.updateCarryOverCash(state.activeMonthYear, newRaw);
        state.monthlyConfig = await db.getMonthlyConfig(state.activeMonthYear);
        await renderBudgetView();
      };

      input.onblur = saveVal;
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          saveVal();
        }
      };
    };
  }

  groups.forEach(groupName => {
      const groupTransactions = transactions.filter(t => t.group === groupName);
      const spentVal = groupTransactions.reduce((sum, t) => sum + t.amount, 0);

      const config = configs.find(c => c.key_name === groupName);
      const limitVal = config ? config.allocated_value : 0;
      
      const pct = limitVal > 0 ? (spentVal / limitVal) * 100 : 0;

      const remainingVal = limitVal - spentVal;
      let remainingText = "";
      if (remainingVal >= 0) {
        remainingText = `${window.formatCurrency(remainingVal)} remaining`;
      } else {
        remainingText = `${window.formatCurrency(Math.abs(remainingVal))} over`;
      }

      let colorStyle = 'var(--color-primary-accent)';
      let capColorStyle = '';
      let barColorOverride = '';
      if (spentVal > limitVal) {
        colorStyle = 'var(--color-alert)';
        capColorStyle = 'var(--color-alert)';
        barColorOverride = 'var(--color-alert)';
      } else if (pct > 70) {
        colorStyle = 'var(--color-savings-gold)';
        capColorStyle = 'var(--color-savings-gold)';
        barColorOverride = 'var(--color-savings-gold)';
      }

      const block = document.createElement('div');
      block.className = 'tracking-block';
      
      block.innerHTML = `
        <div class="tracking-block-header">
          <span class="tracking-block-title">${groupName}</span>
          <div class="tracking-block-metrics">
            <div class="tracking-block-val tabular-nums" style="color: ${colorStyle};">${remainingText}</div>
            <div class="tracking-block-cap tabular-nums" ${capColorStyle ? `style="color: ${capColorStyle}; opacity: 0.85;"` : ""}>Spent: ${window.formatCurrency(spentVal)} of ${window.formatCurrency(limitVal)}</div>
          </div>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill ${barColorOverride ? '' : 'progress-normal'}" style="width: ${Math.min(pct, 100)}%;${barColorOverride ? ` background-color: ${barColorOverride};` : ''}"></div>
        </div>
      
      <div class="expanded-content">
        <div class="expanded-visuals">
          <div class="metric-detail-box">
            <span class="text-meta">Remaining Budget Capacity</span>
            <div class="metric-large-num tabular-nums ${spentVal > limitVal ? 'amount-negative' : ''}">
              ${window.formatCurrency(limitVal - spentVal)}
            </div>
            <span class="text-helper">${spentVal > limitVal ? 'Over budget limit' : 'Under budget limit'}</span>
          </div>
          <div class="chart-box" id="pie-chart-${groupName.replace(/\s+/g, '-')}">
            <!-- SVG Pie Chart injected here -->
          </div>
        </div>
        
        <h3 style="margin-bottom: var(--spacing-sm);">Group Ledger Activity</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Sub-Category</th>
                <th>Amount</th>
                <th style="width: 40px;"></th>
              </tr>
            </thead>
            <tbody id="transactions-list-${groupName.replace(/\s+/g, '-')}">
            </tbody>
          </table>
        </div>

        <div class="budget-adjust-box" style="margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 1px solid var(--color-border);">
          <h3 style="margin-bottom: var(--spacing-sm);">Adjust Monthly Budget Limit</h3>
          <div style="display: flex; gap: var(--spacing-md); flex-wrap: wrap; align-items: flex-end;">
            <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 130px;">
              <label class="form-label" style="font-size: 11px; margin-bottom: 4px;">Limit Amount</label>
              <div class="amount-wrapper" style="position: relative;">
                <span class="amount-symbol" style="left: 8px; font-size: 11px;">$</span>
                <input type="text" class="form-input amount-field budget-limit-amount" id="budget-limit-amount-${groupName.replace(/\s+/g, '-')}" style="padding: 4px 4px 4px 20px; font-size: 12px; height: auto;" placeholder="0.00">
              </div>
            </div>
            <button class="settings-btn" onclick="window.updateMonthlyBudgetLimit('${groupName}')" style="padding: 6px 12px; font-size: 11px; height: 28px; line-height: 1; display: flex; align-items: center; border-radius: var(--border-radius-sm);">Update Limit</button>
          </div>
        </div>
      </div>
    `;

    block.addEventListener('click', (e) => {
      if (e.target.closest('.table-container') || e.target.closest('.expanded-visuals') || e.target.closest('.budget-adjust-box')) return;
      
      const isExpanded = block.classList.contains('expanded');
      document.querySelectorAll('.tracking-block').forEach(b => b.classList.remove('expanded'));
      
      if (!isExpanded) {
        block.classList.add('expanded');
        renderGroupExpansionDetails(groupName, groupTransactions, limitVal);
        
        const limitAmtInput = document.getElementById(`budget-limit-amount-${groupName.replace(/\s+/g, '-')}`);
        if (limitAmtInput) {
          bindATMInput(limitAmtInput);
          if (limitVal !== null && limitVal !== undefined) {
            limitAmtInput.value = limitVal.toFixed(2);
            limitAmtInput.dispatchEvent(new Event('amountset'));
          }
        }
      }
    });

    container.appendChild(block);
  });
}

function renderGroupExpansionDetails(groupName, groupTransactions, limitVal) {
  const cleanId = groupName.replace(/\s+/g, '-');
  
  const subgroupSums = {};
  groupTransactions.forEach(t => {
    subgroupSums[t.subgroup] = (subgroupSums[t.subgroup] || 0) + t.amount;
  });
  
  const chartData = Object.keys(subgroupSums).map(subName => ({
    label: subName,
    value: subgroupSums[subName]
  }));

  const chartContainer = document.getElementById(`pie-chart-${cleanId}`);
  if (chartContainer) {
    window.renderPieChart(chartContainer, chartData);
  }

  const historyTbody = document.getElementById(`transactions-list-${cleanId}`);
  if (historyTbody) {
    historyTbody.innerHTML = '';
    const sorted = [...groupTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (sorted.length === 0) {
      historyTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-font-secondary);">No transactions logged this month.</td></tr>`;
      return;
    }

    sorted.forEach(t => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML = `
        <td>${window.formatDateShort(t.date)}</td>
        <td>${t.subgroup}</td>
        <td class="tabular-nums amount-negative">-${window.formatCurrency(t.amount)}</td>
        <td style="text-align: center;">
          ${t.description ? `
            <button class="info-btn" data-desc="${t.description}" data-title="${t.subgroup}">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
            </button>
          ` : ''}
        </td>
      `;
      
      const infoBtn = tr.querySelector('.info-btn');
      if (infoBtn) {
        infoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showTransactionDetails({ ...t, type: 'expense' });
        });
      }
      
      tr.addEventListener('click', () => {
        showTransactionDetails({ ...t, type: 'expense' });
      });
      
      historyTbody.appendChild(tr);
    });
  }

}

// --- 4. Savings Accounts View ---
async function renderSavingsView() {
  const allocations = await db.getSavingsAccounts();
  const configs = state.monthlyConfig.filter(c => c.config_type === 'Savings_Goal');

  const savingsMonthAllocated = allocations
    .filter(s => {
      if (!s.date_logged) return false;
      const [y, m, d] = s.date_logged.split('-');
      return `${m}-${y}` === state.activeMonthYear;
    })
    .reduce((sum, s) => sum + s.amount_added, 0);

  const uniqueAccounts = {};
  const accountMetadata = {};
  
  allocations.forEach(s => {
    uniqueAccounts[s.account_id] = (uniqueAccounts[s.account_id] || 0) + s.amount_added;
    accountMetadata[s.account_id] = {
      name: s.account_name,
      target: s.target_amount,
      date: s.target_date
    };
  });
  
  const totalCombinedBalance = Object.values(uniqueAccounts).reduce((sum, v) => sum + v, 0);
  const masterGoalTarget = Object.values(accountMetadata).reduce((sum, m) => sum + (m.target || 0), 0);

  document.getElementById('savings-month-allocated').textContent = window.formatCurrency(savingsMonthAllocated);
  document.getElementById('savings-combined-balance').textContent = window.formatCurrency(totalCombinedBalance);

  // Calculate Free Cash Available (liquid cash minus expected expenses)
  const activeMonthTransactions = await db.getTransactions(state.activeMonthYear);
  const spentTotal = activeMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
  const budgetCaps = state.monthlyConfig.filter(c => c.config_type === 'Budget_Limit');
  const budgetTotalCap = budgetCaps.reduce((sum, c) => sum + c.allocated_value, 0);
  const remainingBudget = Math.max(0, budgetTotalCap - spentTotal);
  
  const allHistoricalIn = (await db.getIncome()).reduce((sum, i) => sum + i.amount, 0);
  const allHistoricalOut = (await db.getTransactions()).reduce((sum, t) => sum + t.amount, 0);
  const allHistoricalSavings = allocations.reduce((sum, s) => sum + s.amount_added, 0);
  const liquidCash = allHistoricalIn - allHistoricalOut - allHistoricalSavings;
  const carryOverVal = getCarryOverCashVal();
  const freeCashVal = Math.max(0, liquidCash - remainingBudget - carryOverVal);

  const freeCashEl = document.getElementById('savings-free-cash');
  if (freeCashEl) {
    freeCashEl.textContent = window.formatCurrency(freeCashVal);
  }

  // Mini Arc Progress updates
  const savingsTotalGoal = configs.reduce((sum, c) => sum + c.allocated_value, 0);
  document.getElementById('savings-month-goal-lbl').textContent = `Goal: ${window.formatCurrency(savingsTotalGoal)}`;
  const arcProgress = savingsTotalGoal > 0 ? (savingsMonthAllocated / savingsTotalGoal) : 0;
  const arcOffset = 69.1 * (1 - Math.min(1, arcProgress));
  const arcFill = document.getElementById('savings-allocated-arc-fill');
  if (arcFill) {
    arcFill.style.strokeDashoffset = arcOffset;
  }


  const container = document.getElementById('savings-accounts-container');
  container.innerHTML = '';

  const accountIds = Object.keys(uniqueAccounts);
  if (accountIds.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--color-font-secondary);">Add a savings block using the floating action menu below.</div>`;
    return;
  }

  accountIds.forEach(accId => {
    const accBalance = uniqueAccounts[accId];
    const meta = accountMetadata[accId];
    const config = configs.find(c => c.key_name === meta.name);
    const monthGoalLimit = config ? config.allocated_value : 0;

    const block = document.createElement('div');
    block.className = 'tracking-block';
    if (meta.target && meta.target > 0 && accBalance >= meta.target) {
      block.classList.add('goal-completed');
    }
    block.innerHTML = `
      <div class="tracking-block-header">
        <span class="tracking-block-title">${meta.name}</span>
        <div class="tracking-block-metrics">
          <div class="tracking-block-val">${window.formatCurrency(accBalance)}</div>
          <div class="tracking-block-cap">Goal: ${meta.target ? window.formatCurrency(meta.target) : 'None'}</div>
        </div>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar-fill progress-normal" style="width: ${meta.target ? Math.min((accBalance / meta.target) * 100, 100) : 0}%"></div>
      </div>
      
      <div class="expanded-content">
        <div class="expanded-visuals">
          <div class="metric-detail-box">
            <span class="text-meta">Target Completion Deadline</span>
            <div style="font-size: 14px; font-weight: 600; color: var(--color-primary-accent); margin: 6px 0;">
              ${meta.date ? window.formatDate(meta.date) : 'Undated Goal'}
            </div>
            <span class="text-helper">Allocated this month: ${window.formatCurrency(monthGoalLimit)}</span>
          </div>

          <div class="metric-detail-box" style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
            <span class="text-meta">Adjust Balance</span>
            <div class="form-group amount-wrapper" style="margin-bottom: 0; position: relative;">
              <span class="amount-symbol" style="left: 8px; font-size: 11px;">$</span>
              <input type="text" class="form-input amount-field savings-adj-amount" id="savings-adj-amount-${accId}" style="padding: 4px 4px 4px 20px; font-size: 12px; height: auto;" placeholder="0.00">
            </div>
            <div style="display: flex; gap: var(--spacing-sm); margin-top: 4px;">
              <button class="settings-btn" onclick="window.adjustSavingsAccountFunds('${accId}', 'add')" style="padding: 6px; font-size: 11px; flex: 1; text-align: center;">Add Funds</button>
              <button class="btn-discard" onclick="window.adjustSavingsAccountFunds('${accId}', 'remove')" style="padding: 6px; font-size: 11px; flex: 1; text-align: center; border-radius: var(--border-radius-sm);">Remove Funds</button>
            </div>
          </div>

          <div class="metric-detail-box">
            <span class="text-meta">Required Remaining funding</span>
            <div class="metric-large-num">
              ${meta.target ? window.formatCurrency(Math.max(meta.target - accBalance, 0)) : '$0.00'}
            </div>
          </div>
        </div>
        
        <h3 style="margin-bottom: var(--spacing-sm);">Historic Inbound Allocation Log</h3>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody id="savings-history-${accId}">
            </tbody>
          </table>
        </div>

        <div class="goal-adjust-box" style="margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 1px solid var(--color-border);">
          <h3 style="margin-bottom: var(--spacing-sm);">Adjust Savings Goal Target</h3>
          <div style="display: flex; gap: var(--spacing-md); flex-wrap: wrap; align-items: flex-end;">
            <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 130px;">
              <label class="form-label" style="font-size: 11px; margin-bottom: 4px;">Target Amount</label>
              <div class="amount-wrapper" style="position: relative;">
                <span class="amount-symbol" style="left: 8px; font-size: 11px;">$</span>
                <input type="text" class="form-input amount-field savings-goal-amount" id="savings-goal-amount-${accId}" style="padding: 4px 4px 4px 20px; font-size: 12px; height: auto;" placeholder="0.00">
              </div>
            </div>
            <div class="form-group" style="margin-bottom: 0; flex: 1; min-width: 130px;">
              <label class="form-label" style="font-size: 11px; margin-bottom: 4px;">Target Deadline</label>
              <input type="date" class="form-input" id="savings-goal-date-${accId}" style="padding: 4px; font-size: 12px; height: auto;" value="${meta.date || ''}">
            </div>
            <div style="display: flex; gap: var(--spacing-sm); height: 28px; align-items: center; margin-bottom: 0;">
              <button class="settings-btn" onclick="window.updateSavingsGoalTarget('${accId}')" style="padding: 6px 12px; font-size: 11px; height: 28px; line-height: 1; display: flex; align-items: center; border-radius: var(--border-radius-sm);">Update Goal</button>
              <button class="btn-discard" onclick="window.deleteSavingsAccount('${accId}')" style="padding: 6px 12px; font-size: 11px; height: 28px; line-height: 1; display: flex; align-items: center; border-radius: var(--border-radius-sm);">Delete Account</button>
            </div>
          </div>
        </div>
      </div>
    `;

    block.addEventListener('click', (e) => {
      if (e.target.closest('.table-container') || e.target.closest('.expanded-visuals') || e.target.closest('.goal-adjust-box')) return;
      const isExpanded = block.classList.contains('expanded');
      document.querySelectorAll('.tracking-block').forEach(b => b.classList.remove('expanded'));
      
      if (!isExpanded) {
        block.classList.add('expanded');
        const historyTbody = document.getElementById(`savings-history-${accId}`);
        if (historyTbody) {
          historyTbody.innerHTML = '';
          const accAllocations = allocations.filter(a => a.account_id === accId);
          accAllocations.sort((a, b) => new Date(b.date_logged) - new Date(a.date_logged));
          
          accAllocations.forEach(a => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer';
            const amtClass = a.amount_added >= 0 ? 'amount-positive' : 'amount-negative';
            const prefix = a.amount_added >= 0 ? '+' : '-';
            tr.innerHTML = `
              <td>${window.formatDate(a.date_logged)}</td>
              <td class="tabular-nums ${amtClass}">${prefix}${window.formatCurrency(Math.abs(a.amount_added))}</td>
              <td>${a.amount_added >= 0 ? 'Allocation deposit' : 'Allocation withdrawal'}</td>
            `;
            tr.addEventListener('click', () => {
              window.showSavingsTransferDetails(a);
            });
            historyTbody.appendChild(tr);
          });
        }

        const adjAmtInput = document.getElementById(`savings-adj-amount-${accId}`);
        if (adjAmtInput) {
          bindATMInput(adjAmtInput);
        }

        const goalAmtInput = document.getElementById(`savings-goal-amount-${accId}`);
        if (goalAmtInput) {
          bindATMInput(goalAmtInput);
          if (meta.target !== null && meta.target !== undefined) {
            goalAmtInput.value = meta.target.toFixed(2);
            goalAmtInput.dispatchEvent(new Event('amountset'));
          }
        }
      }
    });

    container.appendChild(block);
  });
}

// --- 5. Income & Payables View ---
async function renderDebtsView() {
  const allIncomes = await db.getIncome();
  const allTransactions = await db.getTransactions();
  const debts = await db.getDebts();

  // Filter based on selected scope
  let activeIncomes = [];
  state.incomeTimeScope = state.incomeTimeScope || 'month';

  if (state.incomeTimeScope === 'month') {
    activeIncomes = allIncomes.filter(r => {
      if (!r.date) return false;
      const [y, m, d] = r.date.split('-');
      return `${m}-${y}` === state.activeMonthYear;
    });
  } else if (state.incomeTimeScope === 'year') {
    const activeYear = state.activeMonthYear.split('-')[1];
    activeIncomes = allIncomes.filter(r => {
      if (!r.date) return false;
      const [y, m, d] = r.date.split('-');
      return y === activeYear;
    });
  } else {
    activeIncomes = allIncomes;
  }

  // Top Section: Income Success Dashboard
  // Scope-filtered earned income
  const earnedIncomeTotal = activeIncomes.reduce((sum, i) => sum + i.amount, 0);
  
  // Target income goal
  let targetIncomeGoal = 0;
  if (state.incomeTimeScope === 'month') {
    const incomeGoals = state.monthlyConfig.filter(c => c.config_type === 'Income_Goal');
    targetIncomeGoal = incomeGoals.reduce((sum, c) => sum + c.allocated_value, 0);
  } else if (state.incomeTimeScope === 'year') {
    const activeYear = state.activeMonthYear.split('-')[1];
    const allConfigs = await db.getAllMonthlyConfigs();
    const yearIncomeGoals = allConfigs.filter(c => c.config_type === 'Income_Goal' && c.month_year.endsWith(`-${activeYear}`));
    targetIncomeGoal = yearIncomeGoals.reduce((sum, c) => sum + c.allocated_value, 0);
  } else {
    const allConfigs = await db.getAllMonthlyConfigs();
    const allIncomeGoals = allConfigs.filter(c => c.config_type === 'Income_Goal');
    targetIncomeGoal = allIncomeGoals.reduce((sum, c) => sum + c.allocated_value, 0);
  }

  document.getElementById('debts-income-total').textContent = window.formatCurrency(earnedIncomeTotal);
  
  const isGoalReached = earnedIncomeTotal >= targetIncomeGoal && targetIncomeGoal > 0;

  // Update Pill Buttons active state
  const scopes = ['month', 'year', 'all-time'];
  scopes.forEach(s => {
    const btn = document.getElementById(`income-scope-${s === 'all-time' ? 'all' : s}`);
    if (btn) {
      if (state.incomeTimeScope === s) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });
  
  const INCOME_COLORS = [
    '#1E352F', // Deep Pine
    '#4A5D4E', // Sage/Olive
    '#D4A373', // Warm Gold
    '#A34843', // Crimson Glow
    '#8B6F58', // Soft Walnut
    '#4E5D6C', // Slate
    '#9C27B0', // Muted Purple
    '#2E5C4E', // Muted Emerald
    '#A67C52', // Ochre
    '#6D7993'  // Dusty Blue
  ];

  const knownSources = state.taxonomy["Income"] || [];
  const getSourceColor = (source) => {
    const idx = knownSources.indexOf(source);
    if (idx === -1) return INCOME_COLORS[INCOME_COLORS.length - 1];
    return INCOME_COLORS[idx % INCOME_COLORS.length];
  };

  const sourceTotals = {};
  activeIncomes.forEach(i => {
    sourceTotals[i.source] = (sourceTotals[i.source] || 0) + i.amount;
  });
  const sortedSources = Object.keys(sourceTotals).sort((a, b) => sourceTotals[b] - sourceTotals[a]);

  const progressContainer = document.getElementById('debts-income-progress-container');
  if (progressContainer) {
    progressContainer.innerHTML = '';
  }

  const legendContainer = document.getElementById('debts-income-legend');
  if (legendContainer) {
    legendContainer.innerHTML = '';
  }

  if (earnedIncomeTotal > 0 && progressContainer) {
    const divisor = (targetIncomeGoal > 0 && earnedIncomeTotal <= targetIncomeGoal) ? targetIncomeGoal : earnedIncomeTotal;
    
    sortedSources.forEach(source => {
      const amt = sourceTotals[source];
      const pct = (amt / divisor) * 100;
      const color = getSourceColor(source);
      
      const segment = document.createElement('div');
      segment.style.height = '100%';
      segment.style.width = `${pct}%`;
      segment.style.backgroundColor = color;
      segment.style.transition = 'width 0.4s var(--transition-glide)';
      segment.title = `${source}: ${window.formatCurrency(amt)} (${((amt/earnedIncomeTotal)*100).toFixed(1)}%)`;
      progressContainer.appendChild(segment);

      if (legendContainer) {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.style.display = 'flex';
        legendItem.style.alignItems = 'center';
        legendItem.style.gap = '6px';
        legendItem.style.fontSize = '11px';
        
        const dot = document.createElement('span');
        dot.className = 'legend-dot';
        dot.style.width = '10px';
        dot.style.height = '10px';
        dot.style.borderRadius = '50%';
        dot.style.display = 'inline-block';
        dot.style.backgroundColor = color;
        
        const text = document.createElement('span');
        text.innerHTML = `${source}: <strong>${window.formatCurrency(amt)}</strong>`;
        
        legendItem.appendChild(dot);
        legendItem.appendChild(text);
        legendContainer.appendChild(legendItem);
      }
    });
  } else if (progressContainer) {
    const emptySegment = document.createElement('div');
    emptySegment.className = 'progress-bar-fill progress-normal';
    emptySegment.style.width = '0%';
    progressContainer.appendChild(emptySegment);
  }
  
  const headerCard = document.getElementById('income-success-header');
  if (isGoalReached) {
    headerCard.style.border = '2px solid var(--color-success)';
    headerCard.style.background = 'linear-gradient(to right, var(--color-surface-card), var(--color-success-light))';
    document.getElementById('income-celebration-badge').style.display = 'block';
  } else {
    headerCard.style.border = '1px solid var(--color-border)';
    headerCard.style.background = 'var(--color-surface-card)';
    document.getElementById('income-celebration-badge').style.display = 'none';
  }
  
  document.getElementById('debts-income-progress-info').innerHTML = `
    <span>Earned Income: <strong>${window.formatCurrency(earnedIncomeTotal)}</strong></span>
    <span>Objective: ${window.formatCurrency(targetIncomeGoal)}</span>
  `;

  // Renders income sorted newest to oldest
  const sortedIncomeList = [...activeIncomes].sort((a, b) => new Date(b.date) - new Date(a.date));

  const incomeTbody = document.getElementById('income-register-tbody');
  incomeTbody.innerHTML = '';
  
  if (sortedIncomeList.length === 0) {
    incomeTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-font-secondary);">No income received.</td></tr>`;
  } else {
    sortedIncomeList.forEach(i => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.innerHTML = `
        <td>${window.formatDate(i.date)}</td>
        <td>${i.source}</td>
        <td class="tabular-nums" style="font-weight:600;">+${window.formatCurrency(i.amount)}</td>
        <td>${i.description || ""}</td>
      `;
      tr.addEventListener('click', () => {
        showTransactionDetails({ ...i, type: 'income', subgroup: i.source, group: 'Income' });
      });
      incomeTbody.appendChild(tr);
    });
  }

  // Calculate Tithing Owed & Ledger over all time
  const tithingObligations = allIncomes.filter(i => i.tithable === true).map(i => ({
    date: i.date,
    type: 'Obligation',
    detail: `10% of ${i.source} (${window.formatCurrency(i.amount)})`,
    amount: parseFloat((i.amount * 0.1).toFixed(2)),
    id: i.id,
    isPayment: false,
    ref: i
  }));

  const tithingPayments = allTransactions.filter(t => t.group === 'Donations' && t.subgroup === 'Tithing').map(t => ({
    date: t.date,
    type: 'Payment',
    detail: t.description || 'Tithing Payment',
    amount: -t.amount,
    id: t.id,
    isPayment: true,
    ref: t
  }));

  const tithingTransactions = [...tithingObligations, ...tithingPayments];
  tithingTransactions.sort((a, b) => {
    const diff = new Date(a.date) - new Date(b.date);
    if (diff !== 0) return diff;
    if (a.isPayment !== b.isPayment) {
      return a.isPayment ? 1 : -1;
    }
    return a.id.localeCompare(b.id);
  });

  let runningOwed = 0;
  let totalObligations = 0;
  tithingTransactions.forEach(item => {
    if (!item.isPayment) {
      totalObligations += item.amount;
      runningOwed += item.amount;
    } else {
      runningOwed += item.amount;
    }
    item.runningOwed = parseFloat(runningOwed.toFixed(2));
  });

  document.getElementById('tithing-accumulated-lbl').textContent = window.formatCurrency(totalObligations);
  document.getElementById('tithing-owed-lbl').textContent = window.formatCurrency(runningOwed);

  const tithingLedgerTbody = document.getElementById('tithing-ledger-tbody');
  tithingLedgerTbody.innerHTML = '';
  
  const displayTithingList = [...tithingTransactions].reverse();
  
  if (displayTithingList.length === 0) {
    tithingLedgerTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--color-font-secondary);">No tithing activity recorded.</td></tr>`;
  } else {
    displayTithingList.forEach(item => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      
      const typeClass = item.isPayment ? 'amount-negative' : '';
      const typeLabel = item.isPayment ? 'Payment' : 'Obligation';
      const amtPrefix = item.isPayment ? '-' : '+';
      const amtColorStyle = item.isPayment ? 'color: var(--color-alert); font-weight: 600;' : 'font-weight: 600;';
      
      tr.innerHTML = `
        <td>${window.formatDate(item.date)}</td>
        <td><span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; color: #fff; background-color: ${item.isPayment ? 'var(--color-alert)' : 'var(--color-secondary-accent)'};">${typeLabel}</span></td>
        <td>${item.detail}</td>
        <td class="tabular-nums" style="${amtColorStyle}">${amtPrefix}${window.formatCurrency(Math.abs(item.amount))}</td>
        <td class="tabular-nums" style="font-weight: 600;">${window.formatCurrency(item.runningOwed)}</td>
      `;
      
      tr.addEventListener('click', () => {
        if (item.isPayment) {
          showTransactionDetails({ ...item.ref, type: 'expense' });
        } else {
          showTransactionDetails({ ...item.ref, type: 'income', subgroup: item.ref.source, group: 'Income' });
        }
      });
      
      tithingLedgerTbody.appendChild(tr);
    });
  }

  // Payables sorted newest to oldest
  const payables = debts.filter(d => d.type === 'Payable').sort((a, b) => new Date(b.date_logged) - new Date(a.date_logged));
  const payablesTbody = document.getElementById('payables-tbody');
  payablesTbody.innerHTML = '';
  
  if (payables.length === 0) {
    payablesTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-font-secondary);">No payables logged.</td></tr>`;
  } else {
    payables.forEach(p => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      const cleanDesc = (p.description || "").replace(/"/g, '&quot;');
      tr.innerHTML = `
        <td>${p.description}</td>
        <td class="tabular-nums amount-negative">${window.formatCurrency(p.total_amount)}</td>
        <td>${window.formatDate(p.date_logged)}</td>
        <td style="text-align: right;">
          <button class="settings-btn" data-id="${p.id}" data-desc="${cleanDesc}" onclick="window.launchSettleWizard(this)" style="padding: 4px 8px; font-size: 11px;">Settle</button>
        </td>
      `;
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.settings-btn')) return;
        showDebtDetails(p);
      });
      payablesTbody.appendChild(tr);
    });
  }

  // Receivables sorted newest to oldest
  const receivables = debts.filter(d => d.type === 'Receivable').sort((a, b) => new Date(b.date_logged) - new Date(a.date_logged));
  const receivablesTbody = document.getElementById('receivables-tbody');
  receivablesTbody.innerHTML = '';
  
  if (receivables.length === 0) {
    receivablesTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--color-font-secondary);">No receivables logged.</td></tr>`;
  } else {
    receivables.forEach(r => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      const cleanDesc = (r.description || "").replace(/"/g, '&quot;');
      tr.innerHTML = `
        <td>${r.description}</td>
        <td class="tabular-nums">${window.formatCurrency(r.total_amount)}</td>
        <td>${window.formatDate(r.date_logged)}</td>
        <td style="text-align: right;">
          <button class="settings-btn" data-id="${r.id}" data-desc="${cleanDesc}" onclick="window.launchSettleWizard(this)" style="padding: 4px 8px; font-size: 11px;">Settle</button>
        </td>
      `;
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.settings-btn')) return;
        showDebtDetails(r);
      });
      receivablesTbody.appendChild(tr);
    });
  }
}

function launchSettleWizard(btnOrId, debtDesc) {
  if (!db.isGoogleConnected()) {
    showConfirmModal(
      "Sign In Required",
      "You are currently offline. Please sign in to your Google Account to settle entries.",
      () => {
        reauthorizeGoogleSheets();
      }
    );
    return;
  }

  try {
    let debtId = btnOrId;
    let desc = debtDesc;
    
    if (btnOrId && typeof btnOrId !== 'string') {
      // If passed the button element
      debtId = btnOrId.getAttribute('data-id');
      desc = btnOrId.getAttribute('data-desc');
    }

    const formContainer = document.getElementById('form-overlay-container');
    const drawers = document.querySelectorAll('.form-drawer');
    
    drawers.forEach(d => d.style.display = 'none');
    
    const drawer = document.getElementById('drawer-settle');
    if (!drawer) throw new Error("Drawer-settle element was not found in page DOM.");
    
    drawer.style.display = 'flex';
    
    document.getElementById('settle-debt-id').value = debtId || "";
    document.getElementById('settle-debt-desc').textContent = desc || "No description";
    document.getElementById('settle-amount').value = '0.00';
    
    formContainer.classList.add('active');
  } catch (err) {
    alert("Settle Wizard Error: " + err.message);
  }
}

window.launchSettleWizard = launchSettleWizard;

// --- 6. Analytics Insight Engine ---
// --- 6. Analytics Insight Engine ---
function bindAnalytics() {
  // 1. Timeframe picker change event
  const durationSelect = document.getElementById('analytics-duration-picker');
  if (durationSelect) {
    durationSelect.addEventListener('change', () => {
      state.selectedAnalyticsMonthIndex = null;
      const breakdownCard = document.getElementById('analytics-breakdown-card');
      if (breakdownCard) breakdownCard.style.display = 'none';
      renderAnalyticsView();
    });
  }

  // 2. Main Trackers segment control click events
  const segmentButtons = document.querySelectorAll('#analytics-segment-bar .segment-btn');
  segmentButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      segmentButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      state.selectedAnalyticsMonthIndex = null;
      const breakdownCard = document.getElementById('analytics-breakdown-card');
      if (breakdownCard) breakdownCard.style.display = 'none';

      renderAnalyticsView();
    });
  });
}
window.bindAnalytics = bindAnalytics;

async function renderAnalyticsView() {
  const segments = document.querySelectorAll('#analytics-segment-bar .segment-btn');
  let activeSegment = 'expense';
  segments.forEach(btn => {
    if (btn.classList.contains('active')) activeSegment = btn.getAttribute('data-segment');
  });

  if (!state.analyticsDuration) {
    state.analyticsDuration = 'year'; // default to Year (string)
  }
  if (state.quartersOffset === undefined) {
    state.quartersOffset = 0;
  }
  if (state.weeksOffset === undefined) {
    state.weeksOffset = 0;
  }

  // Sync Timeframe picker buttons based on state.analyticsDuration
  const timeframeBar = document.getElementById('analytics-timeframe-bar');
  if (timeframeBar) {
    const buttons = timeframeBar.querySelectorAll('.timeframe-btn');
    buttons.forEach(btn => {
      const durationVal = btn.getAttribute('data-duration');
      if (durationVal === state.analyticsDuration) {
        btn.classList.add('active');
        btn.style.backgroundColor = 'var(--color-primary-accent)';
        btn.style.color = 'var(--color-base-canvas)';
      } else {
        btn.classList.remove('active');
        btn.style.backgroundColor = '';
        btn.style.color = 'var(--color-font-secondary)';
      }
      
      // Bind click handler once
      if (!btn.dataset.bound) {
        btn.dataset.bound = "true";
        btn.addEventListener('click', () => {
          state.analyticsDuration = durationVal;
          state.selectedAnalyticsMonthIndex = null;
          state.quartersOffset = 0; // reset offset
          state.weeksOffset = 0; // reset offset
          renderAnalyticsView();
        });
      }
    });
  }

  // Timeframe navigation controls setup (Quarters and Weeks pagination)
  const prevBtn = document.getElementById('quarters-prev-btn');
  const nextBtn = document.getElementById('quarters-next-btn');
  const rangeLabelContainer = document.getElementById('analytics-quarters-nav-label');

  const isNavVisible = state.analyticsDuration === 'all-time' || state.analyticsDuration === 'month';
  if (prevBtn) prevBtn.style.display = isNavVisible ? 'flex' : 'none';
  if (nextBtn) nextBtn.style.display = isNavVisible ? 'flex' : 'none';
  if (rangeLabelContainer) rangeLabelContainer.style.display = isNavVisible ? 'flex' : 'none';

  if (isNavVisible) {
    if (prevBtn) {
      prevBtn.innerHTML = '&lt;'; 
      prevBtn.setAttribute('title', state.analyticsDuration === 'month' ? 'Prev Weeks' : 'Prev Quarters');
    }
    if (nextBtn) {
      nextBtn.innerHTML = '&gt;';
      nextBtn.setAttribute('title', state.analyticsDuration === 'month' ? 'Next Weeks' : 'Next Quarters');
    }

    if (prevBtn && !prevBtn.dataset.bound) {
      prevBtn.dataset.bound = "true";
      prevBtn.addEventListener('click', () => {
        if (state.analyticsDuration === 'all-time') {
          state.quartersOffset++;
        } else if (state.analyticsDuration === 'month') {
          state.weeksOffset++;
        }
        state.selectedAnalyticsMonthIndex = null;
        renderAnalyticsView();
      });
    }

    if (nextBtn && !nextBtn.dataset.bound) {
      nextBtn.dataset.bound = "true";
      nextBtn.addEventListener('click', () => {
        if (state.analyticsDuration === 'all-time') {
          if (state.quartersOffset > 0) state.quartersOffset--;
        } else if (state.analyticsDuration === 'month') {
          if (state.weeksOffset > 0) state.weeksOffset--;
        }
        state.selectedAnalyticsMonthIndex = null;
        renderAnalyticsView();
      });
    }

    // Enable/disable nextBtn based on current offset
    if (nextBtn) {
      const currentOffset = state.analyticsDuration === 'month' ? state.weeksOffset : state.quartersOffset;
      nextBtn.style.opacity = currentOffset > 0 ? '1' : '0.3';
      nextBtn.style.pointerEvents = currentOffset > 0 ? 'auto' : 'none';
    }
  }

  // Expense categories sidebar visibility: only on expense, avg-spent, or income
  const categoriesPanel = document.getElementById('analytics-categories-panel');
  const layoutGrid = document.querySelector('.analytics-layout-grid');
  if (categoriesPanel) {
    if (activeSegment === 'expense' || activeSegment === 'avg-spent' || activeSegment === 'income') {
      categoriesPanel.style.display = 'block';
      if (layoutGrid) layoutGrid.classList.remove('no-sidebar');
    } else {
      categoriesPanel.style.display = 'none';
      if (layoutGrid) layoutGrid.classList.add('no-sidebar');
    }
  }

  if (!state.analyticsCategory) {
    state.analyticsCategory = 'ALL';
  }

  // Dynamic Category Filters Builder based on Taxonomy
  const containerButtons = document.getElementById('analytics-category-buttons-container');
  if (containerButtons && categoriesPanel && categoriesPanel.style.display !== 'none') {
    containerButtons.innerHTML = '';
    
    // Header title toggle
    const sidebarTitle = categoriesPanel.querySelector('h2');
    if (sidebarTitle) {
      sidebarTitle.textContent = activeSegment === 'income' ? 'Income Filters' : 'Expense Filters';
    }

    // 1. All Categories Button
    const allBtn = document.createElement('button');
    allBtn.className = `analytics-cat-btn${state.analyticsCategory === 'ALL' ? ' active' : ''}`;
    allBtn.setAttribute('data-category', 'ALL');
    allBtn.textContent = 'All Categories';
    allBtn.addEventListener('click', () => {
      state.analyticsCategory = 'ALL';
      state.selectedAnalyticsMonthIndex = null;
      renderAnalyticsView();
    });
    containerButtons.appendChild(allBtn);

    // 2. Database Taxonomy Categories based on Segment
    let categoriesList = [];
    if (activeSegment === 'income') {
      categoriesList = state.taxonomy["Income"] || [];
    } else {
      categoriesList = Object.keys(state.taxonomy || {}).filter(c => c !== 'Income');
    }

    categoriesList.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `analytics-cat-btn${state.analyticsCategory === cat ? ' active' : ''}`;
      btn.setAttribute('data-category', cat);
      btn.textContent = cat;
      btn.addEventListener('click', () => {
        state.analyticsCategory = cat;
        state.selectedAnalyticsMonthIndex = null;
        renderAnalyticsView();
      });
      containerButtons.appendChild(btn);
    });
  }

  // Bulk load to avoid nested DB reads
  const allTransactions = await db.getTransactions();
  const allIncome = await db.getIncome();
  const allConfigs = await db.getAllMonthlyConfigs();
  const allSavings = await db.getSavingsAccounts();

  // Helper to parse local dates timezone-safely
  const parseLocalDate = (dStr) => {
    if (!dStr) return null;
    const [y, m, d] = dStr.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  };

  // Helper to check if a date falls in our months list or weeks boundary
  const isItemInPeriod = (item, dateField, monthsArr, weeksObj) => {
    if (!item[dateField]) return false;
    if (weeksObj) {
      const d = parseLocalDate(item[dateField]);
      return d && d >= weeksObj.start && d <= weeksObj.end;
    }
    const [y, m, d] = item[dateField].split('-');
    return monthsArr.includes(`${m}-${y}`);
  };

  // Compute current and previous period aggregates for summary cards based on duration
  let currentMonthsForSummary = [];
  let previousMonthsForSummary = [];
  let currentWeeksForSummary = null;
  let previousWeeksForSummary = null;

  if (state.analyticsDuration === 'year') {
    const currentYearVal = parseInt(state.activeMonthYear.split('-')[1]);
    currentMonthsForSummary = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0') + '-' + currentYearVal);
    previousMonthsForSummary = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0') + '-' + (currentYearVal - 1));
  } else if (state.analyticsDuration === 'all-time') {
    const [mStr, yStr] = state.activeMonthYear.split('-');
    const activeYear = parseInt(yStr);
    const activeMonth = parseInt(mStr);
    const activeQuarterIndex = Math.floor((activeMonth - 1) / 3);

    const getQuartersList = (offset) => {
      const list = [];
      let currQ = activeQuarterIndex;
      let currY = activeYear;
      for (let i = 0; i < offset; i++) {
        currQ--;
        if (currQ < 0) { currQ = 3; currY--; }
      }
      for (let i = 0; i < 8; i++) {
        list.push({ quarter: currQ, year: currY });
        currQ--;
        if (currQ < 0) { currQ = 3; currY--; }
      }
      list.reverse();
      return list;
    };
    const currentQuarters = getQuartersList(state.quartersOffset);
    const previousQuarters = getQuartersList(state.quartersOffset + 8);

    currentMonthsForSummary = currentQuarters.flatMap(q => [
      String(q.quarter * 3 + 1).padStart(2, '0') + '-' + q.year,
      String(q.quarter * 3 + 2).padStart(2, '0') + '-' + q.year,
      String(q.quarter * 3 + 3).padStart(2, '0') + '-' + q.year
    ]);
    previousMonthsForSummary = previousQuarters.flatMap(q => [
      String(q.quarter * 3 + 1).padStart(2, '0') + '-' + q.year,
      String(q.quarter * 3 + 2).padStart(2, '0') + '-' + q.year,
      String(q.quarter * 3 + 3).padStart(2, '0') + '-' + q.year
    ]);
  } else if (state.analyticsDuration === 'month') {
    const [mStr, yStr] = state.activeMonthYear.split('-');
    let prevM = parseInt(mStr) - 1;
    let prevY = parseInt(yStr);
    if (prevM < 1) { prevM = 12; prevY--; }
    const prevMY = String(prevM).padStart(2, '0') + '-' + prevY;

    currentMonthsForSummary = [state.activeMonthYear];
    previousMonthsForSummary = [prevMY];
    currentWeeksForSummary = null;
    previousWeeksForSummary = null;
  }

  // 1. Current Period Summary Card Metrics
  const periodIncome = allIncome.filter(i => isItemInPeriod(i, 'date', currentMonthsForSummary, currentWeeksForSummary));
  const totalIncomeVal = periodIncome.reduce((sum, i) => sum + i.amount, 0);

  const periodExpenses = allTransactions.filter(t => isItemInPeriod(t, 'date', currentMonthsForSummary, currentWeeksForSummary));
  const totalExpensesVal = periodExpenses.reduce((sum, t) => sum + t.amount, 0);
  
  // Savings addition computations
  let totalSavingsVal = 0;
  let prevSavingsSum = 0;
  let savingsTitleText = "Savings Added";

  if (state.analyticsDuration === 'all-time') {
    savingsTitleText = "Current Savings";
    totalSavingsVal = allSavings.reduce((sum, s) => sum + s.amount_added, 0);
    const additionsInQuarters = allSavings.filter(s => isItemInPeriod(s, 'date_logged', currentMonthsForSummary, currentWeeksForSummary)).reduce((sum, s) => sum + s.amount_added, 0);
    prevSavingsSum = totalSavingsVal - additionsInQuarters;
  } else if (state.analyticsDuration === 'year') {
    savingsTitleText = "Savings Added (This Year)";
    const periodSavings = allSavings.filter(s => isItemInPeriod(s, 'date_logged', currentMonthsForSummary, currentWeeksForSummary));
    totalSavingsVal = periodSavings.reduce((sum, s) => sum + s.amount_added, 0);
    const prevPeriodSavings = allSavings.filter(s => isItemInPeriod(s, 'date_logged', previousMonthsForSummary, previousWeeksForSummary));
    prevSavingsSum = prevPeriodSavings.reduce((sum, s) => sum + s.amount_added, 0);
  } else if (state.analyticsDuration === 'month') {
    savingsTitleText = "Savings Added (This Month)";
    const periodSavings = allSavings.filter(s => isItemInPeriod(s, 'date_logged', currentMonthsForSummary, currentWeeksForSummary));
    totalSavingsVal = periodSavings.reduce((sum, s) => sum + s.amount_added, 0);
    const prevPeriodSavings = allSavings.filter(s => isItemInPeriod(s, 'date_logged', previousMonthsForSummary, previousWeeksForSummary));
    prevSavingsSum = prevPeriodSavings.reduce((sum, s) => sum + s.amount_added, 0);
  }

  // 2. Previous Period Summary Card Metrics
  const prevPeriodIncome = allIncome.filter(i => isItemInPeriod(i, 'date', previousMonthsForSummary, previousWeeksForSummary));
  const prevIncomeSum = prevPeriodIncome.reduce((sum, i) => sum + i.amount, 0);

  const prevPeriodExpenses = allTransactions.filter(t => isItemInPeriod(t, 'date', previousMonthsForSummary, previousWeeksForSummary));
  const prevExpensesSum = prevPeriodExpenses.reduce((sum, t) => sum + t.amount, 0);

  // 3. Percentage changes calculations
  const getChangePct = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };

  const incomeChange = getChangePct(totalIncomeVal, prevIncomeSum);
  const expensesChange = getChangePct(totalExpensesVal, prevExpensesSum);
  const savingsChange = getChangePct(totalSavingsVal, prevSavingsSum);

  // Helper to update comparison badges
  const updateSummaryCardBadge = (badgeElId, changeVal, isExpense = false) => {
    const el = document.getElementById(badgeElId);
    if (!el) return;
    
    el.style.fontSize = '11px';
    el.style.fontWeight = '600';
    el.style.borderRadius = '4px';
    el.style.padding = '2px 6px';
    el.style.display = 'inline-block';
    
    const formatted = (changeVal >= 0 ? '+' : '') + Math.round(changeVal) + '%';
    el.textContent = formatted;

    let isGood = changeVal >= 0;
    if (isExpense) isGood = changeVal <= 0;

    if (Math.round(changeVal) === 0) {
      el.style.background = 'var(--color-border)';
      el.style.color = 'var(--color-font-secondary)';
    } else if (isGood) {
      el.style.background = 'rgba(52, 199, 89, 0.15)';
      el.style.color = '#34c759';
    } else {
      el.style.background = 'rgba(255, 69, 58, 0.15)';
      el.style.color = '#ff453a';
    }
  };

  const summaryIncomeEl = document.getElementById('analytics-summary-income');
  const summaryExpensesEl = document.getElementById('analytics-summary-expenses');
  const summarySavingsEl = document.getElementById('analytics-summary-savings');
  const summarySavingsTitleEl = document.getElementById('analytics-summary-savings-title');

  if (summaryIncomeEl && summaryExpensesEl && summarySavingsEl) {
    summaryIncomeEl.textContent = window.formatCurrency(totalIncomeVal);
    summaryExpensesEl.textContent = window.formatCurrency(totalExpensesVal);
    summarySavingsEl.textContent = window.formatCurrency(totalSavingsVal);

    if (summarySavingsTitleEl) {
      summarySavingsTitleEl.textContent = savingsTitleText;
    }

    summarySavingsEl.style.color = 'var(--color-primary-accent)';

    updateSummaryCardBadge('analytics-summary-income-badge', incomeChange, false);
    updateSummaryCardBadge('analytics-summary-expenses-badge', expensesChange, true);
    updateSummaryCardBadge('analytics-summary-savings-badge', savingsChange, false);
  }

  // --- 4. Prepare line chart dataset based on selected duration ---
  const chartDataset = [];
  let pastMonthsPlaceholder = null;

  const todayDate = new Date();
  const realMNum = todayDate.getMonth() + 1;
  const realYNum = todayDate.getFullYear();

  const isFutureMonth = (mYStr) => {
    const [mVal, yVal] = mYStr.split('-').map(Number);
    if (yVal > realYNum) return true;
    if (yVal === realYNum && mVal > realMNum) return true;
    return false;
  };

  const isFutureQuarter = (q) => {
    const realQ = Math.floor((realMNum - 1) / 3);
    if (q.year > realYNum) return true;
    if (q.year === realYNum && q.quarter > realQ) return true;
    return false;
  };

  if (state.analyticsDuration === 'year') {
    const currentYearVal = parseInt(state.activeMonthYear.split('-')[1]);
    const monthsList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0') + '-' + currentYearVal);
    pastMonthsPlaceholder = monthsList;

    for (const mY of monthsList) {
      const transactions = allTransactions.filter(t => {
        if (!t.date) return false;
        const [y, m, d] = t.date.split('-');
        return `${m}-${y}` === mY;
      });

      const incomes = allIncome.filter(i => {
        if (!i.date) return false;
        const [y, m, d] = i.date.split('-');
        return `${m}-${y}` === mY;
      });

      const configs = allConfigs.filter(c => c.month_year === mY);

      const savings = allSavings.filter(s => {
        if (!s.date_logged) return false;
        const [y, m, d] = s.date_logged.split('-');
        return `${m}-${y}` === mY;
      });

      let spentSum = 0;
      let budgetGoal = 0;
      
      if (state.analyticsCategory === 'ALL') {
        spentSum = transactions.reduce((sum, t) => sum + t.amount, 0);
        budgetGoal = configs.filter(c => c.config_type === 'Budget_Limit').reduce((sum, c) => sum + c.allocated_value, 0);
      } else {
        spentSum = transactions.filter(t => t.group === state.analyticsCategory).reduce((sum, t) => sum + t.amount, 0);
        budgetGoal = configs.filter(c => c.config_type === 'Budget_Limit' && c.key_name === state.analyticsCategory).reduce((sum, c) => sum + c.allocated_value, 0);
      }

      let incomeSum = 0;
      let incomeGoal = 0;
      if (activeSegment === 'income' && state.analyticsCategory !== 'ALL') {
        incomeSum = incomes.filter(i => i.source === state.analyticsCategory).reduce((sum, i) => sum + i.amount, 0);
        incomeGoal = configs.filter(c => c.config_type === 'Income_Goal' && c.key_name === state.analyticsCategory).reduce((sum, c) => sum + c.allocated_value, 0);
      } else {
        incomeSum = incomes.reduce((sum, i) => sum + i.amount, 0);
        incomeGoal = configs.filter(c => c.config_type === 'Income_Goal').reduce((sum, c) => sum + c.allocated_value, 0);
      }

      const savingsSum = savings.reduce((sum, s) => sum + s.amount_added, 0);
      const savingsGoal = configs.filter(c => c.config_type === 'Savings_Goal').reduce((sum, c) => sum + c.allocated_value, 0);

      let actual = 0;
      let goal = 0;

      const [mNum, yNum] = mY.split('-');
      const numDays = new Date(parseInt(yNum), parseInt(mNum), 0).getDate();

      if (isFutureMonth(mY)) {
        actual = null;
        goal = 0;
      } else {
        if (activeSegment === 'expense') {
          actual = spentSum;
          goal = budgetGoal;
        } else if (activeSegment === 'savings') {
          actual = savingsSum;
          goal = savingsGoal;
        } else if (activeSegment === 'income') {
          actual = incomeSum;
          goal = incomeGoal;
        } else if (activeSegment === 'net') {
          actual = incomeSum - spentSum;
          goal = incomeGoal - budgetGoal;
        } else if (activeSegment === 'avg-spent') {
          actual = spentSum / numDays;
          goal = budgetGoal / numDays;
        }
      }

      const labelDate = new Date(parseInt(yNum), parseInt(mNum) - 1, 1);
      const label = labelDate.toLocaleDateString('en-US', { month: 'short' });

      chartDataset.push({
        label,
        actual,
        goal,
        rawMonthYear: mY
      });
    }

  } else if (state.analyticsDuration === 'all-time') {
    const [mStr, yStr] = state.activeMonthYear.split('-');
    const activeYear = parseInt(yStr);
    const activeMonth = parseInt(mStr);
    const activeQuarterIndex = Math.floor((activeMonth - 1) / 3);

    const getQuartersList = (offset) => {
      const list = [];
      let currQ = activeQuarterIndex;
      let currY = activeYear;
      for (let i = 0; i < offset; i++) {
        currQ--;
        if (currQ < 0) { currQ = 3; currY--; }
      }
      for (let i = 0; i < 8; i++) {
        list.push({ quarter: currQ, year: currY });
        currQ--;
        if (currQ < 0) { currQ = 3; currY--; }
      }
      list.reverse();
      return list;
    };

    const currentQuarters = getQuartersList(state.quartersOffset);
    
    // Update Quarters range navigation label
    const rangeText = `Quarters: Q${currentQuarters[0].quarter + 1} ${currentQuarters[0].year} - Q${currentQuarters[7].quarter + 1} ${currentQuarters[7].year}`;
    const rangeSpan = document.getElementById('quarters-current-range');
    if (rangeSpan) rangeSpan.textContent = rangeText;

    pastMonthsPlaceholder = currentQuarters.flatMap(q => [
      String(q.quarter * 3 + 1).padStart(2, '0') + '-' + q.year,
      String(q.quarter * 3 + 2).padStart(2, '0') + '-' + q.year,
      String(q.quarter * 3 + 3).padStart(2, '0') + '-' + q.year
    ]);

    for (const q of currentQuarters) {
      const qMonths = [
        String(q.quarter * 3 + 1).padStart(2, '0') + '-' + q.year,
        String(q.quarter * 3 + 2).padStart(2, '0') + '-' + q.year,
        String(q.quarter * 3 + 3).padStart(2, '0') + '-' + q.year
      ];

      const transactions = allTransactions.filter(t => {
        if (!t.date) return false;
        const [y, m, d] = t.date.split('-');
        return qMonths.includes(`${m}-${y}`);
      });

      const incomes = allIncome.filter(i => {
        if (!i.date) return false;
        const [y, m, d] = i.date.split('-');
        return qMonths.includes(`${m}-${y}`);
      });

      const configs = allConfigs.filter(c => qMonths.includes(c.month_year));

      const savings = allSavings.filter(s => {
        if (!s.date_logged) return false;
        const [y, m, d] = s.date_logged.split('-');
        return qMonths.includes(`${m}-${y}`);
      });

      let spentSum = 0;
      let budgetGoal = 0;
      
      if (state.analyticsCategory === 'ALL') {
        spentSum = transactions.reduce((sum, t) => sum + t.amount, 0);
        budgetGoal = configs.filter(c => c.config_type === 'Budget_Limit').reduce((sum, c) => sum + c.allocated_value, 0);
      } else {
        spentSum = transactions.filter(t => t.group === state.analyticsCategory).reduce((sum, t) => sum + t.amount, 0);
        budgetGoal = configs.filter(c => c.config_type === 'Budget_Limit' && c.key_name === state.analyticsCategory).reduce((sum, c) => sum + c.allocated_value, 0);
      }

      let incomeSum = 0;
      let incomeGoal = 0;
      if (activeSegment === 'income' && state.analyticsCategory !== 'ALL') {
        incomeSum = incomes.filter(i => i.source === state.analyticsCategory).reduce((sum, i) => sum + i.amount, 0);
        incomeGoal = configs.filter(c => c.config_type === 'Income_Goal' && c.key_name === state.analyticsCategory).reduce((sum, c) => sum + c.allocated_value, 0);
      } else {
        incomeSum = incomes.reduce((sum, i) => sum + i.amount, 0);
        incomeGoal = configs.filter(c => c.config_type === 'Income_Goal').reduce((sum, c) => sum + c.allocated_value, 0);
      }

      const savingsSum = savings.reduce((sum, s) => sum + s.amount_added, 0);
      const savingsGoal = configs.filter(c => c.config_type === 'Savings_Goal').reduce((sum, c) => sum + c.allocated_value, 0);

      let actual = 0;
      let goal = 0;

      if (isFutureQuarter(q)) {
        actual = null;
        goal = 0;
      } else {
        if (activeSegment === 'expense') {
          actual = spentSum;
          goal = budgetGoal;
        } else if (activeSegment === 'savings') {
          actual = savingsSum;
          goal = savingsGoal;
        } else if (activeSegment === 'income') {
          actual = incomeSum;
          goal = incomeGoal;
        } else if (activeSegment === 'net') {
          actual = incomeSum - spentSum;
          goal = incomeGoal - budgetGoal;
        } else if (activeSegment === 'avg-spent') {
          actual = spentSum / 90;
          goal = budgetGoal / 90;
        }
      }

      chartDataset.push({
        label: `Q${q.quarter + 1} '${String(q.year).slice(2)}`,
        actual,
        goal,
        rawMonthYear: qMonths
      });
    }

  } else if (state.analyticsDuration === 'month') {
    const [mStr, yStr] = state.activeMonthYear.split('-');
    const endDate = new Date(parseInt(yStr), parseInt(mStr), 0);
    
    const getWeeksList = (offsetWeeks) => {
      const list = [];
      const baseEnd = new Date(endDate);
      
      // Shift baseEnd to the Saturday of its week to align all weeks Sunday-Saturday
      const day = baseEnd.getDay();
      baseEnd.setDate(baseEnd.getDate() + (6 - day));
      
      // Apply offset weeks pagination
      baseEnd.setDate(baseEnd.getDate() - offsetWeeks * 7);
      
      for (let i = 0; i < 6; i++) {
        const wEnd = new Date(baseEnd);
        wEnd.setDate(baseEnd.getDate() - i * 7);
        
        const wStart = new Date(wEnd);
        wStart.setDate(wEnd.getDate() - 6);
        
        // Zero out times for exact inclusive comparison bounds
        wStart.setHours(0, 0, 0, 0);
        wEnd.setHours(23, 59, 59, 999);
        
        list.push({ start: wStart, end: wEnd });
      }
      list.reverse();
      return list;
    };
    
    const weeks = getWeeksList(state.weeksOffset);
    pastMonthsPlaceholder = { start: weeks[0].start, end: weeks[5].end };

    // Update Weeks range navigation label
    const rangeText = `Weeks: ${weeks[0].start.toLocaleDateString('en-US', {month:'short', day:'numeric'})} - ${weeks[5].end.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}`;
    const rangeSpan = document.getElementById('quarters-current-range');
    if (rangeSpan) rangeSpan.textContent = rangeText;

    const activeMonthConfigs = allConfigs.filter(c => c.month_year === state.activeMonthYear);

    weeks.forEach((w, wIdx) => {
      const txInWeek = allTransactions.filter(t => {
        const d = parseLocalDate(t.date);
        return d && d >= w.start && d <= w.end;
      });

      const incInWeek = allIncome.filter(i => {
        const d = parseLocalDate(i.date);
        return d && d >= w.start && d <= w.end;
      });

      const savInWeek = allSavings.filter(s => {
        const d = parseLocalDate(s.date_logged);
        return d && d >= w.start && d <= w.end;
      });

      let spentSum = 0;
      let budgetGoal = 0;

      const fullBudgetCap = activeMonthConfigs.filter(c => c.config_type === 'Budget_Limit').reduce((sum, c) => sum + c.allocated_value, 0);
      const fullCategoryCap = activeMonthConfigs.filter(c => c.config_type === 'Budget_Limit' && c.key_name === state.analyticsCategory).reduce((sum, c) => sum + c.allocated_value, 0);

      if (state.analyticsCategory === 'ALL') {
        spentSum = txInWeek.reduce((sum, t) => sum + t.amount, 0);
        budgetGoal = fullBudgetCap / 4;
      } else {
        spentSum = txInWeek.filter(t => t.group === state.analyticsCategory).reduce((sum, t) => sum + t.amount, 0);
        budgetGoal = fullCategoryCap / 4;
      }

      let incomeSum = 0;
      let incomeGoal = 0;
      const fullIncomeGoal = activeMonthConfigs.filter(c => c.config_type === 'Income_Goal').reduce((sum, c) => sum + c.allocated_value, 0);
      const fullSourceGoal = activeMonthConfigs.filter(c => c.config_type === 'Income_Goal' && c.key_name === state.analyticsCategory).reduce((sum, c) => sum + c.allocated_value, 0);

      if (activeSegment === 'income' && state.analyticsCategory !== 'ALL') {
        incomeSum = incInWeek.filter(i => i.source === state.analyticsCategory).reduce((sum, i) => sum + i.amount, 0);
        incomeGoal = fullSourceGoal / 4;
      } else {
        incomeSum = incInWeek.reduce((sum, i) => sum + i.amount, 0);
        incomeGoal = fullIncomeGoal / 4;
      }

      const savingsSum = savInWeek.reduce((sum, s) => sum + s.amount_added, 0);
      const fullSavingsGoal = activeMonthConfigs.filter(c => c.config_type === 'Savings_Goal').reduce((sum, c) => sum + c.allocated_value, 0);
      const savingsGoal = fullSavingsGoal / 4;

      let actual = 0;
      let goal = 0;

      const isFutureWeek = (wk) => {
        const todayVal = new Date();
        todayVal.setHours(23, 59, 59, 999);
        return wk.start > todayVal;
      };

      if (isFutureWeek(w)) {
        actual = null;
        goal = 0;
      } else {
        if (activeSegment === 'expense') {
          actual = spentSum;
          goal = budgetGoal;
        } else if (activeSegment === 'savings') {
          actual = savingsSum;
          goal = savingsGoal;
        } else if (activeSegment === 'income') {
          actual = incomeSum;
          goal = incomeGoal;
        } else if (activeSegment === 'net') {
          actual = incomeSum - spentSum;
          goal = incomeGoal - budgetGoal;
        } else if (activeSegment === 'avg-spent') {
          actual = spentSum / 7.0;
          goal = budgetGoal / 7.0;
        }
      }

      const label = `${w.start.toLocaleString('en-US', { month: 'short' })} ${w.start.getDate()}-${w.end.getDate()}`;

      chartDataset.push({
        label,
        actual,
        goal,
        rawMonthYear: w
      });
    });
  }

  // Adjust legend visibility based on goals
  const hasGoals = chartDataset.some(d => d.goal > 0);
  document.getElementById('chart-legend-goal').style.display = hasGoals ? 'flex' : 'none';
  document.getElementById('chart-legend-average').style.display = 'flex';

  const container = document.getElementById('analytics-chart-container');
  window.renderLineChart(container, chartDataset, (clickedItem, clickedIndex) => {
    state.selectedAnalyticsMonthIndex = clickedIndex;
    renderAnalyticsView();
    
    // On mobile viewports, show the tapped point value inside a stylized modal popup
    if (window.innerWidth < 768 && clickedItem) {
      let title = clickedItem.label;
      
      const valStr = window.formatCurrency(clickedItem.actual || 0);
      const goalStr = window.formatCurrency(clickedItem.goal || 0);
      
      const segmentNameMap = {
        'income': 'Income',
        'expense': 'Expenses',
        'savings': 'Savings Added',
        'avg-spent': 'Daily Spent Average'
      };
      const currentSegmentName = segmentNameMap[state.analyticsSegment] || 'Value';
      
      let descText = `Actual ${currentSegmentName}: ${valStr}`;
      if (clickedItem.goal > 0) {
        descText += `\nGoal target: ${goalStr}`;
      }
      
      showWarningModal(title, descText);
    }
  }, state.selectedAnalyticsMonthIndex, activeSegment);

  // If a month index is selected, render its breakdown card, else render cumulative period summary
  if (state.selectedAnalyticsMonthIndex !== null && state.selectedAnalyticsMonthIndex >= 0 && state.selectedAnalyticsMonthIndex < chartDataset.length) {
    const selectedItem = chartDataset[state.selectedAnalyticsMonthIndex];
    renderMonthBreakdown(selectedItem.rawMonthYear, allTransactions, allIncome, activeSegment, pastMonthsPlaceholder, allSavings);
  } else {
    renderMonthBreakdown(null, allTransactions, allIncome, activeSegment, pastMonthsPlaceholder, allSavings);
  }
}

function renderMonthBreakdown(monthYear, allTransactions, allIncome, activeSegment, pastMonths, allSavings = []) {
  const breakdownCard = document.getElementById('analytics-breakdown-card');
  if (!breakdownCard) return;

  if (activeSegment === 'net') {
    breakdownCard.style.display = 'none';
    return;
  }

  const parseLocalDate = (dStr) => {
    if (!dStr) return null;
    const [y, m, d] = dStr.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  };

  const filterByPeriod = (item, dateField) => {
    if (!item[dateField]) return false;
    
    if (monthYear !== null) {
      if (Array.isArray(monthYear)) {
        const [y, m, d] = item[dateField].split('-');
        return monthYear.includes(`${m}-${y}`);
      }
      if (typeof monthYear === 'object' && monthYear.start && monthYear.end) {
        const d = parseLocalDate(item[dateField]);
        return d && d >= monthYear.start && d <= monthYear.end;
      }
      const [y, m, d] = item[dateField].split('-');
      return `${m}-${y}` === monthYear;
    }
    
    if (pastMonths) {
      if (Array.isArray(pastMonths)) {
        const [y, m, d] = item[dateField].split('-');
        return pastMonths.includes(`${m}-${y}`);
      }
      if (typeof pastMonths === 'object' && pastMonths.start && pastMonths.end) {
        const d = parseLocalDate(item[dateField]);
        return d && d >= pastMonths.start && d <= pastMonths.end;
      }
    }
    return true;
  };

  let monthNameReadable = 'Entire Period Summary';
  let numDays = 30; // default average

  if (monthYear !== null) {
    if (Array.isArray(monthYear)) {
      const [mStr, yStr] = monthYear[0].split('-');
      const m = parseInt(mStr);
      const qNum = Math.floor((m - 1) / 3) + 1;
      monthNameReadable = `Quarter Q${qNum} ${yStr}`;
      numDays = 90;
    } else if (typeof monthYear === 'object' && monthYear.start && monthYear.end) {
      const startStr = monthYear.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = monthYear.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      monthNameReadable = `Week: ${startStr} - ${endStr}`;
      numDays = 7;
    } else {
      const [mStr, yStr] = monthYear.split('-');
      const dateObj = new Date(parseInt(yStr), parseInt(mStr) - 1, 1);
      monthNameReadable = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      numDays = new Date(parseInt(yStr), parseInt(mStr), 0).getDate();
    }
  } else {
    if (state.analyticsDuration === 'year') {
      const yVal = state.activeMonthYear.split('-')[1];
      monthNameReadable = `Year ${yVal} Summary`;
      numDays = 365;
    } else if (state.analyticsDuration === 'all-time') {
      monthNameReadable = 'All-Time Quarters Summary';
      numDays = 720;
    } else if (state.analyticsDuration === 'month') {
      const [mStr, yStr] = state.activeMonthYear.split('-');
      const dateObj = new Date(parseInt(yStr), parseInt(mStr) - 1, 1);
      const endDate = new Date(parseInt(yStr), parseInt(mStr), 0);
      
      // Determine dynamic start/end boundaries for the 6 Sun-Sat weeks
      const baseEnd = new Date(endDate);
      const day = baseEnd.getDay();
      baseEnd.setDate(baseEnd.getDate() + (6 - day)); // Sat of that week
      baseEnd.setDate(baseEnd.getDate() - state.weeksOffset * 7); // Active week offset
      
      const wEnd = new Date(baseEnd);
      const wStart = new Date(wEnd);
      wStart.setDate(wEnd.getDate() - 35); // Start date is Sunday 5 weeks prior (35 days before Sat)
      
      const startStr = wStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = wEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      monthNameReadable = `${dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} (${startStr} - ${endStr})`;
      numDays = 42;
    }
  }

  const isAvgSpent = activeSegment === 'avg-spent';
  let breakdownTitle = '';
  let pieData = [];

  if (activeSegment === 'income') {
    const monthIncomes = allIncome.filter(i => filterByPeriod(i, 'date'));

    if (state.analyticsCategory === 'ALL') {
      breakdownTitle = `${monthNameReadable} Income by Source`;
      const groups = {};
      monthIncomes.forEach(i => {
        const src = i.source || 'Other';
        groups[src] = (groups[src] || 0) + i.amount;
      });

      pieData = Object.keys(groups).map(sourceName => ({
        label: sourceName,
        value: groups[sourceName]
      }));
    } else {
      breakdownTitle = `${monthNameReadable} Breakdown for ${state.analyticsCategory}`;
      const filteredIncomes = monthIncomes.filter(i => i.source === state.analyticsCategory);
      const groups = {};
      filteredIncomes.forEach(i => {
        const desc = i.description || 'Uncategorized';
        groups[desc] = (groups[desc] || 0) + i.amount;
      });

      pieData = Object.keys(groups).map(descName => ({
        label: descName,
        value: groups[descName]
      }));
    }
  } else if (activeSegment === 'savings') {
    const monthSavings = allSavings.filter(s => filterByPeriod(s, 'date_logged'));

    breakdownTitle = `${monthNameReadable} Savings by Account`;
    const groups = {};
    monthSavings.forEach(s => {
      const accName = s.account_name || 'Emergency Fund';
      groups[accName] = (groups[accName] || 0) + s.amount_added;
    });

    pieData = Object.keys(groups).map(accName => ({
      label: accName,
      value: groups[accName]
    }));
  } else {
    // Outflows (expenses)
    const transactions = allTransactions.filter(t => filterByPeriod(t, 'date'));

    if (state.analyticsCategory === 'ALL') {
      breakdownTitle = `${monthNameReadable} Expenses by Category`;
      const groups = {};
      transactions.forEach(t => {
        const cat = t.group || 'Uncategorized';
        groups[cat] = (groups[cat] || 0) + t.amount;
      });

      pieData = Object.keys(groups).map(catName => {
        const val = isAvgSpent ? (groups[catName] / numDays) : groups[catName];
        return { label: catName, value: val };
      });
    } else {
      breakdownTitle = `${monthNameReadable} Breakdown for ${state.analyticsCategory}`;
      const catTx = transactions.filter(t => t.group === state.analyticsCategory);
      const groups = {};
      catTx.forEach(t => {
        const sub = t.subgroup || 'Uncategorized';
        groups[sub] = (groups[sub] || 0) + t.amount;
      });

      pieData = Object.keys(groups).map(subName => {
        const val = isAvgSpent ? (groups[subName] / numDays) : groups[subName];
        return { label: subName, value: val };
      });
    }
  }

  pieData.sort((a, b) => b.value - a.value);

  document.getElementById('breakdown-title').textContent = breakdownTitle;
  document.getElementById('breakdown-subtitle').textContent = isAvgSpent 
    ? (monthYear === null ? 'Showing cumulative average spent per day across timeframe' : 'Showing average spent per day') 
    : (monthYear === null ? 'Showing cumulative period totals' : 'Showing monthly totals');

  const pieContainer = document.getElementById('breakdown-pie-container');
  window.renderPieChart(pieContainer, pieData, activeSegment);

  const legendContainer = document.getElementById('breakdown-list-legend');
  if (legendContainer) {
    legendContainer.innerHTML = '';
    const totalVal = pieData.reduce((sum, d) => sum + d.value, 0);

    if (pieData.length === 0) {
      legendContainer.innerHTML = `<span style="font-style:italic; color:var(--color-font-secondary); font-size:12px;">No transactions to show.</span>`;
    } else {
      const listUl = document.createElement('ul');
      listUl.style.listStyle = 'none';
      listUl.style.padding = '0';
      listUl.style.margin = '0';
      listUl.style.display = 'flex';
      listUl.style.flexDirection = 'row';
      listUl.style.flexWrap = 'wrap';
      listUl.style.justifyContent = 'center';
      listUl.style.gap = '8px 12px';
      listUl.style.width = '100%';

      let paletteColors = [
        '#1E352F', '#4A5D4E', '#8A9A86', '#6E6560', '#A37B73', '#8B9B9C', '#D4CBB5', '#A34843'
      ];
      if (activeSegment === 'income') {
        paletteColors = ['#1E352F', '#2d6a4f', '#4e9f50', '#8A9A86', '#a2d2a4', '#bce3bd'];
      } else if (activeSegment === 'expense') {
        paletteColors = ['#4a1c1c', '#a8201a', '#ff7d7d', '#A37B73', '#6E6560', '#8b6e60'];
      } else if (activeSegment === 'savings') {
        paletteColors = ['#b38f2d', '#8c7333', '#D4CBB5', '#ffcc00', '#6E6560', '#b5a176'];
      } else if (activeSegment === 'avg-spent') {
        paletteColors = ['#1f4068', '#2b4c7e', '#4A5D4E', '#8B9B9C', '#6E6560', '#D4CBB5'];
      }

      pieData.forEach((item, index) => {
        const color = paletteColors[index % paletteColors.length];
        const pct = totalVal > 0 ? (item.value / totalVal) * 100 : 0;

        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.gap = '6px';
        li.style.padding = '4px 10px';
        li.style.background = 'var(--color-base-canvas)';
        li.style.borderRadius = 'var(--border-radius-sm)';
        li.style.border = '1px solid var(--color-border)';
        li.innerHTML = `
          <span style="width:8px; height:8px; border-radius:50%; background-color:${color}; display:inline-block; flex-shrink:0;"></span>
          <span style="font-weight:600; color:var(--color-font-primary); font-size:11px;">${item.label}</span>
          <span style="font-weight:700; color:var(--color-font-primary); font-size:11px;" class="tabular-nums">${window.formatCurrency(item.value)}</span>
          <span style="font-weight:400; color:var(--color-font-secondary); font-size:10px;">(${pct.toFixed(0)}%)</span>
        `;
        listUl.appendChild(li);
      });

      legendContainer.appendChild(listUl);
    }
  }

  breakdownCard.style.display = 'block';
  breakdownCard.style.opacity = '0';
  setTimeout(() => {
    breakdownCard.style.opacity = '1';
  }, 50);
}
window.renderMonthBreakdown = renderMonthBreakdown;

// --- 7. Month Plan Configuration Wizard ---
// --- 7. Month Plan Configuration Wizard & Multi-Step Logic ---
function getMonthName(monthYearStr) {
  if (!monthYearStr) return '';
  const [m, y] = monthYearStr.split('-');
  const date = new Date(y, parseInt(m) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long' });
}

function getPreviousMonthYear(monthYearStr) {
  const [m, y] = monthYearStr.split('-').map(Number);
  let prevM = m - 1;
  let prevY = y;
  if (prevM === 0) {
    prevM = 12;
    prevY = y - 1;
  }
  return `${String(prevM).padStart(2, '0')}-${prevY}`;
}

function resetWizardState() {
  currentWizardStep = 1;
  wizardState.budgetLimits = {};
  wizardState.savingsGoal = 0;
  wizardState.incomeGoal = 0;
}

async function renderWizardView() {
  const categories = state.taxonomy;
  const groups = Object.keys(categories).filter(g => g !== 'Income');

  // Initialize wizardState from current configs, or fallback to prev configs
  const currentLimits = state.monthlyConfig.filter(c => c.config_type === 'Budget_Limit');
  const currentSavings = state.monthlyConfig.find(c => c.config_type === 'Savings_Goal');
  const currentIncome = state.monthlyConfig.find(c => c.config_type === 'Income_Goal');

  const prevMonthYear = getPreviousMonthYear(state.activeMonthYear);
  const prevConfigs = await db.getMonthlyConfig(prevMonthYear);
  const prevLimits = prevConfigs.filter(c => c.config_type === 'Budget_Limit');
  const prevSavings = prevConfigs.find(c => c.config_type === 'Savings_Goal');
  const prevIncome = prevConfigs.find(c => c.config_type === 'Income_Goal');

  // Sync wizardState with current database configs (if they exist) so that edits elsewhere are linked.
  groups.forEach(g => {
    const curLimit = currentLimits.find(c => c.key_name === g);
    const prevLimit = prevLimits.find(c => c.key_name === g);
    if (curLimit) {
      wizardState.budgetLimits[g] = curLimit.allocated_value;
    } else if (wizardState.budgetLimits[g] === undefined) {
      wizardState.budgetLimits[g] = prevLimit ? prevLimit.allocated_value : 0;
    }
  });
  
  if (currentSavings) {
    wizardState.savingsGoal = currentSavings.allocated_value;
  } else if (wizardState.savingsGoal === 0) {
    wizardState.savingsGoal = prevSavings ? prevSavings.allocated_value : 0;
  }

  if (currentIncome) {
    wizardState.incomeGoal = currentIncome.allocated_value;
  } else if (wizardState.incomeGoal === 0) {
    wizardState.incomeGoal = prevIncome ? prevIncome.allocated_value : 0;
  }

  // Render the current step
  await renderActiveWizardStep();
}

async function renderActiveWizardStep() {
  const prevMonthYear = getPreviousMonthYear(state.activeMonthYear);
  const activeMonthName = getMonthName(state.activeMonthYear);
  const prevMonthName = getMonthName(prevMonthYear);

  // Update wizard view h1 title dynamically
  const wizardTitleElement = document.querySelector('#view-wizard h1');
  if (wizardTitleElement) {
    wizardTitleElement.textContent = `${activeMonthName}'s Monthly Plan`;
  }

  // Update step progress indicator fill and active labels
  const progressFill = document.getElementById('wizard-progress-bar-fill');
  if (progressFill) {
    progressFill.style.width = `${currentWizardStep * 25}%`;
  }

  for (let i = 1; i <= 4; i++) {
    const lbl = document.getElementById(`wizard-step-lbl-${i}`);
    if (lbl) {
      if (i === currentWizardStep) {
        lbl.classList.add('active');
        lbl.style.fontWeight = '700';
        lbl.style.color = 'var(--color-primary-accent)';
      } else {
        lbl.classList.remove('active');
        lbl.style.fontWeight = 'normal';
        lbl.style.color = 'var(--color-font-secondary)';
      }
    }
  }

  // Update controls visibility
  const prevBtn = document.getElementById('btn-wizard-prev');
  const nextBtn = document.getElementById('btn-wizard-next');
  const updateBtn = document.getElementById('btn-wizard-update');
  if (prevBtn) prevBtn.style.display = currentWizardStep > 1 ? 'block' : 'none';
  if (updateBtn) {
    updateBtn.style.display = (currentWizardStep >= 1 && currentWizardStep <= 3) ? 'block' : 'none';
  }
  if (nextBtn) {
    nextBtn.textContent = currentWizardStep === 4 ? 'Complete Month Plan' : 'Next';
    nextBtn.style.backgroundColor = 'var(--color-success)';
  }

  const contentContainer = document.getElementById('wizard-step-content');
  if (!contentContainer) return;
  contentContainer.innerHTML = '';

  const prevConfigs = await db.getMonthlyConfig(prevMonthYear);
  const prevLimits = prevConfigs.filter(c => c.config_type === 'Budget_Limit');
  const prevSavings = prevConfigs.find(c => c.config_type === 'Savings_Goal');
  const prevIncome = prevConfigs.find(c => c.config_type === 'Income_Goal');

  if (currentWizardStep === 1) {
    // === STEP 1: BUDGET ===
    const prevTransactions = await db.getTransactions(prevMonthYear);
    const prevTotalLimit = prevLimits.reduce((sum, c) => sum + c.allocated_value, 0);
    const prevTotalSpent = prevTransactions.reduce((sum, t) => sum + t.amount, 0);
    const prevRemaining = prevTotalLimit - prevTotalSpent;

    let bannerHtml = '';
    if (prevRemaining > 0) {
      bannerHtml = `
        <div style="background-color: var(--color-success-light); border: 1px solid var(--color-success); color: var(--color-success); padding: var(--spacing-md); border-radius: var(--border-radius-md); margin-bottom: var(--spacing-md); text-align: center;">
          <strong>Congratulations!</strong> You were under budget by <span class="tabular-nums">${window.formatCurrency(prevRemaining)}</span> in ${prevMonthName}.
        </div>
      `;
    } else if (prevRemaining < 0) {
      bannerHtml = `
        <div style="background-color: #FCEBEA; border: 1px solid var(--color-alert); color: var(--color-alert); padding: var(--spacing-md); border-radius: var(--border-radius-md); margin-bottom: var(--spacing-md); text-align: center;">
          <strong>Heads up!</strong> You were over budget by <span class="tabular-nums">${window.formatCurrency(Math.abs(prevRemaining))}</span> in ${prevMonthName}. Consider refining your limits for this cycle.
        </div>
      `;
    } else {
      bannerHtml = `
        <div style="background-color: var(--color-surface-variant); border: 1px solid var(--color-border); color: var(--color-font-primary); padding: var(--spacing-md); border-radius: var(--border-radius-md); margin-bottom: var(--spacing-md); text-align: center;">
          You spent exactly your budget limit in ${prevMonthName}!
        </div>
      `;
    }

    const stepDiv = document.createElement('div');
    stepDiv.innerHTML = `
      ${bannerHtml}
      <h2 style="margin-bottom: var(--spacing-md); color: var(--color-primary-accent);">Step 1: ${prevMonthName} Budget Review & Limits</h2>
      <p class="text-meta" style="margin-bottom: var(--spacing-md);">Review your spending in ${prevMonthName}. Blue indicates under-utilization (<70%), suggesting you could decrease the budget. Red indicates overbudget. Click any budget number to edit it.</p>
      
      <div class="tracking-grid" id="wizard-budget-grid" style="margin-bottom: var(--spacing-lg);">
        <!-- Budget items populate here -->
      </div>

      <div class="card" style="padding: var(--spacing-md); text-align: right; background-color: var(--color-surface-variant); margin-bottom: 0;">
        <span class="text-meta" style="font-weight:600; margin-right: var(--spacing-sm);">Total Planned Budget:</span>
        <span id="wizard-new-budget-total" class="tabular-nums" style="font-size: 18px; font-weight: 700; color: var(--color-primary-accent);">$0.00</span>
      </div>
    `;
    contentContainer.appendChild(stepDiv);

    // Populate grid
    const grid = document.getElementById('wizard-budget-grid');
    const groups = Object.keys(state.taxonomy).filter(g => g !== 'Income');

    const updateNewBudgetTotal = () => {
      const total = Object.values(wizardState.budgetLimits).reduce((sum, v) => sum + v, 0);
      document.getElementById('wizard-new-budget-total').textContent = window.formatCurrency(total);
    };

    groups.forEach(g => {
      const prevTransactionsGroup = prevTransactions.filter(t => t.group === g);
      const prevSpentVal = prevTransactionsGroup.reduce((sum, t) => sum + t.amount, 0);
      const prevLimitConf = prevLimits.find(c => c.key_name === g);
      const prevLimitVal = prevLimitConf ? prevLimitConf.allocated_value : 0;
      const prevPct = prevLimitVal > 0 ? (prevSpentVal / prevLimitVal) * 100 : 0;

      let cellHighlightClass = '';
      let highlightComment = '';
      if (prevLimitVal > 0 && prevPct < 70) {
        cellHighlightClass = 'wizard-cell-under';
        highlightComment = 'Plenty of space (Consider decreasing)';
      } else if (prevSpentVal > prevLimitVal) {
        cellHighlightClass = 'wizard-cell-over';
        highlightComment = 'Over budget (Consider increasing)';
      }

      const tile = document.createElement('div');
      tile.className = `card ${cellHighlightClass}`;
      tile.style.marginBottom = '0';
      tile.style.padding = 'var(--spacing-md)';
      tile.style.display = 'flex';
      tile.style.flexDirection = 'column';
      tile.style.justifyContent = 'space-between';
      tile.style.cursor = 'pointer';

      const currentPlannedVal = wizardState.budgetLimits[g] || 0;
      const subcategoriesList = state.taxonomy[g] || [];
      const subcategoriesHtml = subcategoriesList.length > 0 
        ? `<div class="wizard-tile-subcategories" style="display: none; font-size: 10px; color: var(--color-font-secondary); margin-top: var(--spacing-xs); padding-top: var(--spacing-xs); border-top: 1px dashed rgba(43, 36, 33, 0.08); text-align: left; opacity: 0.85;">
             <strong>Subcategories:</strong> ${subcategoriesList.join(', ')}
           </div>`
        : '';

      tile.innerHTML = `
        <div>
          <h3 style="margin-bottom: 2px; color: inherit; font-size: 13px;">${g}</h3>
          <div class="text-meta" style="color: inherit; opacity: 0.85; font-size: 10px; margin-bottom: 6px;">
            Prev: ${window.formatCurrency(prevSpentVal)} of ${window.formatCurrency(prevLimitVal)}
          </div>
          ${highlightComment ? `<div style="font-size: 9px; font-weight: 600; font-style: italic; margin-bottom: 8px;">${highlightComment}</div>` : ''}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(43, 36, 33, 0.08); padding-top: 6px; margin-top: 4px;">
          <span class="text-meta" style="color: inherit; opacity: 0.85;">New Limit:</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button class="wizard-adjust-btn btn-minus" title="Decrease limit by $10">−</button>
            <div class="wizard-editable-value tabular-nums" style="font-weight: 700; font-size: 14px; cursor: pointer; border-bottom: 1px dashed currentColor; padding: 2px 4px;">
              ${window.formatCurrency(currentPlannedVal)}
            </div>
            <button class="wizard-adjust-btn btn-plus" title="Increase limit by $10">+</button>
          </div>
        </div>
        ${subcategoriesHtml}
      `;

      tile.addEventListener('click', (e) => {
        if (e.target.closest('.wizard-adjust-btn') || e.target.closest('.wizard-editable-value') || e.target.closest('.wizard-inline-input')) {
          return;
        }
        const subDiv = tile.querySelector('.wizard-tile-subcategories');
        if (subDiv) {
          const isHidden = subDiv.style.display === 'none';
          subDiv.style.display = isHidden ? 'block' : 'none';
        }
      });

      // Set up inline edit
      const valDiv = tile.querySelector('.wizard-editable-value');
      valDiv.onclick = (e) => {
        if (valDiv.querySelector('input')) return;

        const currentVal = wizardState.budgetLimits[g] || 0;
        valDiv.innerHTML = `<span style="font-size:12px; font-weight:700;">$</span><input type="text" class="wizard-inline-input" value="${currentVal.toFixed(2)}" style="width: 70px; height: 22px; font-size: 12px; padding: 0 4px;">`;
        const input = valDiv.querySelector('input');
        input.focus();
        input.select();
        bindATMInput(input);

        let updated = false;
        const saveVal = async () => {
          if (updated) return;
          updated = true;
          const newRaw = parseFloat(input.value.replace(/[^0-9.]/g, '')) || 0;
          wizardState.budgetLimits[g] = newRaw;
          valDiv.innerHTML = window.formatCurrency(newRaw);
          updateNewBudgetTotal();
          await db.updateMonthlyBudgetLimit(state.activeMonthYear, g, newRaw);
        };

        input.onblur = saveVal;
        input.onkeydown = (e) => {
          if (e.key === 'Enter') {
            saveVal();
          }
        };
      };

      // Set up minus and plus buttons
      const minusBtn = tile.querySelector('.btn-minus');
      const plusBtn = tile.querySelector('.btn-plus');

      minusBtn.onclick = async (e) => {
        e.stopPropagation();
        if (valDiv.querySelector('input')) return;
        const currentVal = wizardState.budgetLimits[g] || 0;
        const newRaw = Math.max(0, currentVal - 10);
        wizardState.budgetLimits[g] = newRaw;
        valDiv.innerHTML = window.formatCurrency(newRaw);
        updateNewBudgetTotal();
        await db.updateMonthlyBudgetLimit(state.activeMonthYear, g, newRaw);
      };

      plusBtn.onclick = async (e) => {
        e.stopPropagation();
        if (valDiv.querySelector('input')) return;
        const currentVal = wizardState.budgetLimits[g] || 0;
        const newRaw = currentVal + 10;
        wizardState.budgetLimits[g] = newRaw;
        valDiv.innerHTML = window.formatCurrency(newRaw);
        updateNewBudgetTotal();
        await db.updateMonthlyBudgetLimit(state.activeMonthYear, g, newRaw);
      };

      grid.appendChild(tile);
    });

    updateNewBudgetTotal();

  } else if (currentWizardStep === 2) {
    // === STEP 2: SAVINGS ===
    const prevSavingsGoalVal = prevSavings ? prevSavings.allocated_value : 0;
    const allocations = await db.getSavingsAccounts();
    const prevSavingsAllocated = allocations
      .filter(s => {
        if (!s.date_logged) return false;
        const [y, m, d] = s.date_logged.split('-');
        return `${m}-${y}` === prevMonthYear;
      })
      .reduce((sum, s) => sum + s.amount_added, 0);

    // Calculate free cash using recently planned budget limits
    const newBudgetTotal = Object.values(wizardState.budgetLimits).reduce((sum, v) => sum + v, 0);
    const activeMonthTransactions = await db.getTransactions(state.activeMonthYear);
    const spentTotal = activeMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
    const remainingBudget = Math.max(0, newBudgetTotal - spentTotal);

    const allHistoricalIn = (await db.getIncome()).reduce((sum, i) => sum + i.amount, 0);
    const allHistoricalOut = (await db.getTransactions()).reduce((sum, t) => sum + t.amount, 0);
    const allHistoricalSavings = allocations.reduce((sum, s) => sum + s.amount_added, 0);
    const liquidCash = allHistoricalIn - allHistoricalOut - allHistoricalSavings;
    const carryOverVal = getCarryOverCashVal();
    const freeCashVal = Math.max(0, liquidCash - remainingBudget - carryOverVal);

    // If goal is 0, default to previous month's savings goal
    if (wizardState.savingsGoal === 0) {
      wizardState.savingsGoal = prevSavingsGoalVal;
    }

    const stepDiv = document.createElement('div');
    stepDiv.innerHTML = `
      <h2 style="margin-bottom: var(--spacing-sm); color: var(--color-primary-accent);">Step 2: Savings Goal Setup</h2>
      <p class="text-meta" style="margin-bottom: var(--spacing-md);">Review ${prevMonthName}'s savings allocations and specify your savings target goal for ${activeMonthName}.</p>
      
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:var(--spacing-md); margin-bottom:var(--spacing-md);">
        <div class="card" style="margin-bottom:0; padding:var(--spacing-md); text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <span class="text-meta">${prevMonthName}'s Goal vs Actual</span>
          <div class="metric-large-num tabular-nums" style="font-size: 16px; margin: 4px 0 0 0; color: var(--color-font-primary);">
            Allocated: ${window.formatCurrency(prevSavingsAllocated)} <span style="font-size:10px; font-weight:normal; color:var(--color-font-secondary); display:block; margin-top:2px;">Goal: ${window.formatCurrency(prevSavingsGoalVal)}</span>
          </div>
        </div>
        <div class="card" style="margin-bottom:0; padding:var(--spacing-md); text-align:center; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <span class="text-meta">Free Cash</span>
          <div class="metric-large-num tabular-nums" style="font-size: 16px; margin: 4px 0 0 0; color: var(--color-success);">
            ${window.formatCurrency(freeCashVal)}
          </div>
        </div>
      </div>

      <div class="card" style="padding: var(--spacing-md); margin-bottom: var(--spacing-lg);">
        <h3 style="margin-bottom: var(--spacing-xs);">${activeMonthName} Savings Goal</h3>
        <span class="text-meta" style="display:block; margin-bottom: var(--spacing-sm);">How much do you intend to save in ${activeMonthName}? (Defaults to ${prevMonthName}'s goal of ${window.formatCurrency(prevSavingsGoalVal)})</span>
        <div class="form-group amount-wrapper" style="margin-bottom:0; position:relative;">
          <span class="amount-symbol" style="left:8px; font-size:11px;">$</span>
          <input type="text" class="form-input amount-field" id="wizard-savings-goal-input" placeholder="0.00" value="${wizardState.savingsGoal.toFixed(2)}" style="padding: 4px 4px 4px 20px; font-size:12px; height:auto;">
        </div>
      </div>

      <h3 style="margin-bottom: var(--spacing-sm); color: var(--color-primary-accent);">Savings Account Targets Status</h3>
      <p class="text-meta" style="margin-bottom: var(--spacing-sm);">Accounts are ordered by target date (soonest deadline first, undated last).</p>
      
      <div class="tracking-grid" id="wizard-savings-grid">
        <!-- Savings account items -->
      </div>
    `;
    contentContainer.appendChild(stepDiv);

    const goalInput = document.getElementById('wizard-savings-goal-input');
    if (goalInput) {
      bindATMInput(goalInput);
      const saveGoalVal = async () => {
        const val = parseFloat(goalInput.value.replace(/[^0-9.]/g, '')) || 0;
        wizardState.savingsGoal = val;
        await db.updateMonthlySavingsGoal(state.activeMonthYear, val);
      };
      goalInput.addEventListener('change', saveGoalVal);
      goalInput.addEventListener('blur', saveGoalVal);
      goalInput.addEventListener('input', (e) => {
        wizardState.savingsGoal = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0;
      });
    }

    // Populate savings accounts targets
    const uniqueAccounts = {};
    const accountMetadata = {};
    allocations.forEach(s => {
      uniqueAccounts[s.account_id] = (uniqueAccounts[s.account_id] || 0) + s.amount_added;
      accountMetadata[s.account_id] = {
        name: s.account_name,
        target: s.target_amount,
        date: s.target_date
      };
    });

    const accountIds = Object.keys(uniqueAccounts);
    const savingsGrid = document.getElementById('wizard-savings-grid');

    if (accountIds.length === 0) {
      savingsGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--color-font-secondary); padding: var(--spacing-md);">No savings accounts created yet.</div>`;
    } else {
      // Sort: target date soonest first, null/empty target dates last
      const sortedAccs = accountIds.map(id => ({
        id,
        balance: uniqueAccounts[id],
        meta: accountMetadata[id]
      })).sort((a, b) => {
        if (!a.meta.date && !b.meta.date) return 0;
        if (!a.meta.date) return 1;
        if (!b.meta.date) return -1;
        return new Date(a.meta.date) - new Date(b.meta.date);
      });

      sortedAccs.forEach(acc => {
        const pct = acc.meta.target ? Math.min((acc.balance / acc.meta.target) * 100, 100) : 0;
        const tile = document.createElement('div');
        tile.className = 'card';
        tile.style.marginBottom = '0';
        tile.style.padding = 'var(--spacing-md)';
        tile.style.display = 'flex';
        tile.style.alignItems = 'center';
        tile.style.gap = 'var(--spacing-md)';

        // Arc Progress circle SVG
        const circleRadius = 15;
        const circumference = 2 * Math.PI * circleRadius; // 94.25
        const strokeOffset = circumference * (1 - pct / 100);

        tile.innerHTML = `
          <div style="width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; position: relative; flex-shrink: 0;">
            <svg width="45" height="45" viewBox="0 0 36 36" style="transform: rotate(-90deg); width: 100%; height: 100%;">
              <circle cx="18" cy="18" r="${circleRadius}" fill="none" stroke="var(--color-surface-variant)" stroke-width="3.5" />
              <circle cx="18" cy="18" r="${circleRadius}" fill="none" stroke="var(--color-savings-gold)" stroke-width="3.5" stroke-dasharray="${circumference}" stroke-dashoffset="${strokeOffset}" stroke-linecap="round" style="transition: stroke-dashoffset 0.5s var(--transition-glide);" />
            </svg>
            <span class="tabular-nums" style="position: absolute; font-size: 9px; font-weight: 700; color: var(--color-font-primary);">${Math.round(pct)}%</span>
          </div>
          <div style="flex: 1; min-width: 0;">
            <h3 style="font-size: 13px; margin: 0; color: var(--color-primary-accent); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${acc.meta.name}</h3>
            <div class="text-meta tabular-nums" style="margin-top: 2px;">
              Saved: ${window.formatCurrency(acc.balance)} of ${acc.meta.target ? window.formatCurrency(acc.meta.target) : 'No Limit'}
            </div>
            <div class="text-meta" style="margin-top: 2px; font-style: italic; font-size: 10px; color: var(--color-font-secondary);">
              Deadline: ${acc.meta.date ? window.formatDate(acc.meta.date) : 'No Deadline'}
            </div>
          </div>
        `;
        savingsGrid.appendChild(tile);
      });
    }

  } else if (currentWizardStep === 3) {
    // === STEP 3: INCOME ===
    const prevIncomeGoalVal = prevIncome ? prevIncome.allocated_value : 0;
    const prevIncomeActual = (await db.getIncome(prevMonthYear)).reduce((sum, i) => sum + i.amount, 0);

    // Goal Accomplished check
    let bannerHtml = '';
    if (prevIncomeGoalVal > 0 && prevIncomeActual >= prevIncomeGoalVal) {
      bannerHtml = `
        <div class="income-goal-accomplished">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="var(--color-success)" style="margin: 0 auto 6px auto; display: block;">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <strong style="font-size: 14px; text-transform: uppercase; letter-spacing:0.05em; display:block; margin-bottom:2px;">Goal Accomplished!</strong>
          You earned <span class="tabular-nums" style="font-weight:700;">${window.formatCurrency(prevIncomeActual)}</span> vs your goal of <span class="tabular-nums" style="font-weight:700;">${window.formatCurrency(prevIncomeGoalVal)}</span>. Great work!
        </div>
      `;
    } else {
      bannerHtml = `
        <div style="background-color: var(--color-surface-variant); border: 1px solid var(--color-border); color: var(--color-font-secondary); padding: var(--spacing-md); border-radius: var(--border-radius-md); margin-bottom: var(--spacing-md); text-align: center;">
          ${prevMonthName} Income: <strong class="tabular-nums" style="color:var(--color-font-primary);">${window.formatCurrency(prevIncomeActual)}</strong> vs Goal: <strong class="tabular-nums" style="color:var(--color-font-primary);">${window.formatCurrency(prevIncomeGoalVal)}</strong>.
        </div>
      `;
    }

    // Math: Min Income = total monthly budget (new) + savings goal (new) - free cash (new)
    const newBudgetTotal = Object.values(wizardState.budgetLimits).reduce((sum, v) => sum + v, 0);
    const newSavingsGoal = wizardState.savingsGoal;
    
    const allocations = await db.getSavingsAccounts();
    const activeMonthTransactions = await db.getTransactions(state.activeMonthYear);
    const spentTotal = activeMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
    const remainingBudget = Math.max(0, newBudgetTotal - spentTotal);
    const allHistoricalIn = (await db.getIncome()).reduce((sum, i) => sum + i.amount, 0);
    const allHistoricalOut = (await db.getTransactions()).reduce((sum, t) => sum + t.amount, 0);
    const allHistoricalSavings = allocations.reduce((sum, s) => sum + s.amount_added, 0);
    const liquidCash = allHistoricalIn - allHistoricalOut - allHistoricalSavings;
    const carryOverVal = getCarryOverCashVal();
    const freeCashVal = Math.max(0, liquidCash - remainingBudget - carryOverVal);

    const minRequiredIncome = Math.max(0, newBudgetTotal + newSavingsGoal - freeCashVal);

    if (wizardState.incomeGoal === 0) {
      wizardState.incomeGoal = prevIncomeGoalVal;
    }

    const stepDiv = document.createElement('div');
    stepDiv.innerHTML = `
      ${bannerHtml}
      <h2 style="margin-bottom: var(--spacing-sm); color: var(--color-primary-accent);">Step 3: Income Target Setup</h2>
      <p class="text-meta" style="margin-bottom: var(--spacing-md);">Review ${prevMonthName}'s income goal achievement and specify your target income goal for ${activeMonthName}.</p>
      
      <div class="card" style="padding: var(--spacing-md); border-left: 4px solid var(--color-primary-accent); margin-bottom: var(--spacing-md); background-color: var(--color-base-canvas);">
        <span class="text-meta" style="font-weight: 600; text-transform: uppercase;">Minimum Cash Flow Requirement:</span>
        <div class="metric-large-num tabular-nums" style="font-size: 20px; color: var(--color-primary-accent); margin: 6px 0;">
          ${window.formatCurrency(minRequiredIncome)}
        </div>
        <span class="text-helper" style="font-size:10px;">Calculated as: Budget Limit (${window.formatCurrency(newBudgetTotal)}) + Savings Goal (${window.formatCurrency(newSavingsGoal)}) - Free Cash (${window.formatCurrency(freeCashVal)}) (Checking minus Remaining Budget minus Carry-over Cash).</span>
      </div>

      <div class="card" style="padding: var(--spacing-md); margin-bottom: var(--spacing-lg);">
        <h3 style="margin-bottom: var(--spacing-xs);">${activeMonthName} Income Goal</h3>
        <span class="text-meta" style="display:block; margin-bottom: var(--spacing-sm);">Establish a target income benchmark for this cycle. (Defaults to ${prevMonthName}'s goal of ${window.formatCurrency(prevIncomeGoalVal)})</span>
        <div class="form-group amount-wrapper" style="margin-bottom:0; position:relative;">
          <span class="amount-symbol" style="left:8px; font-size:11px;">$</span>
          <input type="text" class="form-input amount-field" id="wizard-income-goal-input" placeholder="0.00" value="${wizardState.incomeGoal.toFixed(2)}" style="padding: 4px 4px 4px 20px; font-size:12px; height:auto;">
        </div>
      </div>
    `;
    contentContainer.appendChild(stepDiv);

    const goalInput = document.getElementById('wizard-income-goal-input');
    if (goalInput) {
      bindATMInput(goalInput);
      const saveGoalVal = async () => {
        const val = parseFloat(goalInput.value.replace(/[^0-9.]/g, '')) || 0;
        wizardState.incomeGoal = val;
        await db.updateMonthlyIncomeGoal(state.activeMonthYear, val);
      };
      goalInput.addEventListener('change', saveGoalVal);
      goalInput.addEventListener('blur', saveGoalVal);
      goalInput.addEventListener('input', (e) => {
        wizardState.incomeGoal = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0;
      });
    }

  } else if (currentWizardStep === 4) {
    // === STEP 4: SUMMARY & CONFIRMATION ===
    const newBudgetTotal = Object.values(wizardState.budgetLimits).reduce((sum, v) => sum + v, 0);
    const newSavingsGoal = wizardState.savingsGoal;
    const newIncomeGoal = wizardState.incomeGoal;

    const debts = await db.getDebts();
    const payables = debts.filter(d => d.type === 'Payable');

    let payablesHtml = '';
    if (payables.length === 0) {
      payablesHtml = `<div class="text-helper" style="color: var(--color-font-secondary); padding: 8px 0;">No active liabilities/payables outstanding.</div>`;
    } else {
      payablesHtml = `
        <div class="table-container" style="margin-top: var(--spacing-sm);">
          <table class="data-table">
            <thead>
              <tr>
                <th>Liability Description</th>
                <th style="text-align: right;">Amount Owed</th>
              </tr>
            </thead>
            <tbody>
              ${payables.map(p => `
                <tr>
                  <td>${p.description}</td>
                  <td class="tabular-nums amount-negative" style="text-align: right;">-${window.formatCurrency(p.total_amount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    const stepDiv = document.createElement('div');
    stepDiv.innerHTML = `
      <h2 style="margin-bottom: var(--spacing-sm); color: var(--color-primary-accent);">Step 4: Summary & Complete Plan</h2>
      <p class="text-meta" style="margin-bottom: var(--spacing-md);">Review your target parameters before locking in the plan. These can be adjusted anytime during the cycle by visiting the ${activeMonthName} Plan page.</p>
      
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--spacing-md); margin-bottom: var(--spacing-lg);">
        <div class="card" style="margin-bottom:0; padding:var(--spacing-md); text-align:center;">
          <span class="text-meta">${activeMonthName} Budget</span>
          <div class="metric-large-num tabular-nums" style="color: var(--color-font-primary); font-size:18px; margin-top: 4px;">
            ${window.formatCurrency(newBudgetTotal)}
          </div>
        </div>
        <div class="card" style="margin-bottom:0; padding:var(--spacing-md); text-align:center;">
          <span class="text-meta">${activeMonthName} Savings Goal</span>
          <div class="metric-large-num tabular-nums" style="color: var(--color-savings-gold); font-size:18px; margin-top: 4px;">
            ${window.formatCurrency(newSavingsGoal)}
          </div>
        </div>
        <div class="card" style="margin-bottom:0; padding:var(--spacing-md); text-align:center;">
          <span class="text-meta">${activeMonthName} Income Goal</span>
          <div class="metric-large-num tabular-nums" style="color: var(--color-success); font-size:18px; margin-top: 4px;">
            ${window.formatCurrency(newIncomeGoal)}
          </div>
        </div>
      </div>

      <div class="card" style="padding: var(--spacing-md); margin-bottom: 0;">
        <h3 style="color: var(--color-primary-accent); margin-bottom: var(--spacing-xs);">Outstanding ${activeMonthName} Payables</h3>
        <span class="text-meta">Ensure your income targets cover these settling liabilities.</span>
        ${payablesHtml}
      </div>
    `;
    contentContainer.appendChild(stepDiv);
  }
}

async function saveWizardPlan() {
  const configs = [];

  // Add Budget Limits
  for (const [groupName, limitVal] of Object.entries(wizardState.budgetLimits)) {
    configs.push({
      config_type: 'Budget_Limit',
      key_name: groupName,
      allocated_value: limitVal
    });
  }

  // Add Savings Goal
  configs.push({
    config_type: 'Savings_Goal',
    key_name: 'Monthly Savings Goal',
    allocated_value: wizardState.savingsGoal
  });

  // Add Income Goal
  configs.push({
    config_type: 'Income_Goal',
    key_name: 'Salary',
    allocated_value: wizardState.incomeGoal
  });

  // Add Completed flag
  configs.push({
    config_type: 'Plan_Completed',
    key_name: 'Completed',
    allocated_value: 1
  });

  await db.saveMonthlyConfig(state.activeMonthYear, configs);
  
  // Clear wizard state cached data
  resetWizardState();

  triggerSuccessAnimation("Month Plan Completed", 'dashboard');
}

// ==========================================================================
// Floating Action Menu & Drawer Overlay System
// ==========================================================================
function bindFAB() {
  const container = document.querySelector('.flex-fab-container');
  const mainBtn = document.querySelector('.flex-fab-main');

  mainBtn.addEventListener('click', () => {
    container.classList.toggle('open');
  });

  document.querySelectorAll('.fab-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-action');
      openFormDrawer(type);
    });
  });
}

function openFormDrawer(type) {
  if (!db.isGoogleConnected()) {
    showConfirmModal(
      "Sign In Required",
      "You are currently offline. Please sign in to your Google Account to record transactions.",
      () => {
        reauthorizeGoogleSheets();
      }
    );
    return;
  }

  state.editingTransactionId = null;
  state.editingTransactionType = null;
  state.editingDebtId = null;

  // Restore titles and buttons
  const expDrawer = document.getElementById('drawer-expense');
  if (expDrawer) {
    expDrawer.querySelector('.drawer-title').textContent = "Add Expense Allocation";
    const btnSaveNewExp = document.getElementById('btn-save-new-expense');
    if (btnSaveNewExp) btnSaveNewExp.style.display = 'block';
    const btnSaveExp = document.getElementById('btn-save-expense');
    if (btnSaveExp) btnSaveExp.textContent = "Save & Exit";
  }
  const incDrawer = document.getElementById('drawer-income');
  if (incDrawer) {
    incDrawer.querySelector('.drawer-title').textContent = "Record Asset Inflow";
    const btnSaveNewInc = document.getElementById('btn-save-new-income');
    if (btnSaveNewInc) btnSaveNewInc.style.display = 'block';
    const btnSaveInc = document.getElementById('btn-save-income');
    if (btnSaveInc) btnSaveInc.textContent = "Save & Exit";
  }
  const debtDrawer = document.getElementById('drawer-debt');
  if (debtDrawer) {
    debtDrawer.querySelector('.drawer-title').textContent = "Log Liability or Claim";
    const btnSaveDebt = document.getElementById('btn-save-debt');
    if (btnSaveDebt) btnSaveDebt.textContent = "Save & Log Ledger";
  }

  const formContainer = document.getElementById('form-overlay-container');
  const drawers = document.querySelectorAll('.form-drawer');
  
  drawers.forEach(d => d.style.display = 'none');

  const today = window.getLocalYYYYMMDD();
  let targetDrawer;
  if (type === 'expense') {
    targetDrawer = document.getElementById('drawer-expense');
  } else if (type === 'income') {
    targetDrawer = document.getElementById('drawer-income');
  } else if (type === 'savings') {
    targetDrawer = document.getElementById('drawer-savings');
  } else if (type === 'debt') {
    targetDrawer = document.getElementById('drawer-debt');
  }

  if (targetDrawer) {
    // 1. Reset all inputs, selects, and text fields first
    targetDrawer.querySelectorAll('input:not([type="hidden"]), select').forEach(control => {
      if (control.type === 'checkbox') {
        control.checked = false;
      } else if (control.classList.contains('amount-field')) {
        control.value = '0.00';
        control._rawATMValue = 0;
      } else if (control.tagName === 'SELECT') {
        control.selectedIndex = 0;
      } else {
        control.value = '';
      }
    });

    // 2. Apply default pre-fill values
    if (type === 'expense') {
      document.getElementById('exp-date').value = today;
      prefillExpenseCategories();
      populateDrainSavingsDropdown(document.getElementById('exp-drain-savings'));
    } else if (type === 'income') {
      document.getElementById('inc-date').value = today;
      const selectEl = document.getElementById('inc-source-select');
      populateIncomeSourceDropdown(selectEl);
      const newContainer = document.getElementById('inc-source-new-container');
      if (newContainer) newContainer.style.display = 'none';
      const sourceInput = document.getElementById('inc-source');
      if (sourceInput) {
        sourceInput.value = '';
        sourceInput.removeAttribute('required');
      }
    } else if (type === 'debt') {
      document.getElementById('debt-date').value = today;
    }

    targetDrawer.style.display = 'flex';
    formContainer.classList.add('active');
    
    targetDrawer.querySelectorAll('.form-input').forEach(i => {
      i.classList.remove('error');
      const err = i.parentNode.querySelector('.error-label');
      if (err) err.remove();
    });

    setTimeout(() => {
      const firstInput = targetDrawer.querySelector('.form-input');
      if (firstInput) firstInput.focus();
    }, 100);
  }
}

function closeFormDrawer() {
  const formContainer = document.getElementById('form-overlay-container');
  formContainer.classList.remove('active');
  document.querySelector('.flex-fab-container').classList.remove('open');
  
  // Clear editing state
  state.editingTransactionId = null;
  state.editingTransactionType = null;
  state.editingDebtId = null;
}

function prefillExpenseCategories() {
  const groupSelect = document.getElementById('exp-group');
  const subSelect = document.getElementById('exp-subgroup');
  
  groupSelect.innerHTML = '<option value="">-- Choose Category --</option>';
  subSelect.innerHTML = '<option value="">-- Select Subgroup --</option>';

  const groups = Object.keys(state.taxonomy).filter(g => g !== 'Income');
  groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    groupSelect.appendChild(opt);
  });

  groupSelect.addEventListener('change', () => {
    const selectedGroup = groupSelect.value;
    subSelect.innerHTML = '<option value="">-- Select Subgroup --</option>';
    
    if (selectedGroup && state.taxonomy[selectedGroup]) {
      state.taxonomy[selectedGroup].forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        subSelect.appendChild(opt);
      });
    }
  });
}

// ==========================================================================
// ATM Input Logic (Right-to-Left Shift)
// ==========================================================================
function bindATMInput(inputEl) {
  if (inputEl._atmBound) return;
  inputEl._atmBound = true;

  inputEl.value = '0.00';
  inputEl._rawATMValue = 0;

  const format = (cents) => {
    return (cents / 100).toFixed(2);
  };

  const syncRawValue = () => {
    const isNegative = inputEl.value.includes('-');
    const clean = inputEl.value.replace(/[^0-9]/g, '');
    const val = parseInt(clean, 10) || 0;
    inputEl._rawATMValue = isNegative ? -val : val;
  };

  inputEl.addEventListener('amountset', syncRawValue);

  inputEl.addEventListener('keydown', (e) => {
    const isNegative = inputEl._rawATMValue < 0;
    let raw = Math.abs(inputEl._rawATMValue);

    if (e.key === 'Backspace') {
      e.preventDefault();
      raw = Math.floor(raw / 10);
      inputEl._rawATMValue = isNegative ? -raw : raw;
      inputEl.value = (inputEl._rawATMValue < 0 ? '-' : '') + format(raw);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      inputEl._rawATMValue = 0;
      inputEl.value = '0.00';
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (e.key === 'Enter') {
      const form = inputEl.closest('.form-drawer');
      if (form) {
        const inputs = Array.from(form.querySelectorAll('.form-input'));
        const index = inputs.indexOf(inputEl);
        if (index > -1 && index < inputs.length - 1) {
          e.preventDefault();
          inputs[index + 1].focus();
        }
      }
    } else if (e.key === '-' || e.key === 'Minus') {
      e.preventDefault();
      inputEl._rawATMValue = -inputEl._rawATMValue;
      inputEl.value = (inputEl._rawATMValue < 0 ? '-' : '') + format(Math.abs(inputEl._rawATMValue));
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (/^\d$/.test(e.key)) {
      e.preventDefault();
      if (raw.toString().length < 10) {
        raw = raw * 10 + parseInt(e.key, 10);
        inputEl._rawATMValue = isNegative ? -raw : raw;
        inputEl.value = (inputEl._rawATMValue < 0 ? '-' : '') + format(raw);
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (['ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'].includes(e.key)) {
      // Allow
    } else {
      e.preventDefault();
    }
  });
}

// ==========================================================================
// Form Submission & Validation Logic
// ==========================================================================
function bindForms() {
  document.querySelectorAll('input[type="date"]').forEach(input => {
    input.addEventListener('click', () => {
      if (typeof input.showPicker === 'function') {
        try {
          input.showPicker();
        } catch (e) {
          console.error(e);
        }
      }
    });
  });

  document.querySelectorAll('.amount-field').forEach(input => {
    bindATMInput(input);
  });

  document.querySelectorAll('.btn-discard, .close-drawer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // If closing settings drawer, bypass confirmation and close instantly
      if (btn.closest('#drawer-settings')) {
        closeFormDrawer();
        return;
      }
      
      showConfirmModal(
        "Discard In-Progress Entry?",
        "Are you sure you want to cancel? Any unsaved edits will be deleted.",
        () => {
          closeFormDrawer();
        }
      );
    });
  });

  document.getElementById('btn-save-expense').addEventListener('click', () => submitExpenseForm(true));
  document.getElementById('btn-save-new-expense').addEventListener('click', () => submitExpenseForm(false));

  document.getElementById('btn-save-income').addEventListener('click', () => submitIncomeForm(true));
  document.getElementById('btn-save-new-income').addEventListener('click', () => submitIncomeForm(false));

  const incSourceSelect = document.getElementById('inc-source-select');
  const incSourceInput = document.getElementById('inc-source');
  const incSourceNewContainer = document.getElementById('inc-source-new-container');
  if (incSourceSelect && incSourceInput && incSourceNewContainer) {
    incSourceSelect.addEventListener('change', () => {
      if (incSourceSelect.value === '__NEW__') {
        incSourceNewContainer.style.display = 'block';
        incSourceInput.value = '';
        incSourceInput.setAttribute('required', 'true');
        incSourceInput.focus();
      } else {
        incSourceNewContainer.style.display = 'none';
        incSourceInput.value = incSourceSelect.value;
        incSourceInput.removeAttribute('required');
      }
    });
  }

  document.getElementById('btn-save-savings').addEventListener('click', () => submitSavingsForm());

  const savModalClose = document.getElementById('sav-transfer-modal-close');
  if (savModalClose) {
    savModalClose.addEventListener('click', () => {
      document.getElementById('sav-transfer-modal-backdrop').classList.remove('active');
    });
  }

  const savModalSave = document.getElementById('sav-transfer-modal-save');
  if (savModalSave) {
    savModalSave.addEventListener('click', () => submitSavingsTransferEdit());
  }

  const savModalDelete = document.getElementById('sav-transfer-modal-delete');
  if (savModalDelete) {
    savModalDelete.addEventListener('click', () => deleteSavingsTransfer());
  }

  document.getElementById('btn-save-debt').addEventListener('click', () => submitDebtForm());

  document.getElementById('btn-save-settle').addEventListener('click', () => submitSettleForm());

  document.getElementById('btn-wizard-prev').addEventListener('click', () => {
    if (currentWizardStep > 1) {
      currentWizardStep--;
      renderActiveWizardStep();
    }
  });

  document.getElementById('btn-wizard-update').addEventListener('click', async () => {
    if (currentWizardStep === 2) {
      const input = document.getElementById('wizard-savings-goal-input');
      if (input) wizardState.savingsGoal = parseFloat(input.value.replace(/[^0-9.]/g, '')) || 0;
    } else if (currentWizardStep === 3) {
      const input = document.getElementById('wizard-income-goal-input');
      if (input) wizardState.incomeGoal = parseFloat(input.value.replace(/[^0-9.]/g, '')) || 0;
    }
    await saveWizardPlan();
  });

  document.getElementById('btn-wizard-next').addEventListener('click', async () => {
    if (currentWizardStep < 4) {
      // Cache current inputs before proceeding
      if (currentWizardStep === 2) {
        const input = document.getElementById('wizard-savings-goal-input');
        if (input) wizardState.savingsGoal = parseFloat(input.value.replace(/[^0-9.]/g, '')) || 0;
      } else if (currentWizardStep === 3) {
        const input = document.getElementById('wizard-income-goal-input');
        if (input) wizardState.incomeGoal = parseFloat(input.value.replace(/[^0-9.]/g, '')) || 0;
      }
      currentWizardStep++;
      renderActiveWizardStep();
    } else {
      await saveWizardPlan();
    }
  });

  document.getElementById('btn-wizard-cancel').addEventListener('click', () => {
    showConfirmModal(
      "Exit Month Plan Wizard?",
      "Are you sure? Draft budget targets and goals will be discarded.",
      () => {
        resetWizardState();
        navigateTo('dashboard');
      }
    );
  });

  document.querySelectorAll('#analytics-segment-bar .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#analytics-segment-bar .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderAnalyticsView();
    });
  });

  const durationSelect = document.getElementById('analytics-duration-picker');
  if (durationSelect) {
    durationSelect.addEventListener('change', () => renderAnalyticsView());
  }
}

function validateFormFields(formEl) {
  let isValid = true;
  
  formEl.querySelectorAll('.form-input').forEach(input => {
    input.classList.remove('error');
    const existingErr = input.parentNode.querySelector('.error-label');
    if (existingErr) existingErr.remove();

    if (input.hasAttribute('required') && (!input.value || input.value.trim() === "" || input.value === "0.00")) {
      isValid = false;
      input.classList.add('error');
      
      const errLbl = document.createElement('span');
      errLbl.className = 'error-label';
      errLbl.textContent = input.getAttribute('placeholder') ? `${input.getAttribute('placeholder')} field is required.` : "Required input missing.";
      input.parentNode.appendChild(errLbl);
    }
  });

  if (!isValid) {
    if (navigator.vibrate) navigator.vibrate(100);
  }
  return isValid;
}

async function submitExpenseForm(closeAfterSave) {
  const form = document.getElementById('drawer-expense');
  if (!validateFormFields(form)) return;

  const date = document.getElementById('exp-date').value;
  const group = document.getElementById('exp-group').value;
  const subgroup = document.getElementById('exp-subgroup').value;
  const amount = parseFloat(document.getElementById('exp-amount').value) || 0;
  const description = document.getElementById('exp-desc').value;
  const drainSelect = document.getElementById('exp-drain-savings');
  const savingsAccountId = drainSelect ? drainSelect.value : "";

  // Get current balances to simulate check
  const allHistoricalIn = (await db.getIncome()).reduce((sum, i) => sum + i.amount, 0);
  const allHistoricalOut = (await db.getTransactions()).reduce((sum, t) => sum + t.amount, 0);
  const savingsAllocations = await db.getSavingsAccounts();
  const allHistoricalSavings = savingsAllocations.reduce((sum, s) => sum + s.amount_added, 0);
  const currentLiquidCash = allHistoricalIn - allHistoricalOut - allHistoricalSavings;

  const oldT = state.editingTransactionId ? (await db.getTransactions()).find(x => x.id === state.editingTransactionId) : null;

  // Overdraft checks
  if (savingsAccountId) {
    const targetAccAllocations = savingsAllocations.filter(s => s.account_id === savingsAccountId);
    const currentSavingsBal = targetAccAllocations.reduce((sum, s) => sum + s.amount_added, 0);
    const simulatedSavingsBal = currentSavingsBal + (oldT && oldT.savings_account_id === savingsAccountId ? oldT.amount : 0) - amount;

    if (simulatedSavingsBal < 0) {
      const targetAccName = targetAccAllocations[0] ? targetAccAllocations[0].account_name : savingsAccountId;
      showWarningModal(
        "Insufficient Savings Funds",
        `The savings account "${targetAccName}" only has ${window.formatCurrency(currentSavingsBal + (oldT && oldT.savings_account_id === savingsAccountId ? oldT.amount : 0))} available, but this transaction requires ${window.formatCurrency(amount)}.`
      );
      return;
    }
  } else {
    const simulatedCash = currentLiquidCash + (oldT && !oldT.savings_account_id ? oldT.amount : 0) - amount;
    if (simulatedCash < 0) {
      showWarningModal(
        "Insufficient Cash Balance",
        `You cannot have a negative cash balance. Your current cash balance is ${window.formatCurrency(currentLiquidCash + (oldT && !oldT.savings_account_id ? oldT.amount : 0))}, but this transaction requires ${window.formatCurrency(amount)}.`
      );
      return;
    }
  }

  const id = state.editingTransactionId || window.generateUUID();
  const t = { id, date, group, subgroup, amount, description, savings_account_id: savingsAccountId };

  if (state.editingTransactionId) {
    await db.updateTransaction(t);
  } else {
    await db.addTransaction(t);
  }

  // Handle savings allocations
  if (savingsAccountId) {
    const accounts = await db.getSavingsAccounts();
    const targetAcc = accounts.find(a => a.account_id === savingsAccountId);
    const allocation = {
      account_id: savingsAccountId,
      account_name: targetAcc ? targetAcc.account_name : "",
      target_amount: targetAcc ? targetAcc.target_amount : null,
      target_date: targetAcc ? targetAcc.target_date : null,
      date_logged: date,
      amount_added: -amount,
      ref_id: id
    };
    await db.upsertSavingsAllocationByRef(allocation);
  } else {
    await db.deleteSavingsAllocationByRef(id);
  }

  if (state.editingTransactionId) {
    state.editingTransactionId = null;
    state.editingTransactionType = null;
    triggerSuccessAnimation("Expense Updated Successfully", 'ledger');
  } else if (closeAfterSave) {
    triggerSuccessAnimation("Expense Logged Successfully", 'ledger');
  } else {
    // Success notice + Reset inputs, keep drawer open
    triggerSuccessAnimation("Expense Logged", null, true);
    
    const today = window.getLocalYYYYMMDD();
    form.querySelectorAll('input:not([type="hidden"]), select').forEach(control => {
      if (control.type === 'checkbox') {
        control.checked = false;
      } else if (control.classList.contains('amount-field')) {
        control.value = '0.00';
        control._rawATMValue = 0;
      } else if (control.tagName === 'SELECT') {
        control.selectedIndex = 0;
      } else if (control.type === 'date') {
        control.value = today;
      } else {
        control.value = '';
      }
    });

    // Reset subgroup select list
    document.getElementById('exp-subgroup').innerHTML = '<option value="">-- Select Subgroup --</option>';
    
    setTimeout(() => {
      form.querySelector('#exp-amount').focus();
    }, 1400);
  }
}

async function submitIncomeForm(closeAfterSave) {
  const form = document.getElementById('drawer-income');
  if (!validateFormFields(form)) return;

  const date = document.getElementById('inc-date').value;
  const sourceRaw = document.getElementById('inc-source').value.trim();
  const amount = parseFloat(document.getElementById('inc-amount').value) || 0;
  const description = document.getElementById('inc-desc').value;
  const tithable = document.getElementById('inc-tithable').checked;

  const knownSources = state.taxonomy["Income"] || [];
  const sourceLower = sourceRaw.toLowerCase();
  const matchesKnown = knownSources.some(s => s.toLowerCase() === sourceLower);

  const saveAction = async (finalSource) => {
    const id = state.editingTransactionId || window.generateUUID();
    const inc = { id, date, source: finalSource, amount, description, tithable };
    
    if (state.editingTransactionId) {
      await db.updateIncome(inc);
    } else {
      await db.addIncome(inc);
    }

    if (state.editingTransactionId) {
      state.editingTransactionId = null;
      state.editingTransactionType = null;
      triggerSuccessAnimation("Income Updated", 'ledger');
    } else if (closeAfterSave) {
      triggerSuccessAnimation("Income Recorded", 'debts');
    } else {
      triggerSuccessAnimation("Income Recorded", null, true);
      
      const today = window.getLocalYYYYMMDD();
      form.querySelectorAll('input:not([type="hidden"]), select').forEach(control => {
        if (control.type === 'checkbox') {
          control.checked = false;
        } else if (control.classList.contains('amount-field')) {
          control.value = '0.00';
          if (control._rawATMValue !== undefined) control._rawATMValue = 0;
        } else if (control.tagName === 'SELECT') {
          control.selectedIndex = 0;
        } else if (control.type === 'date') {
          control.value = today;
        } else {
          control.value = '';
        }
      });

      const newContainer = document.getElementById('inc-source-new-container');
      if (newContainer) newContainer.style.display = 'none';
      const sourceInput = document.getElementById('inc-source');
      if (sourceInput) sourceInput.removeAttribute('required');
      
      setTimeout(() => {
        const selectEl = form.querySelector('#inc-source-select');
        if (selectEl) {
          selectEl.focus();
        } else {
          form.querySelector('#inc-source').focus();
        }
      }, 1400);
    }
  };

  if (!matchesKnown && sourceRaw !== "") {
    showConfirmModal(
      "Unrecognized Income Source",
      `Would you like to add "${sourceRaw}" to your permanent source configuration list?`,
      async () => {
        await db.addIncomeSourceToTaxonomy(sourceRaw);
        await refreshApplicationData();
        await saveAction(sourceRaw);
      },
      async () => {
        await saveAction(sourceRaw);
      }
    );
  } else {
    await saveAction(sourceRaw);
  }
}

async function submitSavingsForm() {
  const form = document.getElementById('drawer-savings');
  if (!validateFormFields(form)) return;

  const name = document.getElementById('sav-name').value.trim();
  const targetVal = parseFloat(document.getElementById('sav-target').value) || null;
  const targetDate = document.getElementById('sav-deadline').value || null;
  const initialAlloc = parseFloat(document.getElementById('sav-amount').value) || 0;

  // Overdraft check
  if (initialAlloc > 0) {
    const allHistoricalIn = (await db.getIncome()).reduce((sum, i) => sum + i.amount, 0);
    const allHistoricalOut = (await db.getTransactions()).reduce((sum, t) => sum + t.amount, 0);
    const savingsAllocations = await db.getSavingsAccounts();
    const allHistoricalSavings = savingsAllocations.reduce((sum, s) => sum + s.amount_added, 0);
    const currentLiquidCash = allHistoricalIn - allHistoricalOut - allHistoricalSavings;

    if (initialAlloc > currentLiquidCash) {
      showWarningModal(
        "Insufficient Cash Balance",
        `You cannot have a negative cash balance. You only have ${window.formatCurrency(currentLiquidCash)} of Liquid Cash available for the initial deposit.`
      );
      return;
    }
  }

  const slug = name.toLowerCase().replace(/\s+/g, '_');
  const date = window.getLocalYYYYMMDD();

  const allocation = {
    account_id: slug,
    account_name: name,
    target_amount: targetVal,
    target_date: targetDate,
    date_logged: date,
    amount_added: initialAlloc
  };

  await db.addSavingsAllocation(allocation);
  triggerSuccessAnimation("Savings Account Created", 'savings');
}

async function submitDebtForm() {
  const form = document.getElementById('drawer-debt');
  if (!validateFormFields(form)) return;

  const type = document.getElementById('debt-type').value;
  const desc = document.getElementById('debt-desc').value.trim();
  const total = parseFloat(document.getElementById('debt-amount').value) || 0;
  const date = document.getElementById('debt-date').value;

  const id = state.editingDebtId || window.generateUUID();
  const debt = {
    id,
    type,
    description: desc,
    total_amount: total,
    date_logged: date
  };

  if (state.editingDebtId) {
    await db.updateDebt(debt);
    state.editingDebtId = null;
    triggerSuccessAnimation("Debt Entry Updated", 'debts');
  } else {
    await db.addDebt(debt);
    triggerSuccessAnimation("Debt Entry Added", 'debts');
  }
}

async function submitSettleForm() {
  try {
    const form = document.getElementById('drawer-settle');
    if (!validateFormFields(form)) return;

    const id = document.getElementById('settle-debt-id').value;
    const amount = parseFloat(document.getElementById('settle-amount').value) || 0;
    const date = window.getLocalYYYYMMDD();

    const debts = await db.getDebts();
    let d = debts.find(x => x.id === id);
    if (!d && id) {
      d = debts.find(x => x.description.trim().toLowerCase() === id.trim().toLowerCase());
    }
    if (!d && id) {
      d = debts.find(x => x.id === id || x.description === id);
    }

    if (d && d.type === 'Payable') {
      const allHistoricalIn = (await db.getIncome()).reduce((sum, i) => sum + i.amount, 0);
      const allHistoricalOut = (await db.getTransactions()).reduce((sum, t) => sum + t.amount, 0);
      const savingsAllocations = await db.getSavingsAccounts();
      const allHistoricalSavings = savingsAllocations.reduce((sum, s) => sum + s.amount_added, 0);
      const currentLiquidCash = allHistoricalIn - allHistoricalOut - allHistoricalSavings;

      if (amount > currentLiquidCash) {
        showWarningModal(
          "Insufficient Cash Balance",
          `You cannot have a negative cash balance. You need ${window.formatCurrency(amount)} to settle this liability, but your current cash balance is only ${window.formatCurrency(currentLiquidCash)}.`
        );
        return;
      }
    }

    await db.settleDebt(id, amount, date);
    triggerSuccessAnimation("Debt Settle Logged", 'debts');
  } catch (err) {
    alert("Settlement Submission Error: " + err.message);
  }
}

// ==========================================================================
// Animation & Alert Helper States
// ==========================================================================

function triggerSuccessAnimation(message, targetView = null, keepDrawerOpen = false) {
  window.playSuccessChime();

  const overlay = document.getElementById('success-overlay');
  document.getElementById('success-text-lbl').textContent = message;
  
  overlay.classList.add('active');
  if (!keepDrawerOpen) {
    closeFormDrawer();
  }

  setTimeout(() => {
    overlay.classList.remove('active');
    
    refreshApplicationData().then(() => {
      if (targetView) navigateTo(targetView);
    });
  }, 1300);
}

function showConfirmModal(title, desc, onConfirm, onCancel = null) {
  const backdrop = document.getElementById('modal-backdrop');
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-desc').textContent = desc;

  const btnYes = document.getElementById('confirm-modal-yes');
  const btnNo = document.getElementById('confirm-modal-no');

  const newYes = btnYes.cloneNode(true);
  const newNo = btnNo.cloneNode(true);

  btnYes.parentNode.replaceChild(newYes, btnYes);
  btnNo.parentNode.replaceChild(newNo, btnNo);

  // Reset text and display states in case a warning modal modified them
  newYes.textContent = "Confirm";
  newYes.style.display = "";
  newNo.textContent = "Cancel";
  newNo.style.display = "";

  newYes.addEventListener('click', () => {
    backdrop.classList.remove('active');
    if (onConfirm) onConfirm();
  });

  newNo.addEventListener('click', () => {
    backdrop.classList.remove('active');
    if (onCancel) onCancel();
  });

  backdrop.classList.add('active');
}

function showWarningModal(title, desc) {
  const backdrop = document.getElementById('modal-backdrop');
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-desc').textContent = desc;

  const btnYes = document.getElementById('confirm-modal-yes');
  const btnNo = document.getElementById('confirm-modal-no');

  const newYes = btnYes.cloneNode(true);
  const newNo = btnNo.cloneNode(true);

  btnYes.parentNode.replaceChild(newYes, btnYes);
  btnNo.parentNode.replaceChild(newNo, btnNo);

  newYes.textContent = "OK";
  newNo.style.display = "none";

  newYes.addEventListener('click', () => {
    backdrop.classList.remove('active');
    newNo.style.display = "";
    newYes.textContent = "Confirm";
  });

  backdrop.classList.add('active');
}

function showPopover(title, text) {
  const popover = document.getElementById('popover-container');
  document.getElementById('popover-title-lbl').textContent = title;
  document.getElementById('popover-body-lbl').textContent = text;
  
  popover.classList.add('active');
  
  popover.addEventListener('click', (e) => {
    if (!e.target.closest('.popover-card')) {
      popover.classList.remove('active');
    }
  }, { once: true });
}

async function showTransactionDetails(t) {
  const backdrop = document.getElementById('details-modal-backdrop');
  
  document.getElementById('details-date').textContent = window.formatDate(t.date);
  
  const typeBadge = document.getElementById('details-type-badge');
  const catLabel = document.getElementById('details-category-label');
  const subgroupLabel = document.getElementById('details-subgroup-label');
  const subgroupVal = document.getElementById('details-subgroup');
  const amountVal = document.getElementById('details-amount');
  const fundLabel = document.getElementById('details-fund-label');
  const fundVal = document.getElementById('details-fund');
  
  if (t.type === 'expense') {
    typeBadge.textContent = "Expense";
    typeBadge.style.backgroundColor = "var(--color-alert)";
    
    catLabel.textContent = "Category:";
    document.getElementById('details-category').textContent = t.group;
    
    subgroupLabel.style.display = 'inline';
    subgroupVal.style.display = 'inline';
    subgroupVal.textContent = t.subgroup;
    
    amountVal.className = "tabular-nums amount-negative";
    amountVal.textContent = `-${window.formatCurrency(t.amount)}`;
    
    if (t.savings_account_id && t.savings_account_id !== "") {
      fundLabel.style.display = 'inline';
      fundVal.style.display = 'inline';
      const accounts = await db.getSavingsAccounts();
      const acc = accounts.find(a => a.account_id === t.savings_account_id);
      fundVal.textContent = acc ? acc.account_name : t.savings_account_id;
    } else {
      fundLabel.style.display = 'none';
      fundVal.style.display = 'none';
    }
  } else {
    typeBadge.textContent = "Income";
    typeBadge.style.backgroundColor = "var(--color-success)";
    
    catLabel.textContent = "Source:";
    document.getElementById('details-category').textContent = t.subgroup;
    
    subgroupLabel.style.display = 'none';
    subgroupVal.style.display = 'none';
    
    amountVal.className = "tabular-nums";
    amountVal.textContent = `+${window.formatCurrency(t.amount)}`;
    
    fundLabel.style.display = 'none';
    fundVal.style.display = 'none';
  }
  
  document.getElementById('details-note').textContent = t.description && t.description.trim() !== "" ? t.description : "None";
  
  // Bind Edit
  const editBtn = document.getElementById('details-modal-edit');
  const newEditBtn = editBtn.cloneNode(true);
  editBtn.parentNode.replaceChild(newEditBtn, editBtn);
  newEditBtn.addEventListener('click', () => {
    backdrop.classList.remove('active');
    openEditDrawer(t);
  });
  
  // Bind Delete
  const deleteBtn = document.getElementById('details-modal-delete');
  const newDeleteBtn = deleteBtn.cloneNode(true);
  deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
  newDeleteBtn.addEventListener('click', () => {
    if (!db.isGoogleConnected()) {
      showConfirmModal(
        "Sign In Required",
        "You are currently offline. Please sign in to your Google Account to delete entries.",
        () => {
          reauthorizeGoogleSheets();
        }
      );
      return;
    }
    showConfirmModal(
      "Delete Transaction?",
      "Are you sure you want to permanently delete this entry? This action cannot be undone.",
      async () => {
        if (t.type === 'income') {
          const allHistoricalIn = (await db.getIncome()).reduce((sum, i) => sum + i.amount, 0);
          const allHistoricalOut = (await db.getTransactions()).reduce((sum, t) => sum + t.amount, 0);
          const savingsAllocations = await db.getSavingsAccounts();
          const allHistoricalSavings = savingsAllocations.reduce((sum, s) => sum + s.amount_added, 0);
          const currentLiquidCash = allHistoricalIn - allHistoricalOut - allHistoricalSavings;

          if (t.amount > currentLiquidCash) {
            showWarningModal(
              "Cannot Delete Income",
              `Deleting this income record of ${window.formatCurrency(t.amount)} would cause your cash balance to become negative. Your current cash balance is only ${window.formatCurrency(currentLiquidCash)}.`
            );
            return;
          }
        }
        backdrop.classList.remove('active');
        if (t.type === 'expense') {
          await db.deleteTransaction(t.id);
        } else {
          await db.deleteIncome(t.id);
        }
        triggerSuccessAnimation("Entry Deleted Successfully", 'ledger');
      }
    );
  });
  
  // Bind Close
  const closeBtn = document.getElementById('details-modal-close');
  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
  newCloseBtn.addEventListener('click', () => {
    backdrop.classList.remove('active');
  });
  
  backdrop.classList.add('active');
}

function openEditDrawer(t) {
  if (!db.isGoogleConnected()) {
    showConfirmModal(
      "Sign In Required",
      "You are currently offline. Please sign in to your Google Account to edit transactions.",
      () => {
        reauthorizeGoogleSheets();
      }
    );
    return;
  }

  state.editingTransactionId = t.id;
  state.editingTransactionType = t.type;
  
  const formContainer = document.getElementById('form-overlay-container');
  const drawers = document.querySelectorAll('.form-drawer');
  drawers.forEach(d => d.style.display = 'none');
  
  if (t.type === 'expense') {
    const drawer = document.getElementById('drawer-expense');
    drawer.querySelector('.drawer-title').textContent = "Edit Expense Allocation";
    
    document.getElementById('exp-date').value = t.date;
    
    // Set group and subgroups
    const groupSelect = document.getElementById('exp-group');
    prefillExpenseCategories();
    groupSelect.value = t.group;
    
    // Manually trigger populating subgroup options
    const subSelect = document.getElementById('exp-subgroup');
    subSelect.innerHTML = '<option value="">-- Select Subgroup --</option>';
    if (t.group && state.taxonomy[t.group]) {
      state.taxonomy[t.group].forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        subSelect.appendChild(opt);
      });
    }
    subSelect.value = t.subgroup;
    
    // Set Fund Source select
    const drainSelect = document.getElementById('exp-drain-savings');
    populateDrainSavingsDropdown(drainSelect, t.savings_account_id || "");

    // Set Amount
    const amountInput = document.getElementById('exp-amount');
    amountInput.value = t.amount.toFixed(2);
    amountInput.dispatchEvent(new Event('amountset'));
    
    // Set Note
    document.getElementById('exp-desc').value = t.description || "";
    
    // UI Tweaks
    const btnSaveNewExp = document.getElementById('btn-save-new-expense');
    if (btnSaveNewExp) btnSaveNewExp.style.display = 'none';
    const btnSaveExp = document.getElementById('btn-save-expense');
    if (btnSaveExp) btnSaveExp.textContent = "Update & Exit";
    
    drawer.style.display = 'flex';
  } else {
    const drawer = document.getElementById('drawer-income');
    drawer.querySelector('.drawer-title').textContent = "Edit Asset Inflow";
    
    document.getElementById('inc-date').value = t.date;
    const sourceVal = t.subgroup; // source
    document.getElementById('inc-source').value = sourceVal;
    
    // Set Dropdown Select Value
    const selectEl = document.getElementById('inc-source-select');
    const newContainer = document.getElementById('inc-source-new-container');
    if (selectEl) {
      populateIncomeSourceDropdown(selectEl, sourceVal);
      if (selectEl.value === '__NEW__') {
        if (newContainer) newContainer.style.display = 'block';
        document.getElementById('inc-source').setAttribute('required', 'true');
      } else {
        if (newContainer) newContainer.style.display = 'none';
        document.getElementById('inc-source').removeAttribute('required');
      }
    }
    
    // Set Amount
    const amountInput = document.getElementById('inc-amount');
    amountInput.value = t.amount.toFixed(2);
    amountInput.dispatchEvent(new Event('amountset'));
    
    // Set Note
    document.getElementById('inc-desc').value = t.description || "";
    
    // Set Tithable
    document.getElementById('inc-tithable').checked = t.tithable || false;
    
    // UI Tweaks
    const btnSaveNewInc = document.getElementById('btn-save-new-income');
    if (btnSaveNewInc) btnSaveNewInc.style.display = 'none';
    const btnSaveInc = document.getElementById('btn-save-income');
    if (btnSaveInc) btnSaveInc.textContent = "Update & Exit";
    
    drawer.style.display = 'flex';
  }
  
  formContainer.classList.add('active');
}

async function showDebtDetails(d) {
  const backdrop = document.getElementById('details-modal-backdrop');
  
  document.getElementById('details-date').textContent = window.formatDate(d.date_logged);
  
  const typeBadge = document.getElementById('details-type-badge');
  const catLabel = document.getElementById('details-category-label');
  const subgroupLabel = document.getElementById('details-subgroup-label');
  const subgroupVal = document.getElementById('details-subgroup');
  const amountVal = document.getElementById('details-amount');
  const fundLabel = document.getElementById('details-fund-label');
  const fundVal = document.getElementById('details-fund');
  
  typeBadge.textContent = d.type;
  if (d.type === 'Payable') {
    typeBadge.style.backgroundColor = "var(--color-alert)";
    amountVal.className = "tabular-nums amount-negative";
    amountVal.textContent = `-${window.formatCurrency(d.total_amount)}`;
  } else {
    typeBadge.style.backgroundColor = "var(--color-success)";
    amountVal.className = "tabular-nums";
    amountVal.textContent = `+${window.formatCurrency(d.total_amount)}`;
  }
  
  catLabel.textContent = "Description:";
  document.getElementById('details-category').textContent = d.description;
  
  subgroupLabel.style.display = 'none';
  subgroupVal.style.display = 'none';
  
  fundLabel.style.display = 'none';
  fundVal.style.display = 'none';
  
  document.getElementById('details-note').textContent = "None";
  
  // Bind Edit
  const editBtn = document.getElementById('details-modal-edit');
  const newEditBtn = editBtn.cloneNode(true);
  editBtn.parentNode.replaceChild(newEditBtn, editBtn);
  newEditBtn.addEventListener('click', () => {
    backdrop.classList.remove('active');
    openEditDebtDrawer(d);
  });
  
  // Bind Delete
  const deleteBtn = document.getElementById('details-modal-delete');
  const newDeleteBtn = deleteBtn.cloneNode(true);
  deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
  newDeleteBtn.addEventListener('click', () => {
    if (!db.isGoogleConnected()) {
      showConfirmModal(
        "Sign In Required",
        "You are currently offline. Please sign in to your Google Account to delete entries.",
        () => {
          reauthorizeGoogleSheets();
        }
      );
      return;
    }
    showConfirmModal(
      "Delete Debt Entry?",
      "Are you sure you want to permanently delete this entry? This action cannot be undone.",
      async () => {
        backdrop.classList.remove('active');
        await db.deleteDebt(d.id);
        triggerSuccessAnimation("Debt Entry Deleted", 'debts');
      }
    );
  });
  
  // Bind Close
  const closeBtn = document.getElementById('details-modal-close');
  const newCloseBtn = closeBtn.cloneNode(true);
  closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
  newCloseBtn.addEventListener('click', () => {
    backdrop.classList.remove('active');
  });
  
  backdrop.classList.add('active');
}

function openEditDebtDrawer(d) {
  if (!db.isGoogleConnected()) {
    showConfirmModal(
      "Sign In Required",
      "You are currently offline. Please sign in to your Google Account to edit debt entries.",
      () => {
        reauthorizeGoogleSheets();
      }
    );
    return;
  }

  state.editingDebtId = d.id;
  
  const formContainer = document.getElementById('form-overlay-container');
  const drawers = document.querySelectorAll('.form-drawer');
  drawers.forEach(drawer => drawer.style.display = 'none');
  
  const drawer = document.getElementById('drawer-debt');
  drawer.querySelector('.drawer-title').textContent = "Edit Liability or Claim";
  
  document.getElementById('debt-type').value = d.type;
  document.getElementById('debt-desc').value = d.description;
  
  // Set Amount
  const amountInput = document.getElementById('debt-amount');
  amountInput.value = d.total_amount.toFixed(2);
  amountInput.dispatchEvent(new Event('amountset'));
  
  document.getElementById('debt-date').value = d.date_logged;
  
  // UI Tweaks
  const btnSaveDebt = document.getElementById('btn-save-debt');
  if (btnSaveDebt) btnSaveDebt.textContent = "Update & Exit";
  
  drawer.style.display = 'flex';
  formContainer.classList.add('active');
}

async function populateDrainSavingsDropdown(selectEl, selectedId = "") {
  selectEl.innerHTML = '<option value="">-- None (Deduct from Free Cash) --</option>';
  const accounts = await db.getSavingsAccounts();
  const uniqueAccounts = [];
  const addedIds = new Set();
  accounts.forEach(a => {
    if (!addedIds.has(a.account_id)) {
      addedIds.add(a.account_id);
      uniqueAccounts.push(a);
    }
  });
  
  uniqueAccounts.forEach(acc => {
    const opt = document.createElement('option');
    opt.value = acc.account_id;
    opt.textContent = acc.account_name;
    if (acc.account_id === selectedId) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });
}

function populateIncomeSourceDropdown(selectEl, selectedValue = "") {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="" disabled selected>-- Select Source --</option>';
  
  const sources = state.taxonomy["Income"] || [
    "Black Bear Sprinkler Repair",
    "BYU Research",
    "BYU TA",
    "Piano Tuning",
    "Loan",
    "Scholarship",
    "Gift",
    "Help"
  ];
  
  const exists = sources.includes(selectedValue);
  sources.forEach(source => {
    const opt = document.createElement('option');
    opt.value = source;
    opt.textContent = source;
    if (selectedValue && source === selectedValue) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });
  
  const otherOpt = document.createElement('option');
  otherOpt.value = "__NEW__";
  otherOpt.textContent = "Other / Add New Source...";
  if (selectedValue && !exists) {
    otherOpt.selected = true;
  }
  selectEl.appendChild(otherOpt);
}


async function adjustSavingsAccountFunds(accId, direction) {
  if (!db.isGoogleConnected()) {
    showConfirmModal(
      "Sign In Required",
      "You are currently offline. Please sign in to your Google Account to adjust savings allocations.",
      () => {
        reauthorizeGoogleSheets();
      }
    );
    return;
  }

  const amountEl = document.getElementById(`savings-adj-amount-${accId}`);
  if (!amountEl) return;
  
  const amount = parseFloat(amountEl.value) || 0;
  
  if (amount <= 0) {
    alert("Please enter a valid transfer amount.");
    return;
  }
  
  const accounts = await db.getSavingsAccounts();
  const accAllocations = accounts.filter(a => a.account_id === accId);
  if (accAllocations.length === 0) return;
  
  const metadata = accAllocations[0];

  const allHistoricalIn = (await db.getIncome()).reduce((sum, i) => sum + i.amount, 0);
  const allHistoricalOut = (await db.getTransactions()).reduce((sum, t) => sum + t.amount, 0);
  const allHistoricalSavings = accounts.reduce((sum, s) => sum + s.amount_added, 0);
  const currentLiquidCash = allHistoricalIn - allHistoricalOut - allHistoricalSavings;
  
  if (direction === 'add') {
    if (amount > currentLiquidCash) {
      showWarningModal(
        "Insufficient Cash Balance",
        `You cannot have a negative cash balance. You only have ${window.formatCurrency(currentLiquidCash)} of Liquid Cash available to transfer to ${metadata.account_name}.`
      );
      return;
    }
  } else if (direction === 'remove') {
    // Check balance
    const currentBalance = accAllocations.reduce((sum, a) => sum + a.amount_added, 0);
    if (amount > currentBalance) {
      showWarningModal(
        "Insufficient Savings Funds",
        `The savings account "${metadata.account_name}" only has ${window.formatCurrency(currentBalance)} available, but you are trying to remove ${window.formatCurrency(amount)}.`
      );
      return;
    }
  }
  
  const signedAmount = direction === 'add' ? amount : -amount;
  const date = window.getLocalYYYYMMDD();
  
  const allocation = {
    account_id: accId,
    account_name: metadata.account_name,
    target_amount: metadata.target_amount,
    target_date: metadata.target_date,
    date_logged: date,
    amount_added: signedAmount,
    ref_id: "savings_adj_" + window.generateUUID()
  };
  
  await db.addSavingsAllocation(allocation);
  
  const successMsg = direction === 'add' 
    ? `Added ${window.formatCurrency(amount)} to ${metadata.account_name}`
    : `Removed ${window.formatCurrency(amount)} from ${metadata.account_name}`;
    
  triggerSuccessAnimation(successMsg, 'savings');
}
window.adjustSavingsAccountFunds = adjustSavingsAccountFunds;

async function updateSavingsGoalTarget(accId) {
  if (!db.isGoogleConnected()) {
    showConfirmModal(
      "Sign In Required",
      "You are currently offline. Please sign in to your Google Account to update savings goal targets.",
      () => {
        reauthorizeGoogleSheets();
      }
    );
    return;
  }

  const amountEl = document.getElementById(`savings-goal-amount-${accId}`);
  const dateEl = document.getElementById(`savings-goal-date-${accId}`);
  if (!amountEl || !dateEl) return;

  const targetAmount = parseFloat(amountEl.value) || null;
  const targetDate = dateEl.value || null;

  await db.updateSavingsAccountTargets(accId, targetAmount, targetDate);
  triggerSuccessAnimation("Savings Goal Target Updated", 'savings');
}
window.updateSavingsGoalTarget = updateSavingsGoalTarget;

async function deleteSavingsAccount(accId) {
  if (!db.isGoogleConnected()) {
    showConfirmModal(
      "Sign In Required",
      "You are currently offline. Please sign in to your Google Account to delete savings accounts.",
      () => {
        reauthorizeGoogleSheets();
      }
    );
    return;
  }

  const accounts = await db.getSavingsAccounts();
  const accAllocations = accounts.filter(a => a.account_id === accId);
  if (accAllocations.length === 0) return;
  
  const metadata = accAllocations[0];
  const balance = accAllocations.reduce((sum, a) => sum + a.amount_added, 0);
  
  const balanceMsg = balance > 0 
    ? ` This will refund its balance of ${window.formatCurrency(balance)} back to Free Cash.` 
    : "";

  showConfirmModal(
    "Delete Savings Account?",
    `Are you sure you want to permanently delete the savings account "${metadata.account_name}"?${balanceMsg} This action cannot be undone.`,
    async () => {
      await db.deleteSavingsAccount(accId);
      triggerSuccessAnimation("Savings Account Deleted", 'savings');
    }
  );
}
window.deleteSavingsAccount = deleteSavingsAccount;

async function showSavingsTransferDetails(allocation) {
  if (!db.isGoogleConnected()) {
    showConfirmModal(
      "Sign In Required",
      "You are currently offline. Please sign in to your Google Account to manage transfer entries.",
      () => {
        reauthorizeGoogleSheets();
      }
    );
    return;
  }

  const backdrop = document.getElementById('sav-transfer-modal-backdrop');
  if (!backdrop) return;

  const refIdInput = document.getElementById('sav-transfer-ref-id');
  const accIdInput = document.getElementById('sav-transfer-account-id');
  const dateInput = document.getElementById('sav-transfer-date');
  const amountInput = document.getElementById('sav-transfer-amount');
  const badge = document.getElementById('sav-transfer-type-badge');

  if (refIdInput) refIdInput.value = allocation.ref_id || '';
  if (accIdInput) accIdInput.value = allocation.account_id || '';
  if (dateInput) dateInput.value = allocation.date_logged || '';
  if (amountInput) {
    amountInput.value = allocation.amount_added.toFixed(2);
    amountInput.dispatchEvent(new Event('amountset'));
  }

  if (badge) {
    if (allocation.amount_added >= 0) {
      badge.textContent = "Deposit";
      badge.style.backgroundColor = "var(--color-success)";
    } else {
      badge.textContent = "Withdrawal";
      badge.style.backgroundColor = "var(--color-alert)";
    }
  }

  // Ensure ATM input format validation runs
  if (amountInput && !amountInput._atmBound) {
    bindATMInput(amountInput);
  }

  backdrop.classList.add('active');
}
window.showSavingsTransferDetails = showSavingsTransferDetails;

async function submitSavingsTransferEdit() {
  const refId = document.getElementById('sav-transfer-ref-id').value;
  const accId = document.getElementById('sav-transfer-account-id').value;
  const date = document.getElementById('sav-transfer-date').value;
  const amountInput = document.getElementById('sav-transfer-amount');
  const amountVal = parseFloat(amountInput.value) || 0;

  if (!date) {
    alert("Please select a date.");
    return;
  }

  const allocations = await db.getSavingsAccounts();
  const oldAlloc = allocations.find(a => a.ref_id === refId);
  if (!oldAlloc) return;

  const diff = amountVal - oldAlloc.amount_added;

  // Checking Balance Overdraft Check
  const allHistoricalIn = (await db.getIncome()).reduce((sum, i) => sum + i.amount, 0);
  const allHistoricalOut = (await db.getTransactions()).reduce((sum, t) => sum + t.amount, 0);
  const allHistoricalSavings = allocations.reduce((sum, s) => sum + s.amount_added, 0);
  const currentLiquidCash = allHistoricalIn - allHistoricalOut - allHistoricalSavings;

  const simulatedCash = currentLiquidCash - diff;
  if (simulatedCash < 0) {
    showWarningModal(
      "Insufficient Cash Balance",
      `This change would cause your Liquid Cash balance to become negative (${window.formatCurrency(simulatedCash)}). You only have ${window.formatCurrency(currentLiquidCash + oldAlloc.amount_added)} available.`
    );
    return;
  }

  // Savings Account Balance Check
  const accAllocations = allocations.filter(a => a.account_id === accId);
  const currentAccBalance = accAllocations.reduce((sum, a) => sum + a.amount_added, 0);
  const simulatedAccBalance = currentAccBalance + diff;
  if (simulatedAccBalance < 0) {
    showWarningModal(
      "Insufficient Savings Funds",
      `This change would cause the savings account balance to become negative (${window.formatCurrency(simulatedAccBalance)}).`
    );
    return;
  }

  const updatedAlloc = {
    ...oldAlloc,
    date_logged: date,
    amount_added: amountVal
  };

  await db.upsertSavingsAllocationByRef(updatedAlloc);
  document.getElementById('sav-transfer-modal-backdrop').classList.remove('active');
  triggerSuccessAnimation("Allocation history updated", 'savings');
}
window.submitSavingsTransferEdit = submitSavingsTransferEdit;

async function deleteSavingsTransfer() {
  const refId = document.getElementById('sav-transfer-ref-id').value;
  const accId = document.getElementById('sav-transfer-account-id').value;

  showConfirmModal(
    "Delete Transfer Entry?",
    "Are you sure you want to permanently delete this allocation history record?",
    async () => {
      const allocations = await db.getSavingsAccounts();
      const oldAlloc = allocations.find(a => a.ref_id === refId);
      if (!oldAlloc) return;

      const diff = 0 - oldAlloc.amount_added;

      // Checking Balance Overdraft Check
      const allHistoricalIn = (await db.getIncome()).reduce((sum, i) => sum + i.amount, 0);
      const allHistoricalOut = (await db.getTransactions()).reduce((sum, t) => sum + t.amount, 0);
      const allHistoricalSavings = allocations.reduce((sum, s) => sum + s.amount_added, 0);
      const currentLiquidCash = allHistoricalIn - allHistoricalOut - allHistoricalSavings;

      const simulatedCash = currentLiquidCash - diff;
      if (simulatedCash < 0) {
        showWarningModal(
          "Insufficient Cash Balance",
          `Deleting this allocation would cause your Liquid Cash balance to become negative (${window.formatCurrency(simulatedCash)}).`
        );
        return;
      }

      // Savings Account Balance Check
      const accAllocations = allocations.filter(a => a.account_id === accId);
      const currentAccBalance = accAllocations.reduce((sum, a) => sum + a.amount_added, 0);
      const simulatedAccBalance = currentAccBalance + diff;
      if (simulatedAccBalance < 0) {
        showWarningModal(
          "Insufficient Savings Funds",
          `Deleting this allocation would cause the savings account balance to become negative (${window.formatCurrency(simulatedAccBalance)}).`
        );
        return;
      }

      await db.deleteSavingsAllocationByRef(refId);
      document.getElementById('sav-transfer-modal-backdrop').classList.remove('active');
      triggerSuccessAnimation("Allocation history deleted", 'savings');
    }
  );
}
window.deleteSavingsTransfer = deleteSavingsTransfer;

async function updateMonthlyBudgetLimit(categoryName) {
  if (!db.isGoogleConnected()) {
    showConfirmModal(
      "Sign In Required",
      "You are currently offline. Please sign in to your Google Account to update budget limits.",
      () => {
        reauthorizeGoogleSheets();
      }
    );
    return;
  }

  const cleanId = categoryName.replace(/\s+/g, '-');
  const amountEl = document.getElementById(`budget-limit-amount-${cleanId}`);
  if (!amountEl) return;

  const newLimit = parseFloat(amountEl.value) || 0;

  await db.updateMonthlyBudgetLimit(state.activeMonthYear, categoryName, newLimit);
  triggerSuccessAnimation("Budget Limit Updated", 'budget');
}
window.updateMonthlyBudgetLimit = updateMonthlyBudgetLimit;

async function setLedgerScope(scope) {
  state.ledgerTimeScope = scope;
  await renderLedgerView();
}
window.setLedgerScope = setLedgerScope;

async function setIncomeScope(scope) {
  state.incomeTimeScope = scope;
  await renderDebtsView();
}
window.setIncomeScope = setIncomeScope;

// ==========================================================================
// Settings Panel & Google OAuth2 Mappings
// ==========================================================================
function showSettingsModal() {
  const formContainer = document.getElementById('form-overlay-container');
  const drawers = document.querySelectorAll('.form-drawer');
  
  drawers.forEach(d => d.style.display = 'none');
  
  const drawer = document.getElementById('drawer-settings');
  drawer.style.display = 'flex';
  
  // Refresh settings status label
  const connectBtn = document.getElementById('btn-google-connect');
  const disconnectBtn = document.getElementById('btn-google-disconnect');
  const statusLbl = document.getElementById('google-status-lbl');
  
  const clientIdInput = document.getElementById('google-client-id-input');
  if (clientIdInput) {
    clientIdInput.value = localStorage.getItem('puf_google_client_id') || '';
  }

  if (db.isGoogleConnected()) {
    statusLbl.innerHTML = `Connected to Spreadsheet ID:<br><small style="word-break: break-all; color: var(--color-secondary-accent);">${db.spreadsheetId}</small>`;
    connectBtn.style.display = 'none';
    disconnectBtn.style.display = 'block';
  } else {
    statusLbl.textContent = "Google Account Status: Disconnected (Local Sandbox Active)";
    connectBtn.style.display = 'block';
    disconnectBtn.style.display = 'none';
  }
  
  updateLoginStatusDot();
  formContainer.classList.add('active');
}

function bindSettings() {
  const connectBtn = document.getElementById('btn-google-connect');
  const disconnectBtn = document.getElementById('btn-google-disconnect');
  const statusLbl = document.getElementById('google-status-lbl');
  
  const refreshSettingsUI = () => {
    if (db.isGoogleConnected()) {
      statusLbl.innerHTML = `Connected to Spreadsheet ID:<br><small style="word-break: break-all; color: var(--color-secondary-accent);">${db.spreadsheetId}</small>`;
      connectBtn.style.display = 'none';
      disconnectBtn.style.display = 'block';
      updateSyncIndicatorState('synced');
    } else {
      statusLbl.textContent = "Google Account Status: Disconnected (Local Sandbox Active)";
      connectBtn.style.display = 'block';
      disconnectBtn.style.display = 'none';
      updateSyncIndicatorState('local');
    }
    updateLoginStatusDot();
  };

  db.onTokenExpired = () => {
    updateSyncIndicatorState('expired');
    showWarningModal(
      "Google Sheets Offline",
      "Your Google Sheets session has expired. You are now offline. Please click the amber status badge in the header or sign in again from Settings to record transactions."
    );
  };

  // Google Client ID Save Binding
  const clientIdInput = document.getElementById('google-client-id-input');
  const saveClientIdBtn = document.getElementById('btn-save-client-id');
  
  if (clientIdInput) {
    clientIdInput.value = localStorage.getItem('puf_google_client_id') || '';
  }
  
  if (saveClientIdBtn && clientIdInput) {
    saveClientIdBtn.addEventListener('click', () => {
      const idVal = clientIdInput.value.trim();
      if (idVal === '') {
        localStorage.removeItem('puf_google_client_id');
        triggerSuccessAnimation("Client ID Cleared");
      } else {
        localStorage.setItem('puf_google_client_id', idVal);
        triggerSuccessAnimation("Client ID Saved");
      }
      initClient();
    });
  }

  // Handle header status button or sidebar status button clicks
  const handleStatusButtonClick = () => {
    showSettingsModal();
  };

  const headerLoginBtn = document.getElementById('btn-header-login-status');
  if (headerLoginBtn) {
    headerLoginBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleStatusButtonClick();
    });
  }

  const sidebarLoginBtn = document.getElementById('btn-sidebar-login-status');
  if (sidebarLoginBtn) {
    sidebarLoginBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleStatusButtonClick();
    });
  }

  let tokenClient;
  
  const initClient = () => {
    if (typeof google === 'undefined') {
      console.warn("Google API Client script not loaded yet.");
      return;
    }
    const savedClientId = localStorage.getItem('puf_google_client_id') || '831862145329-dummyid.apps.googleusercontent.com';
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: savedClientId.trim(),
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
      callback: async (response) => {
        if (response.error !== undefined) {
          alert("Authentication Failed: " + response.error);
          return;
        }
        state.googleToken = response.access_token;
        
        const sheetId = db.spreadsheetId || '1bl4XWI-D5QaXBBMQA2Rhf9kd4UT9IRtFlvdNtXxnEKI';
        db.connectGoogle(response.access_token, sheetId);
        await refreshApplicationData();
        refreshSettingsUI();
        triggerSuccessAnimation("Connected to Google Sheet");
        
        // Hide welcome screen overlay
        const welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen) {
          welcomeScreen.classList.add('hidden');
        }
      }
    });
  };

  connectBtn.addEventListener('click', () => {
    if (typeof google === 'undefined') {
      alert("Google Identity Services library is not loaded. Check your internet connection.");
      return;
    }
    initClient();
    if (tokenClient) {
      tokenClient.requestAccessToken();
    }
  });

  // Bind Welcome Screen action buttons
  const welcomeConnectBtn = document.getElementById('welcome-btn-connect');
  if (welcomeConnectBtn) {
    welcomeConnectBtn.addEventListener('click', () => {
      if (typeof google === 'undefined') {
        alert("Google Identity Services library is not loaded. Check your internet connection.");
        return;
      }
      initClient();
      if (tokenClient) {
        tokenClient.requestAccessToken();
      }
    });
  }

  const welcomeSettingsBtn = document.getElementById('welcome-btn-settings');
  if (welcomeSettingsBtn) {
    welcomeSettingsBtn.addEventListener('click', () => {
      showSettingsModal();
    });
  }



  disconnectBtn.addEventListener('click', () => {
    db.disconnectGoogle();
    refreshApplicationData().then(() => {
      refreshSettingsUI();
      triggerSuccessAnimation("Disconnected. Local Sandbox Active.");
      showWarningModal(
        "Google Sheets Offline",
        "You have manually disconnected Google Sheets. You are now offline, and local sandbox data is active."
      );
    });
  });

  setTimeout(initClient, 1000);
  registerSyncIntervals();
  refreshSettingsUI();
}

// ==========================================================================
// Google Sheets Synchronization Helpers
// ==========================================================================
state.lastSyncTimestamp = Date.now();
state.syncStatus = 'local'; // 'local', 'synced', 'syncing', 'expired'

function updateSyncIndicatorState(status) {
  state.syncStatus = status;
  
  const headerDot = document.getElementById('google-sync-dot');
  const headerText = document.getElementById('google-sync-text');
  
  const sidebarDot = document.getElementById('sidebar-login-dot');
  const sidebarText = document.getElementById('sidebar-login-text');
  
  const drawerDot = document.getElementById('login-status-dot');
  
  const isConnected = db.isGoogleConnected();

  let label = 'Sign In';
  let color = 'var(--color-font-secondary)';
  let isExpired = false;

  if (status === 'local') {
    label = 'Sign In';
    color = 'var(--color-font-secondary)';
  } else if (status === 'synced') {
    label = 'Connected';
    color = 'var(--color-success)';
  } else if (status === 'syncing') {
    label = 'Syncing...';
    color = 'var(--color-success)';
  } else if (status === 'expired') {
    label = 'Re-auth Required';
    color = 'var(--color-alert)';
    isExpired = true;
  }

  // Update Mobile Header Status
  if (headerDot) headerDot.style.backgroundColor = color;
  if (headerText) headerText.textContent = label;

  // Update Desktop Sidebar Status
  if (sidebarDot) sidebarDot.style.backgroundColor = color;
  if (sidebarText) sidebarText.textContent = label;

  // Update Settings Drawer Status
  if (drawerDot) drawerDot.style.backgroundColor = color;

  // Flashing warnings checks
  if (state.wasGoogleConnected === undefined) {
    state.wasGoogleConnected = isConnected;
  }

  const shouldFlash = (state.wasGoogleConnected && !isConnected) || isExpired;
  
  const applyFlash = (el) => {
    if (!el) return;
    if (shouldFlash) {
      el.style.backgroundColor = 'var(--color-alert)';
      el.classList.add('flash-red-animation');
    } else {
      el.classList.remove('flash-red-animation');
    }
  };

  applyFlash(headerDot);
  applyFlash(sidebarDot);
  applyFlash(drawerDot);

  state.wasGoogleConnected = isConnected;
}
window.updateSyncIndicatorState = updateSyncIndicatorState;

// Define legacy function for backward compatibility calls, matching the unified updates
function updateLoginStatusDot() {
  updateSyncIndicatorState(state.syncStatus);
}
window.updateLoginStatusDot = updateLoginStatusDot;

async function syncSpreadsheetData(force = false) {
  if (!db.isGoogleConnected()) {
    updateSyncIndicatorState('local');
    return;
  }
  
  if (state.syncStatus === 'syncing') return;
  
  updateSyncIndicatorState('syncing');
  try {
    await refreshApplicationData();
    state.lastSyncTimestamp = Date.now();
    updateSyncIndicatorState('synced');
  } catch (err) {
    console.error("Sheets synchronization failed:", err);
    if (!db.oauthToken) {
      updateSyncIndicatorState('expired');
    } else {
      updateSyncIndicatorState('synced'); // default back
    }
  }
}
window.syncSpreadsheetData = syncSpreadsheetData;

function reauthorizeGoogleSheets() {
  const savedClientId = localStorage.getItem('puf_google_client_id');
  if (!savedClientId) {
    showSettingsModal();
    return;
  }
  
  if (typeof google === 'undefined') {
    alert("Google Identity Services library is not loaded. Check your internet connection.");
    return;
  }
  
  google.accounts.oauth2.initTokenClient({
    client_id: savedClientId.trim(),
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
    callback: async (response) => {
      if (response.error) {
        alert("Authorization failed: " + response.error);
        return;
      }
      state.googleToken = response.access_token;
      if (db.spreadsheetId) {
        db.connectGoogle(response.access_token, db.spreadsheetId);
        await syncSpreadsheetData(true);
        triggerSuccessAnimation("Google session re-authorized");
        
        // Hide welcome screen overlay
        const welcomeScreen = document.getElementById('welcome-screen');
        if (welcomeScreen) {
          welcomeScreen.classList.add('hidden');
        }
      } else {
        showSettingsModal();
      }
    }
  }).requestAccessToken();
}
window.reauthorizeGoogleSheets = reauthorizeGoogleSheets;

function registerSyncIntervals() {
  // Visibility change listener
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && db.isGoogleConnected()) {
      const elapsed = Date.now() - state.lastSyncTimestamp;
      if (elapsed > 30000) { // 30 seconds
        syncSpreadsheetData();
      }
    }
  });

  // Window Focus listener
  window.addEventListener('focus', () => {
    if (db.isGoogleConnected()) {
      const elapsed = Date.now() - state.lastSyncTimestamp;
      if (elapsed > 30000) { // 30 seconds
        syncSpreadsheetData();
      }
    }
  });

  // Periodic polling every 60 seconds
  setInterval(() => {
    if (db.isGoogleConnected() && !document.hidden) {
      const elapsed = Date.now() - state.lastSyncTimestamp;
      if (elapsed > 45000) { // 45 seconds
        syncSpreadsheetData();
      }
    }
  }, 15000); // Check status every 15 seconds
}
window.registerSyncIntervals = registerSyncIntervals;
