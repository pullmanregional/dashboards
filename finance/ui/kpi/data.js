import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { transformIncomeStmtData } from "../income-stmt/income-stmt.js";
import dayjs from "dayjs";
import dayOfYear from "dayjs/plugin/dayOfYear";
dayjs.extend(dayOfYear);

// ------------------------------------------------------------
// Data classes
// ------------------------------------------------------------
// Immutable class for source data read from DB
class SourceData {
  constructor(data = {}) {
    this.lastUpdated = data.lastUpdated || null;
    this.volumes = data.volumes || null;
    this.uos = data.uos || null;
    this.budget = data.budget || null;
    this.hours = data.hours || null;
    this.contractedHours = data.contractedHours || null;
    this.incomeStmt = data.incomeStmt || null;
    this.contractedHoursUpdatedMonth = data.contractedHoursUpdatedMonth || null;
    Object.freeze(this);
  }
}

class DashboardData {
  constructor(data = {}) {
    this.volumes = data.volumes || null;
    this.uos = data.uos || null;
    this.hours = data.hours || null;
    this.budget = data.budget || null;
    this.contractedHours = data.contractedHours || null;
    this.incomeStmt = data.incomeStmt || null;
    this.contractedHoursUpdatedMonth = data.contractedHoursUpdatedMonth || null;
    this.stats = data.stats || null;
    Object.freeze(this);
  }
}

// ------------------------------------------------------------
// Utility functions to handle date based calculations
// ------------------------------------------------------------
function fteHrsInYear(year) {
  const FTE_HOURS_PER_YEAR = 2080;
  const FTE_HOURS_PER_LEAP_YEAR = 2088;
  const isLeapYear = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
  return isLeapYear ? FTE_HOURS_PER_LEAP_YEAR : FTE_HOURS_PER_YEAR;
}

// Given a month string in the format "2023-01", return the percentage of the year that has passed up to that date.
function pctOfYearThroughDate(monthStr) {
  const month = dayjs(monthStr);
  const daysThroughMonthEnd = month.endOf("month").dayOfYear();
  const daysInYear = month.endOf("year").dayOfYear();
  return daysThroughMonthEnd / daysInYear;
}

// ------------------------------------------------------------
// Default export, which provides underlying dashboard data
// ------------------------------------------------------------
class DashboardDataManager {
  constructor() {
    this.db = null;
    this.sqlite3 = null;
    this.sourceData = null;
    this.kvData = null;
    this.data = null;
    this.initialized = false;
    this.allFeedback = {}; // Store all feedback comments by month for current dept
  }

  // Initialize SQLite and load db from API. This should be called once at startup.
  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize SQLite WASM
      this.sqlite3 = await sqlite3InitModule({
        print: console.log,
        printErr: console.error,
      });
      console.log("SQLite initialized");

      // Fetch data from API endpoints
      await this.loadData();
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize data layer", error);
      throw error;
    }
  }

  // Fetch SQLite database
  async loadData() {
    try {
      const dbResponse = await fetch("/api/data");
      if (!dbResponse.ok) {
        throw new Error(`Failed to fetch database: ${dbResponse.statusText}`);
      }
      const dbArrayBuffer = await dbResponse.arrayBuffer();
      const dbUint8Array = new Uint8Array(dbArrayBuffer);

      // Load data into memory using the sqlite WASM API
      this.db = new this.sqlite3.oo1.DB(":memory:");
      const wasmPointer = this.sqlite3.wasm.allocFromTypedArray(dbUint8Array);
      const rc = this.sqlite3.capi.sqlite3_deserialize(
        this.db.pointer,
        "main",
        wasmPointer,
        dbUint8Array.length,
        dbUint8Array.length,
        this.sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE
      );
      if (rc) {
        throw new Error(`sqlite3_deserialize() failed with code ${rc}`);
      }
      console.log("Data loaded");

      // Read KV data from _kv table
      this.kvData = this.query("SELECT data FROM _kv LIMIT 1")[0]?.data;
      this.kvData = JSON.parse(this.kvData);
      console.log("KV data loaded");
    } catch (error) {
      console.error("Failed to load data:", error);
      throw error;
    }
  }

  // Execute SQL query and return results as array of objects
  query(sql, params = []) {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const results = [];
    this.db.exec({
      sql: sql,
      bind: params,
      rowMode: "object",
      resultRows: results,
    });
    return results;
  }

  // Read and cache source data from DB. Returns a SourceData object.
  getSourceData(wdIds) {
    if (!this.initialized) {
      throw new Error("Dashboard data not initialized");
    }

    if (!this.sourceData) {
      this.sourceData = new SourceData({
        lastUpdated: this.query("SELECT MAX(modified) as max_date FROM meta")[0]
          ?.max_date,
        volumes: this.query("SELECT * FROM volumes ORDER BY month DESC"),
        uos: this.query("SELECT * FROM uos ORDER BY month DESC"),
        budget: this.query("SELECT * FROM budget"),
        hours: this.query("SELECT * FROM hours ORDER BY month DESC"),
        contractedHours: this.query("SELECT * FROM contracted_hours"),
        incomeStmt: this.query("SELECT * FROM income_stmt ORDER BY month DESC"),
        contractedHoursUpdatedMonth:
          this.kvData?.contracted_hours_updated_month,
      });
    }

    // Filter data if specific department workday IDs provided
    if (wdIds) {
      const filterWdId = (row) => wdIds.includes(row.dept_wd_id);
      return new SourceData({
        volumes: this.sourceData.volumes.filter((row) => filterWdId(row)),
        uos: this.sourceData.uos.filter((row) => filterWdId(row)),
        hours: this.sourceData.hours.filter((row) => filterWdId(row)),
        budget: this.sourceData.budget.filter((row) => filterWdId(row)),
        incomeStmt: this.sourceData.incomeStmt.filter((row) => filterWdId(row)),
        contractedHours: this.sourceData.contractedHours.filter((row) =>
          filterWdId(row)
        ),
      });
    }
    return this.sourceData;
  }

  // Return start and end months where volumes, UOS, hours, and income statement are all available
  // Query database for info, which is orders of magnitude faster than sort/filtering in memory
  getAvailableMonths() {
    let firstMonth = null;
    let lastMonth = null;
    const tables = ["volumes", "uos", "hours", "income_stmt"];
    for (const table of tables) {
      const first = this.query(
        `SELECT month FROM ${table} ORDER BY month ASC limit 1`
      );
      const last = this.query(
        `SELECT month FROM ${table} ORDER BY month DESC limit 1`
      );
      if (
        firstMonth == null ||
        first?.[0].month.localeCompare(firstMonth) > 0
      ) {
        firstMonth = first[0]?.month;
      }
      if (lastMonth == null || last?.[0].month.localeCompare(lastMonth) < 0) {
        lastMonth = last[0]?.month;
      }
    }
    return { firstMonth, lastMonth };
  }

  // Process raw data into stats for the dashboard, selecting the specific department workday IDs and month
  processData(wdIds, month) {
    const sourceData = this.getSourceData(wdIds);

    // Calculate income statement
    const [year] = month.split("-");
    const incomeStmtData = sourceData.incomeStmt.filter(
      (row) => row.month === month
    );
    const incomeStmt = transformIncomeStmtData(incomeStmtData);

    // Calculate hours by month, which is used below for the hoursForMonth field as well
    const hoursByMonth = this.calcHoursByMonth(sourceData.hours);

    // Calculate scalar stats
    const stats = this.calculateStats(sourceData, incomeStmt, month);

    return new DashboardData({
      volumes: this.calcVolumeByMonth(sourceData.volumes),
      uos: this.calcVolumeByMonth(sourceData.uos),
      hours: hoursByMonth,
      hoursForMonth: hoursByMonth.find((row) => row.month === month),
      incomeStmt: incomeStmt,
      hoursYTM: this.calcHoursYTM(sourceData.hours, month),
      budget: sourceData.budget,
      contractedHours: sourceData.contractedHours,
      stats: stats,
    });
  }

  // Sort data object by it's month field, assuming string in YYYY-MM format. Returns array of objects.
  sortByMonth(data) {
    return data.sort((a, b) => a.month.localeCompare(b.month));
  }

  // Calculate volumes history (group by month, sum volume)
  calcVolumeByMonth(data) {
    const grouped = {};
    data.forEach((row) => {
      if (!grouped[row.month]) {
        grouped[row.month] = { month: row.month, volume: 0, unit: row.unit };
      }
      grouped[row.month].volume += row.volume || 0;
    });
    return this.sortByMonth(Object.values(grouped));
  }

  // Calculate hours by month - sum hours and recalculate FTE
  calcHoursByMonth(data) {
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
    return this.sortByMonth(Object.values(grouped));
  }

  // Calculate year-to-month hours. Month should be a string in YYYY-MM format.
  calcHoursYTM(data, month) {
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

    // Recalculate FTE for months after January. For Jan, just use data in the FTE column.
    const yearNum = parseInt(year);
    const monthNum = parseInt(month.split("-")[1]);
    if (monthNum > 1) {
      const fteHoursPerYear = fteHrsInYear(yearNum);
      const pctOfYearCompleted = pctOfYearThroughDate(month);
      sum.total_fte = sum.total_hrs / (fteHoursPerYear * pctOfYearCompleted);
    }

    return sum;
  }

  // Calculate key statistics and KPIs
  calculateStats(data, incomeStmt, month) {
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
      stats.ytmVolume = ytmData.reduce(
        (sum, row) => sum + (row.volume || 0),
        0
      );
      // Remove anything in parentheses from unit (same transformation as volumes card)
      let unit = volumes[0]?.unit || "Volume";
      unit = unit.replace(/\s*\([^)]*\)/g, "").trim();
      stats.volumeUnit = unit;
    }

    // Budget calculations
    const budgetSum = data.budget.reduce(
      (sum, row) => ({
        budget_fte: (sum.budget_fte || 0) + (row.budget_fte || 0),
        budget_prod_hrs:
          (sum.budget_prod_hrs || 0) + (row.budget_prod_hrs || 0),
        budget_volume: (sum.budget_volume || 0) + (row.budget_volume || 0),
        budget_uos: (sum.budget_uos || 0) + (row.budget_uos || 0),
        budget_prod_hrs_per_uos:
          (sum.budget_prod_hrs_per_uos || 0) +
          (row.budget_prod_hrs_per_uos || 0),
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

    // Get revenue and expense data from income statement (current year)
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

    // Calculate KPIs
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

    return stats;
  }

  // Load all feedback for a department
  async loadFeedbackForDept(dept) {
    try {
      const response = await fetch(`/api/feedback/${dept}`);
      if (!response.ok) {
        throw new Error(`Failed to load feedback: ${response.statusText}`);
      }
      const feedbackList = await response.json();

      // Store in cache indexed by month
      this.allFeedback = {};
      feedbackList.forEach((item) => {
        this.allFeedback[item.month] = item.comment || "";
      });
    } catch (error) {
      console.error("Error loading feedback:", error);
      this.allFeedback = {};
    }
  }

  // Get feedback for a specific month from cache
  getFeedbackForMonth(month) {
    return this.allFeedback[month] || "";
  }

  // Save feedback for a specific department and month
  async saveFeedback(dept, month, comment) {
    const response = await fetch(`/api/feedback/${dept}/${month}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save feedback: ${response.statusText}`);
    }

    this.allFeedback[month] = comment;
    return await response.json();
  }

  // Clean up resources
  destroy() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
    this.allFeedback = {};
  }
}

// Create singleton instance, import with import DATA from "./data.js";
export default new DashboardDataManager();
