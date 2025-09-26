import { INCOME_STMT_DEF } from "./income-stmt-def.js";
import { DEPARTMENTS } from "../department-config.js";

// Income Statement Population
export function populateIncomeStatement(element, data) {
  if (!element || !data) return;

  // Transform the raw income statement data into hierarchical structure
  const hierarchicalData = transformIncomeStatementData(
    data.incomeStatement || []
  );
  element.data = hierarchicalData;
}

// ------------------------------------------------------------
// Data transformation utilities
// ------------------------------------------------------------
function normalizeIncomeStatementData(rawData) {
  return rawData.map((row) => ({
    ...row,
    category: row.spend_category || row.revenue_category || "",
  }));
}

// Transform raw income statement data into hierarchical structure
export function transformIncomeStatementData(rawData) {
  if (!rawData || rawData.length === 0) return [];

  const srcData = normalizeIncomeStatementData(rawData);
  const incomeStatement = [];

  INCOME_STMT_DEF.forEach((item) => {
    applyStatementDefItem(item, srcData, incomeStatement, "");
  });

  return incomeStatement;
}

// Recursively process income statement definition items to build hierarchical structure
function applyStatementDefItem(
  statementDefItem,
  srcData,
  incomeStatement,
  path
) {
  // Handle section headers that contain sub-items (like "Operating Revenues", "Expenses")
  if (statementDefItem.name && statementDefItem.items) {
    const curPath =
      path === "" ? statementDefItem.name : `${path}|${statementDefItem.name}`;

    // Add header row for this section
    incomeStatement.push({
      tree: curPath,
      "Ledger Account": statementDefItem.name,
      Actual: null,
      Budget: null,
      "YTD Actual": null,
      "YTD Budget": null,
      bold: statementDefItem.bold,
      highlight: statementDefItem.highlight,
    });

    // Recursively process all sub-items under this section
    statementDefItem.items.forEach((subItem) => {
      applyStatementDefItem(subItem, srcData, incomeStatement, curPath);
    });
  }

  // Handle account-level items that reference specific ledger accounts
  if (statementDefItem.account) {
    const account = statementDefItem.account;
    const category = statementDefItem.category;
    const negative = statementDefItem.negative;

    if (category === "*") {
      // Wildcard category: process all categories found for this account
      const curPath = path === "" ? account : `${path}|${account}`;

      // Add account header row
      incomeStatement.push({
        tree: curPath,
        "Ledger Account": account,
        Actual: null,
        Budget: null,
        "YTD Actual": null,
        "YTD Budget": null,
        bold: statementDefItem.bold,
        highlight: statementDefItem.highlight,
      });

      // Find all unique categories for this account in the source data
      const uniqueCategories = [
        ...new Set(
          srcData
            .filter((row) => row.ledger_acct === account)
            .map((row) => row.category)
            .filter((cat) => cat !== null && cat !== undefined)
        ),
      ].sort();

      // Process each category found for this account
      uniqueCategories.forEach((cat) => {
        applyStatementDefItem(
          { account, category: cat, negative },
          srcData,
          incomeStatement,
          curPath
        );
      });
    } else {
      // Specific category: add data for this account and category combination
      addDataFromAccountAndCategory(
        account,
        category,
        negative,
        srcData,
        incomeStatement,
        path
      );
    }
  }

  // Handle calculated totals (like "Net Revenue", "Operating Margin")
  if (statementDefItem.total) {
    addTotalRow(statementDefItem, incomeStatement, path);
  }
}

// ------------------------------------------------------------
// Account and category processing utilities
// ------------------------------------------------------------
function processAccountCategoryData(
  account,
  category,
  negative,
  srcData,
  incomeStatement,
  path
) {
  const curPath = buildHierarchicalPath(path, account, category);
  const filteredRows = filterRowsByAccountAndCategory(
    srcData,
    account,
    category
  );
  const accountText = getAccountDisplayText(account, category);
  const multiplier = negative ? -1 : 1;

  const rowsByUnit = groupRowsByUnit(filteredRows);
  const needsUnitPrefixes = Object.keys(rowsByUnit).length > 1;

  Object.keys(rowsByUnit).forEach((deptWdId) => {
    const unitRows = rowsByUnit[deptWdId];
    const unitName = needsUnitPrefixes ? getUnitNameFromWdId(deptWdId) : null;

    const aggregatedRow = aggregateUnitRows(unitRows);
    const displayText = formatDisplayText(
      accountText,
      unitName,
      needsUnitPrefixes
    );
    const unitPath = buildUnitPath(curPath, unitName, needsUnitPrefixes);

    incomeStatement.push(
      createIncomeStatementRow(unitPath, displayText, aggregatedRow, multiplier)
    );
  });
}

// Add financial data rows for a specific account and category combination
function addDataFromAccountAndCategory(
  account,
  category,
  negative,
  srcData,
  incomeStatement,
  path
) {
  processAccountCategoryData(
    account,
    category,
    negative,
    srcData,
    incomeStatement,
    path
  );
}

// Build hierarchical path for tree structure
function buildHierarchicalPath(path, account, category) {
  if (category !== null && category !== undefined) {
    return path === ""
      ? `${account}-${category}`
      : `${path}|${account}-${category}`;
  }
  return path === "" ? account : `${path}|${account}`;
}

// Filter source data by account and category
function filterRowsByAccountAndCategory(srcData, account, category) {
  let rows = srcData.filter((row) => row.ledger_acct === account);
  if (category !== null && category !== undefined) {
    rows = rows.filter((row) => row.category === category);
  }
  return rows;
}

// Get display text for the account
function getAccountDisplayText(account, category) {
  if (category !== null && category !== undefined) {
    return category === "" ? "(Blank)" : category;
  }
  return account;
}

// Group rows by department work ID
function groupRowsByUnit(rows) {
  const rowsByUnit = {};
  rows.forEach((row) => {
    const deptWdId = row.dept_wd_id;
    if (!rowsByUnit[deptWdId]) {
      rowsByUnit[deptWdId] = [];
    }
    rowsByUnit[deptWdId].push(row);
  });
  return rowsByUnit;
}

// Aggregate financial values for a unit
function aggregateUnitRows(unitRows) {
  return unitRows.reduce(
    (sum, row) => ({
      actual: (sum.actual || 0) + (row.actual || 0),
      budget: (sum.budget || 0) + (row.budget || 0),
      actual_ytd: (sum.actual_ytd || 0) + (row.actual_ytd || 0),
      budget_ytd: (sum.budget_ytd || 0) + (row.budget_ytd || 0),
    }),
    {}
  );
}

// Format display text with unit prefix if needed
function formatDisplayText(accountText, unitName, needsUnitPrefixes) {
  if (needsUnitPrefixes && unitName) {
    return `${accountText} [${unitName}]`;
  }
  return accountText;
}

// Build unique path for each unit
function buildUnitPath(curPath, unitName, needsUnitPrefixes) {
  if (needsUnitPrefixes && unitName) {
    return `${curPath}-${unitName}`;
  }
  return curPath;
}

// Create income statement row object
function createIncomeStatementRow(
  tree,
  ledgerAccount,
  aggregatedRow,
  multiplier
) {
  return {
    tree,
    "Ledger Account": ledgerAccount,
    Actual: multiplier * aggregatedRow.actual,
    Budget: multiplier * aggregatedRow.budget,
    "YTD Actual": multiplier * aggregatedRow.actual_ytd,
    "YTD Budget": multiplier * aggregatedRow.budget_ytd,
  };
}

// Helper function to get unit name from dept_wd_id
function getUnitNameFromWdId(deptWdId) {
  // Search through all departments to find the unit with matching wd_id
  for (const deptKey in DEPARTMENTS) {
    const dept = DEPARTMENTS[deptKey];

    // Check if this department has sub_depts
    if (dept.sub_depts) {
      for (const subDept of dept.sub_depts) {
        if (subDept.wd_ids && subDept.wd_ids.includes(deptWdId)) {
          return subDept.name;
        }
      }
    }

    // Check if this department's main wd_ids include the target
    if (dept.wd_ids && dept.wd_ids.includes(deptWdId)) {
      return dept.name;
    }
  }

  // Return the wd_id itself as fallback
  return deptWdId;
}

// Calculate and add total rows by summing values from specified hierarchical paths
function addTotalRow(statementDefItem, incomeStatement, path) {
  const pathsToSum = statementDefItem.total;
  let actual = 0,
    budget = 0,
    actualYtd = 0,
    budgetYtd = 0;

  // Process each path specification (e.g., "Operating Revenues", "-Deductions")
  pathsToSum.forEach((prefix) => {
    // Normalize path delimiter from '/' to '|' and handle negative signs
    let cleanPrefix = prefix.replace(/\//g, "|");
    const isNegative = cleanPrefix.startsWith("-");
    cleanPrefix = isNegative ? cleanPrefix.substring(1) : cleanPrefix;

    // Find all rows that match this hierarchical path prefix
    const matchingRows = incomeStatement.filter((row) => {
      const rowTree = row.tree;
      if (!rowTree) return false;

      // Match rows that start with the prefix (includes all sub-items)
      return rowTree.startsWith(cleanPrefix);
    });

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

  // Create the calculated total row with proper hierarchical path
  const curPath =
    path === "" ? statementDefItem.name : `${path}|${statementDefItem.name}`;

  incomeStatement.push({
    tree: curPath,
    "Ledger Account": statementDefItem.name,
    Actual: actual,
    Budget: budget,
    "YTD Actual": actualYtd,
    "YTD Budget": budgetYtd,
    bold: statementDefItem.bold,
    highlight: statementDefItem.highlight,
  });
}
