import { getDepartmentConfig } from "../department-config.js";
import { KPI_DATA } from "./data.js";
import "../components/metric-card.js";
import "../components/table-card.js";
import "../components/chart-card.js";
import "../components/income-stmt-table.js";
import * as fig from "./fig.js";
import * as metrics from "./metrics.js";
import { populateIncomeStatement } from "./income-stmt.js";
import dayjs from "dayjs";

// Constants
const ELEMENT_IDS = {
  title: "title",
  subtitle: "subtitle",
  loadingState: "loading-state",
  errorState: "error-state",
  errorMessage: "error-message",
  dashboardContent: "dashboard-content",
  financialMetrics: "financial-metrics",
  kpiTable: "kpi-table",
  volumeTable: "volume-table",
  backButton: "back-button",
  retryButton: "retry-button",
  volumeChart: "volume-chart",
  revenueChart: "revenue-chart",
  productivityChart: "productivity-chart",
  timePeriodSelect: "time-period-select",
  unitSelect: "unit-select",
  incomeStatement: "income-statement",
};

// Dashboard state
let dashboardState = {
  loading: true,
  error: null,
  data: null,
  departmentId: null,
  departmentConfig: null,
  selectedMonth: null,
  selectedUnit: null,
};

// HTML elements cache
const elements = {};

// ------------------------------------------------------------
// Utility functions
// ------------------------------------------------------------
function initializeElements() {
  Object.entries(ELEMENT_IDS).forEach(([key, id]) => {
    elements[key] = document.getElementById(id);
  });
}

function parseUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    deptId: urlParams.get("dept"),
    unitParam: urlParams.get("unit"),
    monthParam: urlParams.get("month"),
  };
}

function validateDepartment(deptId) {
  const deptConfig = getDepartmentConfig(deptId);
  if (!deptId || !deptConfig) {
    window.location.href = "index.html";
    return null;
  }
  return deptConfig;
}

function parseUnitParameter(deptConfig, unitParam) {
  if (!deptConfig.sub_depts || unitParam === null) return null;

  const unitIndex = parseInt(unitParam);
  if (
    !isNaN(unitIndex) &&
    unitIndex >= 0 &&
    unitIndex < deptConfig.sub_depts.length
  ) {
    return unitIndex;
  }
  return null;
}

function setupEventListeners() {
  elements.backButton.addEventListener("click", () => {
    window.location.href = "index.html";
  });

  elements.retryButton.addEventListener("click", loadData);
  elements.timePeriodSelect.addEventListener("change", handleTimePeriodChange);
  elements.unitSelect.addEventListener("change", handleUnitChange);
}

// ------------------------------------------------------------
// UI initialization
// ------------------------------------------------------------
async function init() {
  initializeElements();

  const { deptId, unitParam, monthParam } = parseUrlParameters();

  const deptConfig = validateDepartment(deptId);
  if (!deptConfig) return;

  dashboardState.departmentId = deptId;
  dashboardState.departmentConfig = deptConfig;
  dashboardState.selectedUnit = parseUnitParameter(deptConfig, unitParam);
  dashboardState.selectedMonth = monthParam || null;

  setupEventListeners();
  populateUnitSelector();
  await loadData();
}

async function loadData() {
  try {
    dashboardState.loading = true;
    dashboardState.error = null;
    updateUI();

    await KPI_DATA.initialize();

    populateTimePeriodSelector(KPI_DATA);

    // Get wd_ids based on selected unit or full department
    const wd_ids = getFilteredWdIds();
    dashboardState.data = KPI_DATA.getDepartmentData(
      wd_ids,
      dashboardState.selectedMonth
    );
    dashboardState.loading = false;
    updateUI();
  } catch (error) {
    console.error("Error loading dashboard:", error);
    dashboardState.error = error.message;
    dashboardState.loading = false;
    updateUI();
  }
}

function generateMonthOptions(firstMonth, lastMonth) {
  const monthOptions = [];
  let curDate = dayjs(lastMonth);
  const startDate = dayjs(firstMonth);

  do {
    monthOptions.push(curDate.format("YYYY-MM"));
    curDate = curDate.subtract(1, "month");
  } while (curDate.isAfter(startDate));

  return monthOptions;
}

function createMonthOption(month) {
  const option = document.createElement("option");
  option.value = month;
  option.textContent = dayjs(month).format("MMM YYYY");
  return option;
}

function populateTimePeriodSelector(kpiData) {
  const { firstMonth, lastMonth } = kpiData.getAvailableMonths();

  if (!firstMonth || !lastMonth) {
    elements.timePeriodSelect.innerHTML = "No data available";
    return;
  }

  const monthOptions = generateMonthOptions(firstMonth, lastMonth);

  elements.timePeriodSelect.innerHTML = "";
  monthOptions.forEach((month) => {
    elements.timePeriodSelect.appendChild(createMonthOption(month));
  });

  if (!dashboardState.selectedMonth && monthOptions.length > 0) {
    dashboardState.selectedMonth = monthOptions[0];
  }

  elements.timePeriodSelect.value = dashboardState.selectedMonth;
}

async function handleTimePeriodChange(event) {
  const newMonth = event.target.value;
  if (newMonth !== dashboardState.selectedMonth) {
    dashboardState.selectedMonth = newMonth;
    updateURL();
    await refreshData();
  }
}

async function handleUnitChange(event) {
  const newUnit = event.target.value;
  const newUnitIndex = newUnit === "" ? null : parseInt(newUnit);
  if (newUnitIndex !== dashboardState.selectedUnit) {
    dashboardState.selectedUnit = newUnitIndex;
    updateURL();
    await refreshData();
  }
}

function createUnitOption(value, text) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  return option;
}

function populateUnitSelector() {
  const deptConfig = dashboardState.departmentConfig;

  if (!deptConfig.sub_depts || deptConfig.sub_depts.length === 0) {
    elements.unitSelect.classList.add("hidden");
    return;
  }

  elements.unitSelect.classList.remove("hidden");
  elements.unitSelect.innerHTML = "";

  elements.unitSelect.appendChild(createUnitOption("", "All Units"));

  deptConfig.sub_depts.forEach((subDept, index) => {
    elements.unitSelect.appendChild(
      createUnitOption(index.toString(), subDept.name)
    );
  });

  elements.unitSelect.value =
    dashboardState.selectedUnit !== null
      ? dashboardState.selectedUnit.toString()
      : "";
}

function updateURL() {
  const urlParams = new URLSearchParams(window.location.search);

  // Update unit parameter
  if (dashboardState.selectedUnit !== null) {
    urlParams.set("unit", dashboardState.selectedUnit.toString());
  } else {
    urlParams.delete("unit");
  }

  // Update month parameter
  if (dashboardState.selectedMonth) {
    urlParams.set("month", dashboardState.selectedMonth);
  } else {
    urlParams.delete("month");
  }

  // Update the URL without refreshing the page
  const newURL = `${window.location.pathname}?${urlParams.toString()}`;
  window.history.replaceState({}, "", newURL);
}

function getFilteredWdIds() {
  const deptConfig = dashboardState.departmentConfig;

  // If no specific unit selected (i.e., "All Units" selected)
  if (dashboardState.selectedUnit === null) {
    // If department has sub_depts, return all wd_ids from all sub_depts
    if (deptConfig.sub_depts && deptConfig.sub_depts.length > 0) {
      return deptConfig.sub_depts.flatMap((subDept) => subDept.wd_ids || []);
    }
    // Otherwise, return the main department wd_ids
    return deptConfig.wd_ids || [];
  }

  // Return wd_ids for the selected sub-department
  const selectedSubDept = deptConfig.sub_depts[dashboardState.selectedUnit];
  return selectedSubDept ? selectedSubDept.wd_ids : [];
}

async function refreshData() {
  try {
    dashboardState.loading = true;
    dashboardState.error = null;
    updateUI();

    // Get fresh data for the new month without reinitializing the database
    const wd_ids = getFilteredWdIds();
    dashboardState.data = KPI_DATA.getDepartmentData(
      wd_ids,
      dashboardState.selectedMonth
    );
    dashboardState.loading = false;
    updateUI();
  } catch (error) {
    console.error("Error refreshing dashboard data:", error);
    dashboardState.error = error.message;
    dashboardState.loading = false;
    updateUI();
  }
}

function generateSubtitleText() {
  const monthStr = dashboardState.selectedMonth
    ? "Year to " + dayjs(dashboardState.selectedMonth).format("MMMM YYYY")
    : "";

  if (
    dashboardState.selectedUnit !== null &&
    dashboardState.departmentConfig?.sub_depts
  ) {
    const unitName =
      dashboardState.departmentConfig.sub_depts[dashboardState.selectedUnit]
        ?.name;
    if (unitName && monthStr) {
      return `${unitName} • ${monthStr}`;
    } else if (unitName) {
      return unitName;
    }
  }
  return monthStr;
}

function updateTitleAndSubtitle() {
  const deptStr = dashboardState.departmentConfig?.name || "Department";
  elements.title.textContent = `PRH - ${deptStr}`;
  elements.subtitle.textContent = generateSubtitleText();
}

function showLoadingState() {
  elements.loadingState.classList.remove("hidden");
  elements.errorState.classList.add("hidden");
  elements.dashboardContent.classList.add("hidden");
}

function showErrorState() {
  elements.loadingState.classList.add("hidden");
  elements.errorState.classList.remove("hidden");
  elements.dashboardContent.classList.add("hidden");
  elements.errorMessage.textContent = dashboardState.error;
}

function showDashboardContent() {
  elements.loadingState.classList.add("hidden");
  elements.errorState.classList.add("hidden");
  elements.dashboardContent.classList.remove("hidden");

  // Populate dashboard display
  metrics.populateFinancialMetrics(
    elements.financialMetrics,
    dashboardState.data
  );
  metrics.populateKPITable(elements.kpiTable, dashboardState.data);
  metrics.populateVolumeTable(elements.volumeTable, dashboardState.data);
  fig.populateVolumeChart(elements.volumeChart, dashboardState.data);
  fig.populateRevenueChart(elements.revenueChart, dashboardState.data);
  fig.populateProductivityChart(
    elements.productivityChart,
    dashboardState.data
  );
  populateIncomeStatement(elements.incomeStatement, dashboardState.data);
}

function updateUI() {
  updateTitleAndSubtitle();

  if (dashboardState.loading) {
    showLoadingState();
  } else if (dashboardState.error) {
    showErrorState();
  } else {
    showDashboardContent();
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
