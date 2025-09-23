import { INCOME_STMT_DEF } from "./income-stmt-def.js";

// Income Statement Population
export function populateIncomeStatement(element, data) {
  if (!element || !data) return;

  // Transform the raw income statement data into hierarchical structure
  const hierarchicalData = transformIncomeStatementData(
    data.incomeStatement || []
  );
  element.data = hierarchicalData;
}

// Transform raw income statement data into hierarchical structure
export function transformIncomeStatementData(rawData) {
  if (!rawData || rawData.length === 0) return [];

  // Normalize data by combining spend_category and revenue_category into a single category field
  const srcData = rawData.map((row) => ({
    ...row,
    category: row.spend_category || row.revenue_category || "",
  }));

  // Initialize the hierarchical income statement structure
  const incomeStatement = [];

  // Process each item in the income statement definition to build the hierarchy
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

// Add financial data rows for a specific account and category combination
function addDataFromAccountAndCategory(
  account,
  category,
  negative,
  srcData,
  incomeStatement,
  path
) {
  // Build hierarchical path for this data row
  const curPath =
    category !== null && category !== undefined
      ? path === ""
        ? `${account}-${category}`
        : `${path}|${account}-${category}`
      : path === ""
      ? account
      : `${path}|${account}`;

  // Filter source data to matching account and category
  let rows = srcData.filter((row) => row.ledger_acct === account);
  if (category !== null && category !== undefined) {
    rows = rows.filter((row) => row.category === category);
  }

  // Apply sign multiplier for revenue items (which should be negative in accounting)
  const multiplier = negative ? -1 : 1;

  // Determine display text for the account row
  let accountText = account;
  if (category !== null && category !== undefined) {
    accountText = category === "" ? "(Blank)" : category;
  }

  // Create income statement rows for each matching data record
  rows.forEach((row) => {
    incomeStatement.push({
      tree: curPath,
      "Ledger Account": accountText,
      Actual: multiplier * (row.actual || 0),
      Budget: multiplier * (row.budget || 0),
      "YTD Actual": multiplier * (row.actual_ytd || 0),
      "YTD Budget": multiplier * (row.budget_ytd || 0),
    });
  });
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
    highlight: statementDefItem.highlight,
  });
}
