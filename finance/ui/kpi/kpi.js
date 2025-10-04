import { getDepartmentConfig } from "../department-config.js";
import DATA from "../data/data.js";
import "../components/data-table.js";
import "../components/data-chart.js";
import "../components/income-stmt-table.js";
import "../components/compact-metric.js";
import "../components/metric-card.js";
import * as fig from "./fig.js";
import * as metrics from "./metrics.js";
import dayjs from "dayjs";

// DOM elements
const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");
const loadingStateEl = document.getElementById("loading-state");
const errorStateEl = document.getElementById("error-state");
const errorMessageEl = document.getElementById("error-message");
const dashboardContentEl = document.getElementById("dashboard-content");
const financialMetricsEl = document.getElementById("financial-metrics");
const retryButtonEl = document.getElementById("retry-button");
const volumeChartEl = document.getElementById("volume-chart");
const productivityChartEl = document.getElementById("productivity-chart");
const timePeriodSelectEl = document.getElementById("time-period-select");
const prevMonthBtnEl = document.getElementById("prev-month-btn");
const nextMonthBtnEl = document.getElementById("next-month-btn");
const unitSelectEl = document.getElementById("unit-select");
const incomeStmtEl = document.getElementById("income-stmt");
const incomeStatementLinkEl = document.getElementById("income-statement-link");
const feedbackFormEl = document.getElementById("feedback-form");
const feedbackTextEl = document.getElementById("feedback-text");
const feedbackSaveTextEl = document.getElementById("feedback-save-text");

// State
let STATE = {
  loading: true,
  error: null,
  data: null,
  deptId: null,
  deptConfig: null,
  selectedMonth: null,
  selectedUnit: null,
  selectedTab: "KPIs",
  availMonths: [],
};

// ------------------------------------------------------------
// UI initialization
// ------------------------------------------------------------
// Validate department and redirect to main page if invalid
function validateDepartment(deptId) {
  const config = getDepartmentConfig(deptId);
  if (!deptId || !config) {
    window.location.href = "index.html";
    return null;
  }
  return config;
}

// Populate the Select unit dropdown with list of sub-departments
function populateUnitSelector() {
  // Hide unit dropdown if there are no sub-departments
  const subDepts = STATE.deptConfig.sub_depts;
  if (!subDepts || subDepts.length === 0) {
    unitSelectEl.classList.add("hidden");
    return;
  }

  // Show Select unit dropdown
  unitSelectEl.classList.remove("hidden");
  unitSelectEl.innerHTML = "";

  // Populate with sub-departments
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All Units";
  unitSelectEl.appendChild(allOption);

  subDepts.forEach((subDept, index) => {
    const option = document.createElement("option");
    option.value = index.toString();
    option.textContent = subDept.name;
    unitSelectEl.appendChild(option);
  });

  // Initialize to selected unit
  unitSelectEl.value =
    STATE.selectedUnit !== null ? STATE.selectedUnit.toString() : "";
}

// Populate the time period dropdown with months between firstMonth and lastMonth, given
// in the format YYYY-MM
function populateTimePeriodSelector(firstMonth, lastMonth) {
  if (!firstMonth || !lastMonth) {
    timePeriodSelectEl.innerHTML = "No data available";
    return;
  }

  const options = [];
  let date = dayjs(lastMonth);
  const startDate = dayjs(firstMonth);

  // Option values are in the format 2025-01
  while (date.isAfter(startDate) || date.isSame(startDate)) {
    options.push(date.format("YYYY-MM"));
    date = date.subtract(1, "month");
  }

  // Store available months in state
  STATE.availMonths = options;

  // Option labels in the dropdown are in the format "Jan 2025"
  timePeriodSelectEl.innerHTML = "";
  options.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = dayjs(month).format("MMM YYYY");
    timePeriodSelectEl.appendChild(option);
  });

  // Select the first month by default
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
async function loadData() {
  try {
    showLoading();
    await DATA.initialize();
    await DATA.loadFeedbackForDept(STATE.deptId);

    // Update time period dropdown and get workday IDs from selected subdepartment
    const { firstMonth, lastMonth } = DATA.getAvailableMonths();
    const urlHasMonth = new URLSearchParams(window.location.search).has(
      "month"
    );
    const selectedMonth = populateTimePeriodSelector(firstMonth, lastMonth);
    if (!urlHasMonth && selectedMonth) {
      updateURL(); // Add month parameter if not present
    }
    const wdIds = getSelectedWorkdayIds();
    updateDashboard(wdIds, selectedMonth);
  } catch (error) {
    console.error("Error loading data:", error);
    showError(error);
  }
}

async function refreshData() {
  try {
    showLoading();
    const wdIds = getSelectedWorkdayIds();
    const selectedMonth = STATE.selectedMonth;
    updateDashboard(wdIds, selectedMonth);
  } catch (error) {
    console.error("Error refreshing dashboard data:", error);
    showError(error);
  }
}

function getSelectedWorkdayIds() {
  const config = STATE.deptConfig;

  if (STATE.selectedUnit === null) {
    // This department has no sub-departments, or All Units selected
    if (config.sub_depts?.length > 0) {
      return config.sub_depts.flatMap((subDept) => subDept.wd_ids);
    }
    return config.wd_ids;
  }

  const selectedSubDept = config.sub_depts?.[STATE.selectedUnit];
  return selectedSubDept ? selectedSubDept.wd_ids : [];
}

function updateDashboard(wdIds, selectedMonth) {
  STATE.data = DATA.processData(wdIds, selectedMonth);

  const comment = DATA.getFeedbackForMonth(STATE.deptId, selectedMonth);
  feedbackTextEl.value = comment;
  feedbackTextEl.defaultValue = comment;
  updateFeedbackSaveBtn();

  showLoaded();
}

// ------------------------------------------------------------
// Event handlers
// ------------------------------------------------------------
function showLoading() {
  STATE.loading = true;
  STATE.error = null;
  render();
}

function showLoaded(data) {
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
    if (isFeedbackDirty()) {
      if (
        !confirm("You have unsaved feedback. Do you want to discard changes?")
      ) {
        timePeriodSelectEl.value = STATE.selectedMonth;
        return;
      }
    }
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

  prevMonthBtnEl.disabled = isLast; // Last month is oldest (earliest date)
  nextMonthBtnEl.disabled = isFirst; // First month is newest (latest date)
}

async function handleGotoPrevMonth() {
  // Navigate to previous month
  const currentIndex = STATE.availMonths.indexOf(STATE.selectedMonth);
  if (currentIndex < STATE.availMonths.length - 1) {
    if (isFeedbackDirty()) {
      if (
        !confirm("You have unsaved feedback. Do you want to discard changes?")
      ) {
        return;
      }
    }
    STATE.selectedMonth = STATE.availMonths[currentIndex + 1];
    timePeriodSelectEl.value = STATE.selectedMonth;
    updateURL();
    updateMonthNavBtns();
    await refreshData();
  }
}

async function handleGotoNextMonth() {
  // Navigate to next month (newer)
  const currentIndex = STATE.availMonths.indexOf(STATE.selectedMonth);
  if (currentIndex > 0) {
    if (isFeedbackDirty()) {
      if (
        !confirm("You have unsaved feedback. Do you want to discard changes?")
      ) {
        return;
      }
    }
    STATE.selectedMonth = STATE.availMonths[currentIndex - 1];
    timePeriodSelectEl.value = STATE.selectedMonth;
    updateURL();
    updateMonthNavBtns();
    await refreshData();
  }
}

async function handleUnitChange(event) {
  const newUnit = event.target.value;
  const newUnitIndex = newUnit === "" ? null : parseInt(newUnit);
  if (newUnitIndex !== STATE.selectedUnit) {
    if (isFeedbackDirty()) {
      if (
        !confirm("You have unsaved feedback. Do you want to discard changes?")
      ) {
        unitSelectEl.value =
          STATE.selectedUnit !== null ? STATE.selectedUnit.toString() : "";
        return;
      }
    }
    STATE.selectedUnit = newUnitIndex;
    updateURL();
    await refreshData();
  }
}

function handleTabChange(event) {
  const newTab = event.target.getAttribute("aria-label");
  if (newTab !== STATE.selectedTab) {
    STATE.selectedTab = newTab;
    updateURL();
  }
}

function handleGotoIncomeStmt(event) {
  // Find and click the Income Statement tab
  event.preventDefault();
  const tabs = document.querySelectorAll('input[name="main_tabs"]');
  tabs.forEach((tab) => {
    if (tab.getAttribute("aria-label") === "Income Statement") {
      tab.click();
    }
  });
}

async function handleSaveFeedback(event) {
  event.preventDefault();
  const comment = feedbackTextEl.value;
  await DATA.saveFeedback(STATE.deptId, STATE.selectedMonth, comment);
  feedbackTextEl.defaultValue = comment;
  updateFeedbackSaveBtn();
}

function isFeedbackDirty() {
  return feedbackTextEl.value !== feedbackTextEl.defaultValue;
}

function updateFeedbackSaveBtn() {
  if (isFeedbackDirty()) {
    feedbackSaveTextEl.textContent = "Save";
  } else {
    feedbackSaveTextEl.textContent = "Saved";
  }
}

async function handlePopState() {
  const changes = syncStateFromURL();

  // Refresh data if month or unit changed
  if (changes.month || changes.unit) {
    await refreshData();
  }
}

function handleBeforeUnload(e) {
  if (isFeedbackDirty()) {
    e.preventDefault();
    e.returnValue = "";
  }
}

// ------------------------------------------------------------
// URL state synchronization
// ------------------------------------------------------------
function syncStateFromURL() {
  const params = new URLSearchParams(window.location.search);
  const newMonth = params.get("month") || null;
  const newUnit = params.get("unit");
  const newUnitIndex =
    newUnit === "" || newUnit === null ? null : parseInt(newUnit);
  const newTab = params.get("tab") || "KPIs";

  const changes = {
    month: newMonth !== STATE.selectedMonth,
    unit: newUnitIndex !== STATE.selectedUnit,
    tab: newTab !== STATE.selectedTab,
  };

  // Update state
  if (changes.month) {
    // Only update if newMonth is valid (don't overwrite with null)
    if (newMonth) {
      STATE.selectedMonth = newMonth;
      if (timePeriodSelectEl.value) {
        timePeriodSelectEl.value = STATE.selectedMonth;
        updateMonthNavBtns();
      }
    }
  }

  if (changes.unit) {
    STATE.selectedUnit = newUnitIndex;
    if (unitSelectEl.value !== undefined) {
      unitSelectEl.value =
        STATE.selectedUnit !== null ? STATE.selectedUnit.toString() : "";
    }
  }

  if (changes.tab) {
    STATE.selectedTab = newTab;
    const allTabs = document.querySelectorAll('input[name="main_tabs"]');
    allTabs.forEach((tab) => {
      if (tab.getAttribute("aria-label") === STATE.selectedTab) {
        tab.checked = true;
      }
    });
  }

  return changes;
}

function updateURL() {
  const params = new URLSearchParams(window.location.search);

  if (STATE.selectedUnit !== null) {
    params.set("unit", STATE.selectedUnit.toString());
  } else {
    params.delete("unit");
  }

  if (STATE.selectedMonth) {
    params.set("month", STATE.selectedMonth);
  } else {
    params.delete("month");
  }

  if (STATE.selectedTab && STATE.selectedTab !== "KPIs") {
    params.set("tab", STATE.selectedTab);
  } else {
    params.delete("tab");
  }

  const newURL = `${window.location.pathname}?${params.toString()}`;
  window.history.pushState({}, "", newURL);
}

// ------------------------------------------------------------
// Rendering
// ------------------------------------------------------------
function updateNavbar() {
  const deptName = STATE.deptConfig?.name || "Department";
  titleEl.textContent = `PRH - ${deptName}`;

  const monthStr = STATE.selectedMonth
    ? "Year to " + dayjs(STATE.selectedMonth).format("MMMM YYYY")
    : "";

  let subtitle = monthStr;
  if (STATE.selectedUnit !== null && STATE.deptConfig?.sub_depts) {
    const unitName = STATE.deptConfig.sub_depts[STATE.selectedUnit]?.name;
    if (unitName) {
      subtitle = monthStr ? `${unitName} • ${monthStr}` : unitName;
    }
  }

  subtitleEl.textContent = subtitle;
}

function render() {
  updateNavbar();

  if (STATE.loading) {
    loadingStateEl.classList.remove("hidden");
    errorStateEl.classList.add("hidden");
    dashboardContentEl.classList.add("hidden");
  } else if (STATE.error) {
    loadingStateEl.classList.add("hidden");
    errorStateEl.classList.remove("hidden");
    dashboardContentEl.classList.add("hidden");
    errorMessageEl.textContent = STATE.error;
  } else {
    loadingStateEl.classList.add("hidden");
    errorStateEl.classList.add("hidden");
    dashboardContentEl.classList.remove("hidden");

    // Populate dashboard
    metrics.populateFinancialMetrics(
      financialMetricsEl,
      STATE.data,
      STATE.selectedMonth
    );
    metrics.populateKPIMetrics(dashboardContentEl, STATE.data);
    metrics.populateVolumeMetrics(
      dashboardContentEl,
      STATE.data,
      STATE.selectedMonth
    );
    metrics.populateProductivityMetrics(
      dashboardContentEl,
      STATE.data,
      STATE.selectedMonth
    );
    fig.populateVolumeChart(volumeChartEl, STATE.data);
    fig.populateProductivityChart(productivityChartEl, STATE.data);
    incomeStmtEl.data = STATE.data.incomeStmt;
  }
}

async function init() {
  // Display based on URL parameters
  const params = new URLSearchParams(window.location.search);
  const deptId = params.get("dept");
  const deptConfig = validateDepartment(deptId);
  if (!deptConfig) return;

  // Initialize state
  STATE.deptId = deptId;
  STATE.deptConfig = deptConfig;

  // If this department has sub-departments, populate the "unit" dropdown
  populateUnitSelector();

  // Sync state from URL (handles unit, month, and tab)
  syncStateFromURL();

  // Event handlers
  const allTabs = document.querySelectorAll('input[name="main_tabs"]');
  retryButtonEl.addEventListener("click", loadData);
  timePeriodSelectEl.addEventListener("change", handleMonthChange);
  prevMonthBtnEl.addEventListener("click", handleGotoPrevMonth);
  nextMonthBtnEl.addEventListener("click", handleGotoNextMonth);
  unitSelectEl.addEventListener("change", handleUnitChange);
  incomeStatementLinkEl.addEventListener("click", handleGotoIncomeStmt);
  feedbackFormEl.addEventListener("submit", handleSaveFeedback);
  feedbackTextEl.addEventListener("input", updateFeedbackSaveBtn);
  allTabs.forEach((tab) => tab.addEventListener("change", handleTabChange));
  window.addEventListener("popstate", handlePopState);
  window.addEventListener("beforeunload", handleBeforeUnload);

  // Finally fetch and read from db
  await loadData();
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
