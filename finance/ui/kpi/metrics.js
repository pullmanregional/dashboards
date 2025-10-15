import dayjs from "dayjs";
import {
  calcVariance,
  formatCurrency,
  formatCurrencyInThousands,
  formatNumber,
  formatVariancePct,
} from "../data/util.js";

// ------------------------------------------------------------
// Metrics displays
// ------------------------------------------------------------
function populateFinancialMetrics(metricEl, data, currentMonth) {
  const stats = data.stats;
  const ytdLabel = `Year to ${dayjs(currentMonth).format("MMM YYYY")}`;

  // Calculate variances
  const monthRevVariance = calcVariance(
    stats.monthRevenue,
    stats.monthBudgetRevenue
  );
  const monthExpVariance = calcVariance(
    stats.monthExpense,
    stats.monthBudgetExpense
  );
  const ytdRevVariance = calcVariance(stats.ytdRevenue, stats.ytdBudgetRevenue);
  const ytdExpVariance = calcVariance(stats.ytdExpense, stats.ytdBudgetExpense);

  // Format variances for display
  const monthRevVar = formatVariancePct(
    stats.monthRevenue,
    stats.monthBudgetRevenue
  );
  const monthExpVar = formatVariancePct(
    stats.monthExpense,
    stats.monthBudgetExpense
  );
  const ytdRevVar = formatVariancePct(stats.ytdRevenue, stats.ytdBudgetRevenue);
  const ytdExpVar = formatVariancePct(stats.ytdExpense, stats.ytdBudgetExpense);

  // Calculate Net values
  const monthNet = (stats.monthRevenue || 0) - (stats.monthExpense || 0);
  const monthBudgetNet =
    (stats.monthBudgetRevenue || 0) - (stats.monthBudgetExpense || 0);
  const monthNetVar = formatVariancePct(monthNet, monthBudgetNet);

  const ytdNet = (stats.ytdRevenue || 0) - (stats.ytdExpense || 0);
  const ytdBudgetNet =
    (stats.ytdBudgetRevenue || 0) - (stats.ytdBudgetExpense || 0);
  const ytdNetVar = formatVariancePct(ytdNet, ytdBudgetNet);

  // Update YTD label
  const ytdLabelEl = metricEl.querySelector("#ytd-label");
  if (ytdLabelEl) ytdLabelEl.textContent = ytdLabel;

  // Update Month metrics
  const monthRevenueMetric = metricEl.querySelector("#month-rev-metric");
  const monthExpenseMetric = metricEl.querySelector("#month-exp-metric");
  monthRevenueMetric.setAttribute("value", formatCurrency(stats.monthRevenue));
  monthRevenueMetric.setAttribute("variancePct", monthRevVariance.toString());
  monthRevenueMetric.roundToThousands = true;
  monthRevenueMetric.showVariance = false;
  monthExpenseMetric.setAttribute("value", formatCurrency(stats.monthExpense));
  monthExpenseMetric.setAttribute("variancePct", monthExpVariance.toString());
  monthExpenseMetric.roundToThousands = true;
  monthExpenseMetric.showVariance = false;

  // Update Month table values
  const monthRevenueActual = metricEl.querySelector("#month-rev-actual");
  const monthRevenueBudget = metricEl.querySelector("#month-rev-budget");
  const monthRevenueVariance = metricEl.querySelector("#month-rev-variance");
  monthRevenueActual.textContent = formatCurrency(stats.monthRevenue);
  monthRevenueBudget.textContent = formatCurrency(stats.monthBudgetRevenue);
  monthRevenueVariance.textContent = monthRevVar.value;

  const monthExpenseActual = metricEl.querySelector("#month-exp-actual");
  const monthExpenseBudget = metricEl.querySelector("#month-exp-budget");
  const monthExpenseVariance = metricEl.querySelector("#month-exp-variance");
  monthExpenseActual.textContent = formatCurrency(stats.monthExpense);
  monthExpenseBudget.textContent = formatCurrency(stats.monthBudgetExpense);
  monthExpenseBudget.textContent = formatCurrency(stats.monthBudgetExpense);
  monthExpenseVariance.textContent = monthExpVar.value;

  const monthNetActual = metricEl.querySelector("#month-net-actual");
  const monthNetBudget = metricEl.querySelector("#month-net-budget");
  const monthNetVariance = metricEl.querySelector("#month-net-variance");
  monthNetActual.textContent = formatCurrency(monthNet);
  monthNetBudget.textContent = formatCurrency(monthBudgetNet);
  monthNetVariance.textContent = monthNetVar.value;

  // Update YTD compact metrics
  const ytdRevenueMetric = metricEl.querySelector("#ytd-rev-metric");
  const ytdExpenseMetric = metricEl.querySelector("#ytd-exp-metric");
  ytdRevenueMetric.setAttribute("value", formatCurrency(stats.ytdRevenue));
  ytdRevenueMetric.setAttribute("value", formatCurrency(stats.ytdRevenue));
  ytdRevenueMetric.setAttribute("variancePct", ytdRevVariance.toString());
  ytdRevenueMetric.roundToThousands = true;
  ytdRevenueMetric.showVariance = true;
  ytdExpenseMetric.setAttribute("value", formatCurrency(stats.ytdExpense));
  ytdExpenseMetric.setAttribute("value", formatCurrency(stats.ytdExpense));
  ytdExpenseMetric.setAttribute("variancePct", ytdExpVariance.toString());
  ytdExpenseMetric.roundToThousands = true;
  ytdExpenseMetric.showVariance = true;

  // Update YTD table values
  const ytdRevenueActual = metricEl.querySelector("#ytd-rev-actual");
  const ytdRevenueBudget = metricEl.querySelector("#ytd-rev-budget");
  const ytdRevenueVariance = metricEl.querySelector("#ytd-rev-variance");
  ytdRevenueActual.textContent = formatCurrency(stats.ytdRevenue);
  ytdRevenueBudget.textContent = formatCurrency(stats.ytdBudgetRevenue);
  ytdRevenueVariance.textContent = ytdRevVar.value;

  const ytdExpenseActual = metricEl.querySelector("#ytd-exp-actual");
  const ytdExpenseBudget = metricEl.querySelector("#ytd-exp-budget");
  const ytdExpenseVariance = metricEl.querySelector("#ytd-exp-variance");
  ytdExpenseActual.textContent = formatCurrency(stats.ytdExpense);
  ytdExpenseBudget.textContent = formatCurrency(stats.ytdBudgetExpense);
  ytdExpenseVariance.textContent = ytdExpVar.value;

  const ytdNetActual = metricEl.querySelector("#ytd-net-actual");
  const ytdNetBudget = metricEl.querySelector("#ytd-net-budget");
  const ytdNetVariance = metricEl.querySelector("#ytd-net-variance");
  ytdNetActual.textContent = formatCurrency(ytdNet);
  ytdNetBudget.textContent = formatCurrency(ytdBudgetNet);
  ytdNetVariance.textContent = ytdNetVar.value;
}

function populateKPIMetrics(containerEl, data) {
  const stats = data.stats;
  const revenueVariance = stats.varianceRevenuePerVolume || 0;
  const expenseVariance = stats.varianceExpensePerVolume || 0;

  // Update Revenue per Volume metric
  const revenueMetric = containerEl.querySelector("#revenue-per-volume-metric");
  const unit = stats.volumeUnit.replace(/s$/, "") || "Volume";
  revenueMetric.setAttribute("title", `Revenue per ${unit}`);
  revenueMetric.setAttribute("value", formatCurrency(stats.revenuePerVolume));
  revenueMetric.setAttribute("variancePct", revenueVariance.toString());
  revenueMetric.setAttribute(
    "details",
    `Target: ${formatCurrency(stats.targetRevenuePerVolume)}`
  );

  // Update Expense per Volume metric
  const expenseMetric = containerEl.querySelector("#expense-per-volume-metric");
  expenseMetric.setAttribute("title", `Expense per ${unit}`);
  expenseMetric.setAttribute("value", formatCurrency(stats.expensePerVolume));
  expenseMetric.setAttribute("variancePct", expenseVariance.toString());
  expenseMetric.setAttribute(
    "details",
    `Target: ${formatCurrency(stats.targetExpensePerVolume)}`
  );

  // Update Revenue per UOS metric
  const revenueUOSMetric = containerEl.querySelector("#revenue-per-uos-metric");
  const uosUnit = stats.uosUnit || "UOS";
  const revenueUOSVariance = stats.varianceRevenuePerUOS || 0;
  revenueUOSMetric.setAttribute("title", `Revenue per ${uosUnit}`);
  revenueUOSMetric.setAttribute("value", formatCurrency(stats.revenuePerUOS));
  revenueUOSMetric.setAttribute("variancePct", revenueUOSVariance.toString());
  revenueUOSMetric.setAttribute(
    "details",
    `Target: ${formatCurrency(stats.targetRevenuePerUOS)}`
  );

  // Update Expense per UOS metric
  const expenseUOSMetric = containerEl.querySelector("#expense-per-uos-metric");
  const expenseUOSVariance = stats.varianceExpensePerUOS || 0;
  expenseUOSMetric.setAttribute("title", `Expense per ${uosUnit}`);
  expenseUOSMetric.setAttribute("value", formatCurrency(stats.expensePerUOS));
  expenseUOSMetric.setAttribute("variancePct", expenseUOSVariance.toString());
  expenseUOSMetric.setAttribute(
    "details",
    `Target: ${formatCurrency(stats.targetExpensePerUOS)}`
  );
}

function populateVolumeMetrics(metricEl, data, currentMonth) {
  const stats = data.stats;
  const volumes = data.volumes;

  // Get current month volume data to extract unit and actual volume
  const currentMonthVolume = volumes.find((row) => row.month === currentMonth);
  let unit = currentMonthVolume?.unit || "Volume";

  // Remove anything in parentheses from unit
  unit = unit.replace(/\s*\([^)]*\)/g, "").trim();

  // Calculate month and YTD volumes directly from volumes data
  const monthVolume = currentMonthVolume?.volume || 0;

  // Calculate YTD volume by summing all volumes in the current year up to current month
  const [year] = currentMonth.split("-");
  const ytdVolumes = volumes.filter(
    (row) => row.month.startsWith(year) && row.month <= currentMonth
  );
  const ytdVolume = ytdVolumes.reduce((sum, row) => sum + (row.volume || 0), 0);

  // Calculate variance based on budget_volume
  const monthVariance = stats.monthBudgetVolume
    ? calcVariance(monthVolume, stats.monthBudgetVolume)
    : 0;
  const ytdVariance = stats.ytmBudgetVolume
    ? calcVariance(ytdVolume, stats.ytmBudgetVolume)
    : 0;

  // Update Month volume metric
  const monthVolumeMetric = metricEl.querySelector("#month-volume-metric");
  monthVolumeMetric.setAttribute("title", `${unit} This Month`);
  monthVolumeMetric.setAttribute("value", formatNumber(monthVolume));
  monthVolumeMetric.setAttribute("variancePct", monthVariance.toString());
  monthVolumeMetric.showVariance = false;

  // Update YTD volume metric
  const ytdVolumeMetric = metricEl.querySelector("#ytd-volume-metric");
  ytdVolumeMetric.setAttribute("title", `${unit} YTD`);
  ytdVolumeMetric.setAttribute("value", formatNumber(ytdVolume));
  ytdVolumeMetric.setAttribute("variancePct", ytdVariance.toString());
  ytdVolumeMetric.showVariance = true;
}

function populateUOSMetrics(metricEl, data, currentMonth) {
  const stats = data.stats;
  const uosData = data.uos;

  // Get current month UOS data to extract unit and actual UOS
  const currentMonthUOS = uosData.find((row) => row.month === currentMonth);
  let unit = currentMonthUOS?.unit || "UOS";

  // Calculate month and YTD UOS directly from UOS data
  const monthUOS = currentMonthUOS?.volume || 0;

  // Calculate YTD UOS by summing all UOS in the current year up to current month
  const [year] = currentMonth.split("-");
  const ytdUOSData = uosData.filter(
    (row) => row.month.startsWith(year) && row.month <= currentMonth
  );
  const ytdUOS = ytdUOSData.reduce((sum, row) => sum + (row.volume || 0), 0);

  // Calculate variance based on budget_uos
  const monthVariance = stats.monthBudgetUOS
    ? calcVariance(monthUOS, stats.monthBudgetUOS)
    : 0;
  const ytdVariance = stats.ytmBudgetUOS
    ? calcVariance(ytdUOS, stats.ytmBudgetUOS)
    : 0;

  // Update Month UOS metric
  const monthUOSMetric = metricEl.querySelector("#month-uos-metric");
  monthUOSMetric.setAttribute("title", `${unit} This Month`);
  monthUOSMetric.setAttribute("value", formatNumber(monthUOS, 0));
  monthUOSMetric.setAttribute("variancePct", monthVariance.toString());
  monthUOSMetric.showVariance = false;

  // Update YTD UOS metric
  const ytdUOSMetric = metricEl.querySelector("#ytd-uos-metric");
  ytdUOSMetric.setAttribute("title", `${unit} YTD`);
  ytdUOSMetric.setAttribute("value", formatNumber(ytdUOS, 0));
  ytdUOSMetric.setAttribute("variancePct", ytdVariance.toString());
  ytdUOSMetric.showVariance = false;
}

function populateProductivityMetrics(metricEl, data, currentMonth) {
  const stats = data.stats;
  const contractedHours = data.contractedHours || [];

  // Get FTE for YTD
  const fte = data.hoursYTM.total_fte || 0;
  const budgetFTE = stats.budgetFTE || 0;
  const fteVariance = budgetFTE ? calcVariance(fte, budgetFTE) : 0;

  // Calculate Overtime % (overtime / (regular + overtime) * 100)
  const hoursForMonth = data.hoursForMonth;
  const regHours = hoursForMonth.reg_hrs || 0;
  const overtimeHours = hoursForMonth.overtime_hrs || 0;
  const totalProductiveHours = regHours + overtimeHours;
  const overtimePercent =
    totalProductiveHours > 0 ? (overtimeHours / totalProductiveHours) * 100 : 0;

  // Calculate Traveler FTE from contracted hours for current year
  const [year, monthNum] = currentMonth.split("-");
  const yearNum = parseInt(year);
  const currentYearContracted = contractedHours.find(
    (row) => row.year === yearNum
  );
  const contractedHoursTotal = currentYearContracted?.hrs || 0;

  // Divide by months elapsed in the year to get average monthly hours, then convert to FTE
  // Assume 173.33 hours per month per FTE (2080 hours/year / 12 months)
  const monthsElapsed = parseInt(monthNum);
  const avgMonthlyContractedHours = contractedHoursTotal / monthsElapsed;
  const travelerFTE = avgMonthlyContractedHours / 173.33;

  // Update FTE metric
  const fteMetric = metricEl.querySelector("#fte-metric");
  fteMetric.setAttribute("value", formatNumber(fte, 1));
  fteMetric.setAttribute("variancePct", fteVariance.toString());
  fteMetric.showVariance = true;

  // Update Overtime metric (no variance indicator)
  const overtimeMetric = metricEl.querySelector("#overtime-metric");
  overtimeMetric.setAttribute("value", formatNumber(overtimePercent, 1) + "%");
  overtimeMetric.showVariance = false;

  // Update Traveler FTE metric (no variance indicator)
  const travelerFteMetric = metricEl.querySelector("#traveler-fte-metric");
  travelerFteMetric.setAttribute("value", formatNumber(travelerFTE, 1));
  travelerFteMetric.showVariance = false;
}

export {
  populateFinancialMetrics,
  populateKPIMetrics,
  populateVolumeMetrics,
  populateUOSMetrics,
  populateProductivityMetrics,
};
