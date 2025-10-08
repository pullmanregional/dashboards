import { getAllDepartments } from "../department-config.js";
import DATA from "../data/data.js";
import { DeptData } from "../components/depts-summary.js";
import { formatAccounting } from "../data/util.js";
import { calculateVolumeTrend, calculateFTETrend } from "../data/stats.js";
import "../components/data-chart.js";
import "../components/metric-card.js";
import "../components/income-stmt-table.js";
import "../components/balance-sheet-table.js";
import "../components/depts-summary.js";
import dayjs from "dayjs";

// DOM elements
const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");
const loadingStateEl = document.getElementById("loading-state");
const errorStateEl = document.getElementById("error-state");
const errorMessageEl = document.getElementById("error-message");
const contentEl = document.getElementById("content");
const summaryMetricsEl = document.getElementById("summary-metrics");
const adminIncomeStmtEl = document.getElementById("admin-income-stmt");
const balanceSheetEl = document.getElementById("balance-sheet");
const timePeriodSelectEl = document.getElementById("time-period-select");
const deptsSummaryEl = document.getElementById("depts-summary");
const retryButtonEl = document.getElementById("retry-button");
const prevMonthBtnEl = document.getElementById("prev-month-btn");
const nextMonthBtnEl = document.getElementById("next-month-btn");

// State
let STATE = {
  loading: true,
  error: null,
  selectedMonth: null,
  availMonths: [],
  orgIncomeStmt: [],
  departmentData: [],
  expandedRows: new Set(),
  allFeedback: {}, // Indexed by dept-month
};

const departmentDataCache = {};

// ------------------------------------------------------------
// UI initialization
// ------------------------------------------------------------
// Populate the time period dropdown with months between firstMonth and lastMonth, given
// in the format YYYY-MM
function populateTimePeriodSelector(firstMonth, lastMonth) {
  if (!firstMonth || !lastMonth) {
    timePeriodSelectEl.innerHTML =
      '<option value="">No data available</option>';
    return;
  }

  const options = [];
  let date = dayjs(lastMonth);
  const startDate = dayjs(firstMonth);

  while (date.isAfter(startDate) || date.isSame(startDate)) {
    options.push(date.format("YYYY-MM"));
    date = date.subtract(1, "month");
  }

  STATE.availMonths = options;

  timePeriodSelectEl.innerHTML = "";
  options.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = dayjs(month).format("MMM YYYY");
    timePeriodSelectEl.appendChild(option);
  });

  if (!STATE.selectedMonth && options.length > 0) {
    STATE.selectedMonth = options[0];
  }
  timePeriodSelectEl.value = STATE.selectedMonth;

  updateMonthNavBtns();
  return STATE.selectedMonth;
}

// ------------------------------------------------------------
// Data functions
// ------------------------------------------------------------
// Initial data load - fetches DB data, feedback, and initializes state
async function loadData() {
  try {
    showLoading();
    await DATA.initialize();
    await DATA.loadAllFeedback();

    // Update time period dropdown
    const { firstMonth, lastMonth } = DATA.getAvailableMonths();
    populateTimePeriodSelector(firstMonth, lastMonth);

    // Check for month query param, and update global STATE
    const searchParams = new URLSearchParams(window.location.search);
    const urlHasMonth = searchParams.has("month");
    syncStateFromURL();

    calcDepartmentData(STATE.selectedMonth);
    if (!urlHasMonth && STATE.selectedMonth) {
      updateURL(); // Add month parameter if not present
    }
    showLoaded();
  } catch (error) {
    console.error("Error loading data:", error);
    showError(error);
  }
}

// Refresh display with current month selection
async function refreshData() {
  try {
    showLoading();
    calcDepartmentData(STATE.selectedMonth);
    showLoaded();
  } catch (error) {
    console.error("Error refreshing data:", error);
    showError(error);
  }
}

// Calculate financial metrics and trends for all departments
function calcDepartmentData(month) {
  // Calculate overall org income statement and balance sheet (not filtered by department)
  // This includes all WD IDs, even those not shown in the department table
  const orgData = DATA.processData(null, month);
  STATE.orgIncomeStmt = orgData.incomeStmt;
  STATE.orgBalanceSheet = orgData.balanceSheet;

  // Return cached department data for this month if already calculated
  STATE.departmentData = departmentDataCache[month] || [];
  if (STATE.departmentData.length > 0) {
    return;
  }

  // Calculate data by department
  const departments = getAllDepartments();
  departments.forEach((dept) => {
    const wdIds = dept.sub_depts
      ? dept.sub_depts.flatMap((subDept) => subDept.wd_ids)
      : dept.wd_ids;

    if (!wdIds || wdIds.length === 0) return;

    const data = DATA.processData(wdIds, month);
    const incomeStmt = data.incomeStmt;

    // Extract financial metrics from income statement
    const monthRevenue =
      incomeStmt.find((row) => row.tree === "Net Revenue")?.["Actual"] || 0;
    const monthExpense =
      incomeStmt.find((row) => row.tree === "Total Operating Expenses")?.[
        "Actual"
      ] || 0;
    const ytdRevenue =
      incomeStmt.find((row) => row.tree === "Net Revenue")?.["YTD Actual"] || 0;
    const ytdExpense =
      incomeStmt.find((row) => row.tree === "Total Operating Expenses")?.[
        "YTD Actual"
      ] || 0;
    const netIncome =
      incomeStmt.find((row) => row.tree === "Net Income")?.["Actual"] || 0;
    const ytdNetIncome =
      incomeStmt.find((row) => row.tree === "Net Income")?.["YTD Actual"] || 0;

    // Get budget values
    const ytdBudgetRevenue =
      incomeStmt.find((row) => row.tree === "Net Revenue")?.["YTD Budget"] || 0;
    const ytdBudgetExpense =
      incomeStmt.find((row) => row.tree === "Total Operating Expenses")?.[
        "YTD Budget"
      ] || 0;
    const ytdBudgetNetIncome =
      incomeStmt.find((row) => row.tree === "Net Income")?.["YTD Budget"] || 0;

    // Calculate variance
    const variance = ytdNetIncome - ytdBudgetNetIncome;
    const variancePct =
      ytdBudgetNetIncome !== 0
        ? (variance / Math.abs(ytdBudgetNetIncome)) * 100
        : 0;

    // Calculate volume and FTE trends (last 12 months)
    const volumeTrend = calculateVolumeTrend(data.volumes, month);
    const fteTrend = calculateFTETrend(data.hours, month);

    STATE.departmentData.push(
      new DeptData({
        id: dept.id,
        name: dept.name,
        monthRevenue,
        monthExpense,
        ytdRevenue,
        ytdExpense,
        netIncome,
        ytdNetIncome,
        variance,
        variancePct,
        volumeTrend,
        fteTrend,
      })
    );
  });

  // Sort departments alphabetically by name
  STATE.departmentData.sort((a, b) => a.name.localeCompare(b.name));

  // Cache calculated data
  departmentDataCache[month] = STATE.departmentData;
}

// ------------------------------------------------------------
// Event handlers
// ------------------------------------------------------------
function showLoading() {
  STATE.loading = true;
  STATE.error = null;
  render();
}

function showLoaded() {
  STATE.loading = false;
  STATE.error = null;
  render();
}

function showError(error) {
  STATE.error = error.message;
  STATE.loading = false;
  render();
}

async function handleMonthChange(event) {
  const newMonth = event.target.value;
  if (newMonth !== STATE.selectedMonth) {
    STATE.selectedMonth = newMonth;
    updateURL();
    updateMonthNavBtns();
    await refreshData();
  }
}

// Update month navigation button states (enable/disable based on position)
function updateMonthNavBtns() {
  const currentIndex = STATE.availMonths.indexOf(STATE.selectedMonth);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === STATE.availMonths.length - 1;

  prevMonthBtnEl.disabled = isLast;
  nextMonthBtnEl.disabled = isFirst;
}

// Navigate to previous month
async function handleGotoPrevMonth() {
  const currentIndex = STATE.availMonths.indexOf(STATE.selectedMonth);
  if (currentIndex < STATE.availMonths.length - 1) {
    STATE.selectedMonth = STATE.availMonths[currentIndex + 1];
    timePeriodSelectEl.value = STATE.selectedMonth;
    updateURL();
    updateMonthNavBtns();
    await refreshData();
  }
}

// Navigate to next month
async function handleGotoNextMonth() {
  const currentIndex = STATE.availMonths.indexOf(STATE.selectedMonth);
  if (currentIndex > 0) {
    STATE.selectedMonth = STATE.availMonths[currentIndex - 1];
    timePeriodSelectEl.value = STATE.selectedMonth;
    updateURL();
    updateMonthNavBtns();
    await refreshData();
  }
}

function handleSaveExpandedState(event) {
  // <depts-summary> row expansion state changed. Persist to session storage
  const { expandedRows } = event.detail;
  STATE.expandedRows = new Set(expandedRows);
  const expandedArray = Array.from(STATE.expandedRows);
  sessionStorage.setItem("admin-expanded-rows", JSON.stringify(expandedArray));
}

async function handlePopState() {
  if (syncStateFromURL()) {
    // Refresh data if month selection changed
    await refreshData();
  }
}

// ------------------------------------------------------------
// URL/session state synchronization
// ------------------------------------------------------------
// Restore expanded rows from session storage
function loadExpandedState() {
  try {
    const saved = sessionStorage.getItem("admin-expanded-rows");
    if (saved) {
      const expandedArray = JSON.parse(saved);
      STATE.expandedRows = new Set(expandedArray);
    }
  } catch (error) {
    console.error("Error loading state:", error);
    STATE.expandedRows = new Set();
  }
}

// Read URL parameters and update global STATE
function syncStateFromURL() {
  const params = new URLSearchParams(window.location.search);
  const newMonth = params.get("month") || null;
  const changed = newMonth !== STATE.selectedMonth;
  if (changed) {
    // Only update if newMonth is valid (don't overwrite with null)
    if (newMonth) {
      STATE.selectedMonth = newMonth;
      if (timePeriodSelectEl.value) {
        timePeriodSelectEl.value = STATE.selectedMonth;
        updateMonthNavBtns();
      }
    }
  }

  return changed;
}

// Update URL with current state parameters
function updateURL() {
  const params = new URLSearchParams(window.location.search);
  if (STATE.selectedMonth) {
    params.set("month", STATE.selectedMonth);
  } else {
    params.delete("month");
  }

  const newURL = `${window.location.pathname}?${params.toString()}`;
  window.history.pushState({}, "", newURL);
}

// ------------------------------------------------------------
// Rendering
// ------------------------------------------------------------
// Update page title and subtitle with current month
function updateNavbar() {
  titleEl.textContent = "PRH - Admin Overview";
  const monthStr = STATE.selectedMonth
    ? dayjs(STATE.selectedMonth).format("MMMM YYYY")
    : "";
  subtitleEl.textContent = monthStr;
}

// Render summary metric cards and organization income statement
function renderSummaryMetrics() {
  // Update the income statement and balance sheet tables
  const incomeStmt = STATE.orgIncomeStmt;
  adminIncomeStmtEl.data = incomeStmt;
  balanceSheetEl.data = STATE.orgBalanceSheet;

  // Get the YTD Actual values from the income statement summary rows
  const netRevenueRow = incomeStmt.find((row) => row.tree === "Net Revenue");
  const expensesRow = incomeStmt.find(
    (row) => row.tree === "Total Operating Expenses"
  );
  const netIncomeRow = incomeStmt.find((row) => row.tree === "Net Income");

  const ttlYTDRevenue = netRevenueRow?.["YTD Actual"] || 0;
  const ttlYTDExpense = expensesRow?.["YTD Actual"] || 0;
  const ttlYTDNetIncome = netIncomeRow?.["YTD Actual"] || 0;

  // Overall variance percentage
  const ttlVariancePct =
    ttlYTDRevenue > 0 ? (ttlYTDNetIncome / ttlYTDRevenue) * 100 : 0;

  // Update the metric cards
  const ytdRevenueCard = document.getElementById("ytd-revenue-card");
  const ytdExpensesCard = document.getElementById("ytd-expenses-card");
  const ytdNetIncomeCard = document.getElementById("ytd-net-income-card");

  if (ytdRevenueCard) {
    ytdRevenueCard.value = formatAccounting(ttlYTDRevenue);
    ytdRevenueCard.variancePct = ttlVariancePct;
    ytdRevenueCard.statusText = `${Math.round(ttlVariancePct)}% of revenue`;
    ytdRevenueCard.showDetails = false;
  }

  if (ytdExpensesCard) {
    ytdExpensesCard.value = formatAccounting(ttlYTDExpense);
    ytdExpensesCard.variancePct = ttlVariancePct;
    ytdExpensesCard.statusText = `${Math.round(ttlVariancePct)}% of revenue`;
    ytdExpensesCard.showDetails = false;
  }

  if (ytdNetIncomeCard) {
    ytdNetIncomeCard.value = formatAccounting(ttlYTDNetIncome);
    ytdNetIncomeCard.variancePct = ttlVariancePct;
    ytdNetIncomeCard.statusText = `${Math.round(ttlVariancePct)}% of revenue`;
    ytdNetIncomeCard.showDetails = false;
  }
}

// Main render function - orchestrates all UI updates
function render() {
  updateNavbar();

  if (STATE.loading) {
    loadingStateEl.classList.remove("hidden");
    errorStateEl.classList.add("hidden");
    contentEl.classList.add("hidden");
    summaryMetricsEl.classList.add("hidden");
  } else if (STATE.error) {
    loadingStateEl.classList.add("hidden");
    errorStateEl.classList.remove("hidden");
    contentEl.classList.add("hidden");
    summaryMetricsEl.classList.add("hidden");
    errorMessageEl.textContent = STATE.error;
  } else {
    loadingStateEl.classList.add("hidden");
    errorStateEl.classList.add("hidden");
    contentEl.classList.remove("hidden");
    summaryMetricsEl.classList.remove("hidden");

    // Update departments summary component
    deptsSummaryEl.deptData = STATE.departmentData;
    deptsSummaryEl.selectedMonth = STATE.selectedMonth;
    deptsSummaryEl.expandedRows = new Set(STATE.expandedRows);
    deptsSummaryEl.feedback = DATA.allFeedback;

    renderSummaryMetrics();
  }
}

async function init() {
  // Load expanded state of department rows from session storage
  loadExpandedState();

  // Event listeners
  timePeriodSelectEl.addEventListener("change", handleMonthChange);
  prevMonthBtnEl.addEventListener("click", handleGotoPrevMonth);
  nextMonthBtnEl.addEventListener("click", handleGotoNextMonth);
  retryButtonEl.addEventListener("click", loadData);
  deptsSummaryEl.addEventListener("expanded-changed", handleSaveExpandedState);
  window.addEventListener("popstate", handlePopState);

  await loadData();
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
