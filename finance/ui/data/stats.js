import dayjs from "dayjs";
import { fteHrsInYear, pctOfYearThroughDate } from "./util.js";
import { transformIncomeStmtData } from "../income-stmt/income-stmt.js";

// ------------------------------------------------------------
// Data aggregation functions
// ------------------------------------------------------------
// Sort data by month field (YYYY-MM format)
export function sortByMonth(data) {
  return data.sort((a, b) => a.month.localeCompare(b.month));
}

// Calculate volume by month (group by month, sum volume)
export function calcVolumeByMonth(data) {
  const grouped = {};
  data.forEach((row) => {
    if (!grouped[row.month]) {
      grouped[row.month] = { month: row.month, volume: 0, unit: row.unit };
    }
    grouped[row.month].volume += row.volume || 0;
  });
  return sortByMonth(Object.values(grouped));
}

// Calculate hours by month (sum hours and recalculate FTE)
export function calcHoursByMonth(data) {
  const grouped = {};
  data.forEach((row) => {
    if (!grouped[row.month]) {
      grouped[row.month] = {
        month: row.month,
        prod_hrs: 0,
        nonprod_hrs: 0,
        total_hrs: 0,
        total_fte: 0,
        reg_hrs: 0,
        overtime_hrs: 0,
      };
    }
    grouped[row.month].prod_hrs += row.prod_hrs || 0;
    grouped[row.month].nonprod_hrs += row.nonprod_hrs || 0;
    grouped[row.month].total_hrs += row.total_hrs || 0;
    grouped[row.month].total_fte += row.total_fte || 0;
    grouped[row.month].reg_hrs += row.reg_hrs || 0;
    grouped[row.month].overtime_hrs += row.overtime_hrs || 0;
  });
  return sortByMonth(Object.values(grouped));
}

// Calculate year-to-month hours for given month (YYYY-MM format)
export function calcHoursYTM(data, month) {
  const [year] = month.split("-");
  const ytmData = data.filter(
    (row) => row.month.startsWith(year) && row.month.localeCompare(month) <= 0
  );

  if (ytmData.length === 0) return {};

  const sum = ytmData.reduce(
    (total, row) => ({
      reg_hrs: (total.reg_hrs || 0) + (row.reg_hrs || 0),
      overtime_hrs: (total.overtime_hrs || 0) + (row.overtime_hrs || 0),
      prod_hrs: (total.prod_hrs || 0) + (row.prod_hrs || 0),
      nonprod_hrs: (total.nonprod_hrs || 0) + (row.nonprod_hrs || 0),
      total_hrs: (total.total_hrs || 0) + (row.total_hrs || 0),
      total_fte: (total.total_fte || 0) + (row.total_fte || 0),
    }),
    {}
  );

  // Recalculate FTE for months after January using prorated annual hours
  const yearNum = parseInt(year);
  const monthNum = parseInt(month.split("-")[1]);
  if (monthNum > 1) {
    const fteHoursPerYear = fteHrsInYear(yearNum);
    const pctOfYearCompleted = pctOfYearThroughDate(month);
    sum.total_fte = sum.total_hrs / (fteHoursPerYear * pctOfYearCompleted);
  }

  return sum;
}

function calcAvgRevAndExpense(incomeStmtData, month, numMonths = 3) {
  // Filter income statment data to the prior numMonths from the given month
  const endMonth = dayjs(month).endOf("month");
  const startMonth = dayjs(month)
    .subtract(numMonths - 1, "months")
    .startOf("month");
  const endMonthStr = endMonth.format("YYYY-MM");
  const startMonthStr = startMonth.format("YYYY-MM");
  const numDays = dayjs(endMonth).diff(dayjs(startMonth), "days") + 1;
  incomeStmtData = incomeStmtData.filter(
    (row) =>
      startMonthStr.localeCompare(row.month) <= 0 &&
      endMonthStr.localeCompare(row.month) >= 0
  );

  // Get the overall income statement and calculate rolling average
  const incomeStmt = transformIncomeStmtData(incomeStmtData);
  const ptRev = incomeStmt.reduce(
    (ttl, r) => ttl + (r.tree.match(/^Patient Revenues\|/) ? r.Actual || 0 : 0),
    0
  );
  const ttlExpense = incomeStmt.find(
    (row) => row.tree === "Total Operating Expenses"
  )?.["Actual"];
  const depreciation = incomeStmt.reduce(
    (ttl, r) =>
      ttl +
      (r.tree.match(/^Other Direct Expenses\|Depreciation\|/)
        ? r.Actual || 0
        : 0),
    0
  );
  const expMinusDeprec = ttlExpense - depreciation;
  const avgDailyRevenue = (ptRev || 0) / numDays;
  const avgDailyExpenses = (expMinusDeprec || 0) / numDays;
  return { avgDailyRevenue, avgDailyExpenses };
}

// ------------------------------------------------------------
// Trend calculation functions
// ------------------------------------------------------------
// Calculate volume trend for last 12 months ending at given month
export function calculateVolumeTrend(volumes, endMonth) {
  const trend = [];
  let date = dayjs(endMonth);

  for (let i = 0; i < 12; i++) {
    const monthStr = date.format("YYYY-MM");
    const volumeData = volumes.find((v) => v.month === monthStr);
    trend.unshift({
      month: monthStr,
      value: volumeData?.volume || 0,
    });
    date = date.subtract(1, "month");
  }

  return trend;
}

// Calculate FTE trend for last 12 months ending at given month
export function calculateFTETrend(hours, endMonth) {
  const trend = [];
  let date = dayjs(endMonth);

  for (let i = 0; i < 12; i++) {
    const monthStr = date.format("YYYY-MM");
    const hoursData = hours.find((h) => h.month === monthStr);
    trend.unshift({
      month: monthStr,
      value: hoursData?.total_fte || 0,
    });
    date = date.subtract(1, "month");
  }

  return trend;
}

// ------------------------------------------------------------
// KPI calculation functions
// ------------------------------------------------------------
// Calculate key statistics and KPIs from source data
export function calculateStats(data, incomeStmt, balanceSheet, agedAR, month) {
  const [yearNum, monthNum] = month.split("-").map(Number);
  const stats = {};

  // Volume calculations
  const volumes = data.volumes;

  if (volumes.length > 0) {
    const currentMonth = volumes.find((row) => row.month === month);
    const ytmData = volumes.filter(
      (row) => row.month.startsWith(yearNum.toString()) && row.month <= month
    );

    stats.monthVolume = currentMonth?.volume || 0;
    stats.ytmVolume = ytmData.reduce((sum, row) => sum + (row.volume || 0), 0);
    // Remove anything in parentheses from unit
    let unit = volumes[0]?.unit || "Volume";
    unit = unit.replace(/\s*\([^)]*\)/g, "").trim();
    stats.volumeUnit = unit;
  }

  // Budget calculations
  const budgetSum = data.budget.reduce(
    (sum, row) => ({
      budget_fte: (sum.budget_fte || 0) + (row.budget_fte || 0),
      budget_prod_hrs: (sum.budget_prod_hrs || 0) + (row.budget_prod_hrs || 0),
      budget_volume: (sum.budget_volume || 0) + (row.budget_volume || 0),
      budget_uos: (sum.budget_uos || 0) + (row.budget_uos || 0),
      budget_prod_hrs_per_uos:
        (sum.budget_prod_hrs_per_uos || 0) + (row.budget_prod_hrs_per_uos || 0),
      hourly_rate: (sum.hourly_rate || 0) + (row.hourly_rate || 0),
    }),
    {}
  );

  // Recalculate averages for multiple departments
  if (data.budget.length > 1) {
    budgetSum.budget_prod_hrs_per_uos =
      budgetSum.budget_prod_hrs /
      Math.max(budgetSum.budget_uos, budgetSum.budget_volume, 1);
    budgetSum.hourly_rate = budgetSum.hourly_rate / data.budget.length;
  }

  stats.budgetFTE = budgetSum.budget_fte;
  stats.monthBudgetVolume = budgetSum.budget_volume / 12;
  stats.ytmBudgetVolume = budgetSum.budget_volume * (monthNum / 12);

  // Extract revenue and expense data from income statement
  stats.ytdRevenue = incomeStmt.find((row) => row.tree === "Net Revenue")?.[
    "YTD Actual"
  ];
  stats.ytdBudgetRevenue = incomeStmt.find(
    (row) => row.tree === "Net Revenue"
  )?.["YTD Budget"];
  stats.ytdExpense = incomeStmt.find(
    (row) => row.tree === "Total Operating Expenses"
  )?.["YTD Actual"];
  stats.ytdBudgetExpense = incomeStmt.find(
    (row) => row.tree === "Total Operating Expenses"
  )?.["YTD Budget"];

  // Month data from income statement
  stats.monthRevenue = incomeStmt.find((row) => row.tree === "Net Revenue")?.[
    "Actual"
  ];
  stats.monthBudgetRevenue = incomeStmt.find(
    (row) => row.tree === "Net Revenue"
  )?.["Budget"];
  stats.monthExpense = incomeStmt.find(
    (row) => row.tree === "Total Operating Expenses"
  )?.["Actual"];
  stats.monthBudgetExpense = incomeStmt.find(
    (row) => row.tree === "Total Operating Expenses"
  )?.["Budget"];

  // Days of cash available and in AR. Calculated based on total cash on balance sheet and aged AR.
  const ttlCash =
    balanceSheet.find(
      (row) =>
        row.tree === "Assets|Current Assets|Cash and Short Term Investments"
    )?.actual || 0;
  const ttlAR = agedAR.total || 0;
  const { avgDailyRevenue, avgDailyExpenses } = calcAvgRevAndExpense(
    // provide all raw income statement data for all months, to calculate rolling 3 month average
    data.incomeStmt,
    month
  );
  stats.avgDailyRevenue = avgDailyRevenue;
  stats.avgDailyExpenses = avgDailyExpenses;
  stats.ttlCash = ttlCash;
  stats.daysCash = avgDailyExpenses
    ? Math.floor(ttlCash / avgDailyExpenses)
    : 0;
  stats.ttlAR = ttlAR;
  stats.daysAR = avgDailyRevenue ? Math.floor(ttlAR / avgDailyRevenue) : 0;

  // UOS calculations
  const uosData = data.uos;

  if (uosData.length > 0) {
    const currentMonthUOS = uosData.find((row) => row.month === month);
    const ytmUOSData = uosData.filter(
      (row) => row.month.startsWith(yearNum.toString()) && row.month <= month
    );

    stats.monthUOS = currentMonthUOS?.volume || 0;
    stats.ytmUOS = ytmUOSData.reduce((sum, row) => sum + (row.volume || 0), 0);
    // Remove anything in parentheses from unit
    let uosUnit = uosData[0]?.unit || "UOS";
    uosUnit = uosUnit.replace(/\s*\([^)]*\)/g, "").trim();
    stats.uosUnit = uosUnit;
  }

  // Budget UOS calculations
  stats.monthBudgetUOS = budgetSum.budget_uos / 12;
  stats.ytmBudgetUOS = budgetSum.budget_uos * (monthNum / 12);

  // Calculate KPIs - Volume based
  const kpiVolume = stats.ytmVolume || 1;
  stats.revenuePerVolume = stats.ytdRevenue / kpiVolume;
  stats.expensePerVolume = stats.ytdExpense / kpiVolume;

  if (stats.ytdBudgetRevenue && stats.ytmBudgetVolume) {
    stats.targetRevenuePerVolume =
      stats.ytdBudgetRevenue / stats.ytmBudgetVolume;
    stats.varianceRevenuePerVolume = Math.trunc(
      (stats.revenuePerVolume / stats.targetRevenuePerVolume - 1) * 100
    );
  }

  if (stats.ytdBudgetExpense && stats.ytmBudgetVolume) {
    stats.targetExpensePerVolume =
      stats.ytdBudgetExpense / stats.ytmBudgetVolume;
    stats.varianceExpensePerVolume = Math.trunc(
      (stats.expensePerVolume / stats.targetExpensePerVolume - 1) * 100
    );
  }

  // Calculate KPIs - UOS based
  const kpiUOS = stats.ytmUOS || 1;
  stats.revenuePerUOS = stats.ytdRevenue / kpiUOS;
  stats.expensePerUOS = stats.ytdExpense / kpiUOS;

  if (stats.ytdBudgetRevenue && stats.ytmBudgetUOS) {
    stats.targetRevenuePerUOS = stats.ytdBudgetRevenue / stats.ytmBudgetUOS;
    stats.varianceRevenuePerUOS = Math.trunc(
      (stats.revenuePerUOS / stats.targetRevenuePerUOS - 1) * 100
    );
  }

  if (stats.ytdBudgetExpense && stats.ytmBudgetUOS) {
    stats.targetExpensePerUOS = stats.ytdBudgetExpense / stats.ytmBudgetUOS;
    stats.varianceExpensePerUOS = Math.trunc(
      (stats.expensePerUOS / stats.targetExpensePerUOS - 1) * 100
    );
  }

  return stats;
}
