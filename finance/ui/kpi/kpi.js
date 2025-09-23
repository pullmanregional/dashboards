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

// Dashboard state
let dashboardState = {
  loading: true,
  error: null,
  data: null,
  departmentId: null,
  departmentConfig: null,
  selectedMonth: null, // Will be set to latest available month after data loads
};

// HTML elements
const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");
const loadingStateEl = document.getElementById("loading-state");
const errorStateEl = document.getElementById("error-state");
const errorMessageEl = document.getElementById("error-message");
const dashboardContentEl = document.getElementById("dashboard-content");
const financialMetricsEl = document.getElementById("financial-metrics");
const kpiTableEl = document.getElementById("kpi-table");
const volumeTableEl = document.getElementById("volume-chart");
const backButtonEl = document.getElementById("back-button");
const retryButtonEl = document.getElementById("retry-button");
const volumeChartEl = document.getElementById("volume-chart");
const revenueChartEl = document.getElementById("revenue-chart");
const productivityChartEl = document.getElementById("productivity-chart");
const timePeriodSelectEl = document.getElementById("time-period-select");
const incomeStatementEl = document.getElementById("income-statement");

// ------------------------------------------------------------
// UI initialization
// ------------------------------------------------------------
async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const deptId = urlParams.get("dept");

  // Redirect to dashboard index if invalid department
  const deptConfig = getDepartmentConfig(deptId);
  if (!deptId || !deptConfig) {
    window.location.href = "index.html";
    return;
  }
  dashboardState.departmentId = deptId;
  dashboardState.departmentConfig = deptConfig;

  // Set up event listeners
  backButtonEl.addEventListener("click", () => {
    window.location.href = "index.html";
  });
  retryButtonEl.addEventListener("click", loadData);
  timePeriodSelectEl.addEventListener("change", handleTimePeriodChange);

  // Load and display dashboard data
  await loadData();
}

async function loadData() {
  try {
    dashboardState.loading = true;
    dashboardState.error = null;
    updateUI();

    await KPI_DATA.initialize();

    populateTimePeriodSelector(KPI_DATA);

    dashboardState.data = KPI_DATA.getDepartmentData(
      dashboardState.departmentConfig.wd_ids,
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

function populateTimePeriodSelector(kpiData) {
  const { firstMonth, lastMonth } = kpiData.getAvailableMonths();

  if (!firstMonth || !firstMonth) {
    timePeriodSelectEl.innerHTML = "No data available";
    return;
  }

  // Calculate months from last month to first month in format YYYY-MM
  const monthOptions = [];
  let curDate = dayjs(lastMonth);
  const startDate = dayjs(firstMonth);
  do {
    monthOptions.push(curDate.format("YYYY-MM"));
    curDate = curDate.subtract(1, "month");
  } while (curDate.isAfter(startDate));

  // Add options for each available month
  timePeriodSelectEl.innerHTML = "";
  monthOptions.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = dayjs(month).format("MMM YYYY");
    timePeriodSelectEl.appendChild(option);
  });

  // Set the selected month to the latest available if not already set
  if (!dashboardState.selectedMonth && monthOptions.length > 0) {
    dashboardState.selectedMonth = monthOptions[0];
  }

  // Set the selected value to the current selected month
  timePeriodSelectEl.value = dashboardState.selectedMonth;
}

async function handleTimePeriodChange(event) {
  const newMonth = event.target.value;
  if (newMonth !== dashboardState.selectedMonth) {
    dashboardState.selectedMonth = newMonth;
    await refreshData();
  }
}

async function refreshData() {
  try {
    dashboardState.loading = true;
    dashboardState.error = null;
    updateUI();

    // Get fresh data for the new month without reinitializing the database
    dashboardState.data = KPI_DATA.getDepartmentData(
      dashboardState.departmentConfig.wd_ids,
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

function updateUI() {
  // Update title / subtitle
  const deptStr = dashboardState.departmentConfig?.name || "Department";
  const monthStr = dashboardState.selectedMonth
    ? "Year to " + dayjs(dashboardState.selectedMonth).format("MMMM YYYY")
    : "";
  titleEl.textContent = `PRH - ${deptStr}`;
  subtitleEl.textContent = monthStr;

  // Show/hide loading/error/success states
  if (dashboardState.loading) {
    loadingStateEl.classList.remove("hidden");
    errorStateEl.classList.add("hidden");
    dashboardContentEl.classList.add("hidden");
  } else if (dashboardState.error) {
    loadingStateEl.classList.add("hidden");
    errorStateEl.classList.remove("hidden");
    dashboardContentEl.classList.add("hidden");
    errorMessageEl.textContent = dashboardState.error;
  } else {
    loadingStateEl.classList.add("hidden");
    errorStateEl.classList.add("hidden");
    dashboardContentEl.classList.remove("hidden");

    // Populate dashboard display
    metrics.populateFinancialMetrics(financialMetricsEl, dashboardState.data);
    metrics.populateKPITable(kpiTableEl, dashboardState.data);
    metrics.populateVolumeTable(volumeTableEl, dashboardState.data);
    fig.populateVolumeChart(volumeChartEl, dashboardState.data);
    fig.populateRevenueChart(revenueChartEl, dashboardState.data);
    fig.populateProductivityChart(productivityChartEl, dashboardState.data);
    populateIncomeStatement(incomeStatementEl, dashboardState.data);
    console.log(incomeStatementEl.data);
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
