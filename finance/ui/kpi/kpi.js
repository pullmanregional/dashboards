import { getDepartmentConfig } from "../department-config.js";
import { KPI_DATA } from "./data.js";
import "../components/data-table.js";
import "../components/data-chart.js";
import "../components/income-stmt-table.js";
import * as fig from "./fig.js";
import * as metrics from "./metrics.js";
import * as incomeStmt from "./income-stmt.js";
import dayjs from "dayjs";

// DOM elements
const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");
const loadingStateEl = document.getElementById("loading-state");
const errorStateEl = document.getElementById("error-state");
const errorMessageEl = document.getElementById("error-message");
const dashboardContentEl = document.getElementById("dashboard-content");
const financialMetricsEl = document.getElementById("financial-metrics");
const kpiTableEl = document.getElementById("kpi-table");
const volumeTableEl = document.getElementById("volume-table");
const backButtonEl = document.getElementById("back-button");
const retryButtonEl = document.getElementById("retry-button");
const volumeChartEl = document.getElementById("volume-chart");
const revenueChartEl = document.getElementById("revenue-chart");
const productivityChartEl = document.getElementById("productivity-chart");
const timePeriodSelectEl = document.getElementById("time-period-select");
const unitSelectEl = document.getElementById("unit-select");
const incomeStatementEl = document.getElementById("income-statement");

// State
let STATE = {
  loading: true,
  error: null,
  data: null,
  deptId: null,
  deptConfig: null,
  selectedMonth: null,
  selectedUnit: null,
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

// Parse unit parameter
function parseUnit(unitParam, subDepts) {
  if (!subDepts || unitParam === null) return null;
  const index = parseInt(unitParam);
  return index >= 0 && index < subDepts.length ? index : null;
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
}

// ------------------------------------------------------------
// Data functions
// ------------------------------------------------------------
async function loadData() {
  try {
    showLoading();
    await KPI_DATA.initialize();

    // Update time period dropdown
    const { firstMonth, lastMonth } = KPI_DATA.getAvailableMonths();
    populateTimePeriodSelector(firstMonth, lastMonth);

    const wdIds = getSelectedWorkdayIds();
    const data = KPI_DATA.filterData(wdIds, STATE.selectedMonth);
    showLoaded(data);
  } catch (error) {
    console.error("Error loading data:", error);
    showError(error);
  }
}

async function refreshData() {
  try {
    showLoading();
    const wdIds = getSelectedWorkdayIds();
    const data = KPI_DATA.filterData(wdIds, STATE.selectedMonth);
    console.log(data);
    showLoaded(data);
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

// ------------------------------------------------------------
// Event handlers
// ------------------------------------------------------------
function showLoading() {
  STATE.loading = true;
  STATE.error = null;
  render();
}

function showLoaded(data) {
  STATE.data = data;
  STATE.loading = false;
  render();
}

function showError(error) {
  STATE.error = error.message;
  STATE.loading = false;
  render();
}

async function handleTimeChange(event) {
  const newMonth = event.target.value;
  if (newMonth !== STATE.selectedMonth) {
    STATE.selectedMonth = newMonth;
    updateURL();
    await refreshData();
  }
}

async function handleUnitChange(event) {
  const newUnit = event.target.value;
  const newUnitIndex = newUnit === "" ? null : parseInt(newUnit);
  if (newUnitIndex !== STATE.selectedUnit) {
    STATE.selectedUnit = newUnitIndex;
    updateURL();
    await refreshData();
  }
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

  const newURL = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", newURL);
}

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
    metrics.populateFinancialMetrics(financialMetricsEl, STATE.data);
    metrics.populateKPITable(kpiTableEl, STATE.data);
    metrics.populateVolumeTable(volumeTableEl, STATE.data);
    fig.populateVolumeChart(volumeChartEl, STATE.data);
    fig.populateRevenueChart(revenueChartEl, STATE.data);
    fig.populateProductivityChart(productivityChartEl, STATE.data);
    incomeStmt.populateIncomeStatement(incomeStatementEl, STATE.data);
  }
}

// Main entry point - initialize UI
async function init() {
  // Display based on URL parameters
  const params = new URLSearchParams(window.location.search);
  const deptId = params.get("dept");
  const unitParam = params.get("unit");
  const monthParam = params.get("month");
  const deptConfig = validateDepartment(deptId);
  if (!deptConfig) return;

  // Initialize state
  STATE.deptId = deptId;
  STATE.deptConfig = deptConfig;
  STATE.selectedUnit = parseUnit(unitParam, deptConfig.sub_depts);
  STATE.selectedMonth = monthParam || null;

  // Event handlers
  backButtonEl.addEventListener("click", () => {
    window.location.href = "index.html";
  });
  retryButtonEl.addEventListener("click", loadData);
  timePeriodSelectEl.addEventListener("change", handleTimeChange);
  unitSelectEl.addEventListener("change", handleUnitChange);

  // If this department has sub-departments, populate the "unit" dropdown
  populateUnitSelector();

  // Finally fetch and read from db
  await loadData();
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
