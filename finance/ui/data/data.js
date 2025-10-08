import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { transformIncomeStmtData } from "../income-stmt/income-stmt.js";
import {
  calcBalanceSheet,
  calcVolumeByMonth,
  calcHoursByMonth,
  calcHoursYTM,
  calculateStats,
} from "./stats.js";

// ------------------------------------------------------------
// Data classes
// ------------------------------------------------------------
// Immutable class for source data read from DB after filtering by wdIds
class SourceData {
  constructor(data = {}) {
    this.lastUpdated = data.lastUpdated || null;
    this.volumes = data.volumes || null;
    this.uos = data.uos || null;
    this.budget = data.budget || null;
    this.hours = data.hours || null;
    this.contractedHours = data.contractedHours || null;
    this.incomeStmt = data.incomeStmt || null;
    this.balanceSheet = data.balanceSheet || null;
    this.agedAR = data.agedAR || null;
    this.contractedHoursUpdatedMonth = data.contractedHoursUpdatedMonth || null;
    Object.freeze(this);
  }
}

// Contains data for populating dashboard UI
class DashboardData {
  constructor(data = {}) {
    this.volumes = data.volumes || null;
    this.uos = data.uos || null;
    this.hours = data.hours || null;
    this.hoursForMonth = data.hoursForMonth || null;
    this.hoursYTM = data.hoursYTM || null;
    this.budget = data.budget || null;
    this.contractedHours = data.contractedHours || null;
    this.incomeStmt = data.incomeStmt || null;
    this.balanceSheet = data.balanceSheet || null;
    this.agedAR = data.agedAR || null;
    this.contractedHoursUpdatedMonth = data.contractedHoursUpdatedMonth || null;
    this.stats = data.stats || null;
    Object.freeze(this);
  }
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
        balanceSheet: this.query(
          "SELECT * FROM balance_sheet ORDER BY month DESC"
        ),
        agedAR: this.query("SELECT * FROM aged_ar"),
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
        balanceSheet: this.sourceData.balanceSheet,
        agedAR: this.sourceData.agedAR,
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

    // Calculate balance sheet data
    const balanceSheet = calcBalanceSheet(month, sourceData.balanceSheet);

    // Calculate hours by month, which is used below for the hoursForMonth field as well
    const hoursByMonth = calcHoursByMonth(sourceData.hours);

    // Calculate scalar stats
    const stats = calculateStats(sourceData, incomeStmt, month);

    return new DashboardData({
      volumes: calcVolumeByMonth(sourceData.volumes),
      uos: calcVolumeByMonth(sourceData.uos),
      hours: hoursByMonth,
      hoursForMonth: hoursByMonth.find((row) => row.month === month) || [],
      incomeStmt: incomeStmt,
      balanceSheet: balanceSheet,
      hoursYTM: calcHoursYTM(sourceData.hours, month),
      budget: sourceData.budget,
      contractedHours: sourceData.contractedHours,
      stats: stats,
    });
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
      const allFeedback = {};
      const deptFeedback = {};
      allFeedback[dept] = deptFeedback;
      feedbackList.forEach((item) => {
        deptFeedback[item.month] = item.comment || "";
      });
      this.allFeedback = allFeedback;
    } catch (error) {
      console.error("Error loading feedback:", error);
      this.allFeedback = {};
    }
  }

  // Load all feedback comments for all departments
  async loadAllFeedback() {
    try {
      const response = await fetch("/api/feedback");
      if (!response.ok) {
        throw new Error(`Failed to load feedback: ${response.statusText}`);
      }
      const feedbackList = await response.json();

      // Store feedback indexed by dept and month
      const allFeedback = {};
      feedbackList.forEach((item) => {
        const deptFeedback = allFeedback[item.dept] || {};
        deptFeedback[item.month] = item.comment || "";
        allFeedback[item.dept] = deptFeedback;
      });
      this.allFeedback = allFeedback;
    } catch (error) {
      console.error("Error loading feedback:", error);
      this.allFeedback = {};
    }
  }

  // Get feedback for a specific month from cache
  getFeedbackForMonth(dept, month) {
    return this.allFeedback[dept]?.[month] || "";
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

// Create singleton instance, import with import DATA from "../data/data.js";
export default new DashboardDataManager();
