import { INCOME_STMT_DEF } from "./income-stmt-def.js";
import { DEPARTMENTS } from "../department-config.js";

// Populates a <income-stmt-table> element with hierarchical income statement data
export function populateIncomeStmt(incomeStmtEl, data) {
  if (!incomeStmtEl || !data) return;
  incomeStmtEl.data = transformIncomeStmtData(data.incomeStmt || []);
}

// Transforms raw financial data into hierarchical income statement structure
// rawData: Array of financial records with ledger_acct, spend_category/revenue_category, actual, budget, etc.
export function transformIncomeStmtData(rawData) {
  if (!rawData?.length) return [];

  // Normalize category field from either spend_category or revenue_category
  const srcData = rawData.map((row) => ({
    ...row,
    category: row.spend_category || row.revenue_category || "",
  }));

  // Build hierarchical structure following INCOME_STMT_DEF template
  const incomeStatement = [];
  INCOME_STMT_DEF.forEach((item) =>
    applyStatementDefItem(item, srcData, incomeStatement, "")
  );
  return incomeStatement;
}

// Recursively processes income statement definition items to build hierarchical structure
// item: Definition object with name/items (section), account/category (data), or total (calculated)
// path: Hierarchical path using '|' delimiter for tree structure
function applyStatementDefItem(item, srcData, incomeStatement, path) {
  if (item.name && item.items) {
    // Section header with sub-items (e.g., "Operating Revenues", "Expenses")
    const curPath = path ? `${path}|${item.name}` : item.name;
    incomeStatement.push({
      tree: curPath,
      "Ledger Account": item.name,
      Actual: null,
      Budget: null,
      "YTD Actual": null,
      "YTD Budget": null,
      bold: item.bold,
      highlight: item.highlight,
    });
    item.items.forEach((subItem) =>
      applyStatementDefItem(subItem, srcData, incomeStatement, curPath)
    );
  }

  if (item.account) {
    // Account-level item that references specific ledger accounts
    if (item.category === "*") {
      // Wildcard category: dynamically process all categories found for this account
      const curPath = path ? `${path}|${item.account}` : item.account;
      incomeStatement.push({
        tree: curPath,
        "Ledger Account": item.account,
        Actual: null,
        Budget: null,
        "YTD Actual": null,
        "YTD Budget": null,
        bold: item.bold,
        highlight: item.highlight,
      });

      // Find all unique categories for this account in the source data
      const categories = [
        ...new Set(
          srcData
            .filter((row) => row.ledger_acct === item.account)
            .map((row) => row.category)
            .filter((cat) => cat != null)
        ),
      ].sort();

      // Process each category found for this account
      categories.forEach((cat) =>
        applyStatementDefItem(
          { account: item.account, category: cat, negative: item.negative },
          srcData,
          incomeStatement,
          curPath
        )
      );
    } else {
      // Specific category or no category: add data for this account and category combination
      addAccountData(
        item.account,
        item.category,
        item.negative,
        srcData,
        incomeStatement,
        path
      );
    }
  }

  if (item.total) {
    // Calculated totals (e.g., "Net Revenue", "Operating Margin")
    addTotalRow(item, incomeStatement, path);
  }
}

// Adds financial data rows for a specific account and category combination
// Handles multiple departments by grouping data and adding unit prefixes when needed
function addAccountData(
  account,
  category,
  negative,
  srcData,
  incomeStatement,
  path
) {
  const curPath = buildPath(path, account, category);
  const rows = srcData.filter(
    (row) =>
      row.ledger_acct === account &&
      (category == null || row.category === category)
  );

  const displayText = category != null ? category || "(Blank)" : account;
  const multiplier = negative ? -1 : 1;

  // Group rows by department to handle multi-unit scenarios
  const rowsByUnit = {};
  rows.forEach((row) => {
    const deptWdId = row.dept_wd_id;
    if (!rowsByUnit[deptWdId]) {
      rowsByUnit[deptWdId] = [];
    }
    rowsByUnit[deptWdId].push(row);
  });

  // Add unit prefixes only when data spans multiple departments
  const needsUnitPrefixes = Object.keys(rowsByUnit).length > 1;

  Object.entries(rowsByUnit).forEach(([deptWdId, unitRows]) => {
    const unitName = needsUnitPrefixes ? getUnitName(deptWdId) : null;

    // Aggregate financial values across all rows for this unit
    const aggregated = unitRows.reduce(
      (sum, row) => ({
        actual: (sum.actual || 0) + (row.actual || 0),
        budget: (sum.budget || 0) + (row.budget || 0),
        actual_ytd: (sum.actual_ytd || 0) + (row.actual_ytd || 0),
        budget_ytd: (sum.budget_ytd || 0) + (row.budget_ytd || 0),
      }),
      {}
    );

    const finalDisplayText =
      needsUnitPrefixes && unitName
        ? `${displayText} [${unitName}]`
        : displayText;
    const unitPath =
      needsUnitPrefixes && unitName ? `${curPath}-${unitName}` : curPath;

    incomeStatement.push({
      tree: unitPath,
      "Ledger Account": finalDisplayText,
      Actual: multiplier * aggregated.actual,
      Budget: multiplier * aggregated.budget,
      "YTD Actual": multiplier * aggregated.actual_ytd,
      "YTD Budget": multiplier * aggregated.budget_ytd,
    });
  });
}

// Builds hierarchical path for tree structure using '|' delimiter
// Combines account and category into path segments
function buildPath(path, account, category) {
  const accountPath = category != null ? `${account}-${category}` : account;
  return path ? `${path}|${accountPath}` : accountPath;
}

// Maps department work ID to human-readable unit name
// Searches through DEPARTMENTS config to find matching wd_id
function getUnitName(deptWdId) {
  for (const dept of Object.values(DEPARTMENTS)) {
    if (dept.sub_depts) {
      for (const subDept of dept.sub_depts) {
        if (subDept.wd_ids?.includes(deptWdId)) return subDept.name;
      }
    }
    if (dept.wd_ids?.includes(deptWdId)) return dept.name;
  }
  return deptWdId; // Fallback to ID if no match found
}

// Calculates and adds total rows by summing values from specified hierarchical paths
// item.total: Array of path specifications (e.g., "Operating Revenues", "-Deductions")
// Supports negative prefixes to subtract values (e.g., "-Deductions" subtracts deduction totals)
function addTotalRow(item, incomeStatement, path) {
  let actual = 0,
    budget = 0,
    actualYtd = 0,
    budgetYtd = 0;

  item.total.forEach((prefix) => {
    // Normalize path delimiter from '/' to '|' and handle negative signs
    let cleanPrefix = prefix.replace(/\//g, "|");
    const isNegative = cleanPrefix.startsWith("-");
    cleanPrefix = isNegative ? cleanPrefix.substring(1) : cleanPrefix;

    // Find all rows that match this hierarchical path prefix (includes all sub-items)
    const matchingRows = incomeStatement.filter((row) =>
      row.tree?.startsWith(cleanPrefix)
    );

    // Sum all matching rows across all time periods
    const sums = matchingRows.reduce(
      (acc, row) => ({
        actual: acc.actual + (row.Actual || 0),
        budget: acc.budget + (row.Budget || 0),
        actualYtd: acc.actualYtd + (row["YTD Actual"] || 0),
        budgetYtd: acc.budgetYtd + (row["YTD Budget"] || 0),
      }),
      { actual: 0, budget: 0, actualYtd: 0, budgetYtd: 0 }
    );

    // Apply sign multiplier and accumulate totals
    const multiplier = isNegative ? -1 : 1;
    actual += multiplier * sums.actual;
    budget += multiplier * sums.budget;
    actualYtd += multiplier * sums.actualYtd;
    budgetYtd += multiplier * sums.budgetYtd;
  });

  const curPath = path ? `${path}|${item.name}` : item.name;
  incomeStatement.push({
    tree: curPath,
    "Ledger Account": item.name,
    Actual: actual,
    Budget: budget,
    "YTD Actual": actualYtd,
    "YTD Budget": budgetYtd,
    bold: item.bold,
    highlight: item.highlight,
  });
}
