import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

class KPIData {
  constructor() {
    this.db = null;
    this.sqlite3 = null;
    this.kvData = null;
    this.initialized = false;
  }

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
      console.error("Failed to initialize DataService:", error);
      throw error;
    }
  }

  async loadData() {
    try {
      // Fetch SQLite database
      const dbResponse = await fetch("/api/data");
      if (!dbResponse.ok) {
        throw new Error(`Failed to fetch database: ${dbResponse.statusText}`);
      }
      const dbArrayBuffer = await dbResponse.arrayBuffer();
      const dbUint8Array = new Uint8Array(dbArrayBuffer);

      // Create database using the OpfsDb which handles binary data properly
      if (this.sqlite3.opfs) {
        // Use OPFS (Origin Private File System) database
        this.db = new this.sqlite3.opfs.OpfsDb("/finance.db");
        await this.db.importDb(dbUint8Array);
      } else {
        // Fallback to in-memory database with manual loading
        this.db = new this.sqlite3.oo1.DB(":memory:");

        // Load data using the low-level API
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
      }

      console.log("Database loaded successfully");

      // Fetch KV data
      const kvResponse = await fetch("/api/kvdata");
      if (!kvResponse.ok) {
        throw new Error(`Failed to fetch KV data: ${kvResponse.statusText}`);
      }
      this.kvData = await kvResponse.json();
      console.log("KV data loaded successfully");
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

  getSourceData() {
    if (!this.initialized) {
      throw new Error("Dashboard data not initialized");
    }

    return {
      lastUpdated: this.query("SELECT MAX(modified) as max_date FROM meta")[0]
        ?.max_date,
      volumes: this.query("SELECT * FROM volumes ORDER BY month DESC"),
      uos: this.query("SELECT * FROM uos ORDER BY month DESC"),
      budget: this.query("SELECT * FROM budget"),
      hours: this.query("SELECT * FROM hours ORDER BY month DESC"),
      contractedHours: this.query("SELECT * FROM contracted_hours"),
      incomeStatement: this.query(
        "SELECT * FROM income_stmt ORDER BY month DESC"
      ),
      contractedHoursUpdatedMonth: this.kvData?.contracted_hours_updated_month,
    };
  }

  getAvailableMonths() {
    // Return start and end months where Volumes, UOS, and Hours are all available
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
      if (first.length === 0 || last.length === 0) {
        return { first_month, last_month };
      }
      if (firstMonth == null || first[0].month.localeCompare(firstMonth) > 0) {
        firstMonth = first[0].month;
      }
      if (lastMonth == null || last[0].month.localeCompare(lastMonth) < 0) {
        lastMonth = last[0].month;
      }
    }
    return { firstMonth, lastMonth };
  }

  // Get department data filtered by department IDs and month
  getDepartmentData(deptIds, selectedMonth) {
    const sourceData = this.getSourceData();

    // Filter data by department IDs
    const volumes = sourceData.volumes.filter((row) =>
      deptIds.includes(row.dept_wd_id)
    );
    const uos = sourceData.uos.filter((row) =>
      deptIds.includes(row.dept_wd_id)
    );
    const hours = sourceData.hours.filter((row) =>
      deptIds.includes(row.dept_wd_id)
    );
    const budget = sourceData.budget.filter((row) =>
      deptIds.includes(row.dept_wd_id)
    );
    const incomeStatement = sourceData.incomeStatement.filter((row) =>
      deptIds.includes(row.dept_wd_id)
    );
    const contractedHours = sourceData.contractedHours.filter((row) =>
      deptIds.includes(row.dept_wd_id)
    );

    return {
      volumes: this.calculateVolumesHistory(volumes),
      uos: this.calculateVolumesHistory(uos),
      hours: this.calculateHoursHistory(hours),
      incomeStatement: this.calculateIncomeStatementForMonth(
        incomeStatement,
        selectedMonth
      ),
      hoursForMonth: this.calculateHoursForMonth(hours, selectedMonth),
      hoursYTM: this.calculateHoursYTM(hours, selectedMonth),
      budget: budget,
      contractedHours: contractedHours,
      stats: this.calculateStats(deptIds, selectedMonth, {
        volumes,
        uos,
        hours,
        budget,
        incomeStatement,
        contractedHours,
      }),
    };
  }

  // Calculate volumes history (group by month, sum volume)
  calculateVolumesHistory(data) {
    const grouped = {};
    data.forEach((row) => {
      if (!grouped[row.month]) {
        grouped[row.month] = { month: row.month, volume: 0, unit: row.unit };
      }
      grouped[row.month].volume += row.volume || 0;
    });

    return Object.values(grouped).sort((a, b) =>
      b.month.localeCompare(a.month)
    );
  }

  // Calculate hours history
  calculateHoursHistory(data) {
    const grouped = {};
    data.forEach((row) => {
      if (!grouped[row.month]) {
        grouped[row.month] = {
          month: row.month,
          prod_hrs: 0,
          nonprod_hrs: 0,
          total_hrs: 0,
          total_fte: 0,
        };
      }
      grouped[row.month].prod_hrs += row.prod_hrs || 0;
      grouped[row.month].nonprod_hrs += row.nonprod_hrs || 0;
      grouped[row.month].total_hrs += row.total_hrs || 0;
      grouped[row.month].total_fte += row.total_fte || 0;
    });

    return Object.values(grouped).sort((a, b) =>
      a.month.localeCompare(b.month)
    );
  }

  // Calculate hours for specific month
  calculateHoursForMonth(data, month) {
    const monthData = data.filter((row) => row.month === month);
    if (monthData.length === 0) return {};

    return monthData.reduce(
      (sum, row) => ({
        reg_hrs: (sum.reg_hrs || 0) + (row.reg_hrs || 0),
        overtime_hrs: (sum.overtime_hrs || 0) + (row.overtime_hrs || 0),
        prod_hrs: (sum.prod_hrs || 0) + (row.prod_hrs || 0),
        nonprod_hrs: (sum.nonprod_hrs || 0) + (row.nonprod_hrs || 0),
        total_hrs: (sum.total_hrs || 0) + (row.total_hrs || 0),
        total_fte: (sum.total_fte || 0) + (row.total_fte || 0),
      }),
      {}
    );
  }

  // Calculate year-to-month hours
  calculateHoursYTM(data, month) {
    const [year] = month.split("-");
    const ytmData = data.filter(
      (row) => row.month.startsWith(year) && row.month <= month
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

    // Recalculate FTE for months after January
    const monthNum = parseInt(month.split("-")[1]);
    if (monthNum > 1) {
      const fteHoursPerYear = 2080; // Standard FTE hours per year
      const pctOfYearCompleted = monthNum / 12;
      sum.total_fte = sum.total_hrs / (fteHoursPerYear * pctOfYearCompleted);
    }

    return sum;
  }

  // Calculate income statement for specific month - simplified version
  calculateIncomeStatementForMonth(data, month) {
    return data.filter((row) => row.month === month);
  }

  // Calculate key statistics and KPIs
  calculateStats(deptIds, selectedMonth, data) {
    const [selYear, selMonthNum] = selectedMonth.split("-").map(Number);
    const priorYear = selYear - 1;
    const monthInPriorYear = `${priorYear}-${selMonthNum
      .toString()
      .padStart(2, "0")}`;

    const stats = {};

    // Volume calculations
    const kpiData = data.uos.length > 0 ? data.uos : data.volumes;

    if (kpiData.length > 0) {
      const currentMonth = kpiData.find((row) => row.month === selectedMonth);
      const ytmData = kpiData.filter(
        (row) =>
          row.month.startsWith(selYear.toString()) && row.month <= selectedMonth
      );

      stats.monthVolume = currentMonth?.volume || 0;
      stats.ytmVolume = ytmData.reduce(
        (sum, row) => sum + (row.volume || 0),
        0
      );
      stats.volumeUnit = kpiData[0]?.unit || "units";
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
    stats.ytmBudgetVolume = budgetSum.budget_volume * (selMonthNum / 12);

    // Revenue and expense calculations from income statement
    const incomeStmtData = data.incomeStatement.filter(
      (row) => row.month === selectedMonth
    );

    // Group income statement by category (simplified)
    const revenues = incomeStmtData.filter(
      (row) => row.tree && row.tree.includes("Revenue")
    );
    const expenses = incomeStmtData.filter(
      (row) => row.tree && row.tree.includes("Expense")
    );

    stats.ytdRevenue = revenues.reduce(
      (sum, row) => sum + (row.ytd_actual || 0),
      0
    );
    stats.ytdBudgetRevenue = revenues.reduce(
      (sum, row) => sum + (row.ytd_budget || 0),
      0
    );
    stats.ytdExpense = expenses.reduce(
      (sum, row) => sum + (row.ytd_actual || 0),
      0
    );
    stats.ytdBudgetExpense = expenses.reduce(
      (sum, row) => sum + (row.ytd_budget || 0),
      0
    );

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

  // Clean up resources
  destroy() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
  }
}

// Create singleton instance
export const KPI_DATA = new KPIData();
export default KPI_DATA;
