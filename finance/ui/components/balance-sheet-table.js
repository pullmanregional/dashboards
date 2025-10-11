// This module defines the UI for the balance sheet. Similar to income statement table,
// but data is ingested directly from WorkDay balance sheet, and comes as individual lines in order.
// This component primarily works to calculate totals for rows where they are not present in the custom Workday report
// and specify formatting for bolding and highlighting rows.
import { LitElement, html } from "lit";
import "./tree-table.js";
import { formatAccounting } from "../data/util.js";

// Income statement column headers
const BALANCE_SHEET_HEADERS = [
  { title: "", key: "ledger_acct", align: "text-left" },
  {
    title: "Actual",
    key: "actual",
    align: "text-right",
    classes: "font-mono",
  },
  {
    title: "Last Month",
    key: "actual_prev_month",
    align: "text-right",
    classes: "font-mono",
  },
  {
    title: "Change",
    key: "diff_prev_month",
    align: "text-right",
    classes: "font-mono",
  },
  {
    title: "Last Year (Dec)",
    key: "actual_prev_year",
    align: "text-right",
    classes: "font-mono",
  },
  {
    title: "Change",
    key: "diff_prev_year",
    align: "text-right",
    classes: "font-mono",
  },
];

const BALANCE_SHEET_CUSTOM_TOTALS = [
  "Assets|Current Assets",
  "Assets|Other Receivables",
];

const BALANCE_SHEET_FORMATTING = {
  expanded: ["Assets", "Liabilities and Fund Balance"],
  bold: [
    "Assets",
    "Assets|Net Patient Accounts Receivable",
    "Assets|Total Current Assets",
    "Assets|Net Fixed Assets",
    "Assets|Total Other Assets",
    "Assets|Total Assets",
    "Liabilities and Fund Balance",
    "Liabilities and Fund Balance|Liabilities",
    "Liabilities and Fund Balance|Total Current Liabilities",
    "Liabilities and Fund Balance|Total Long Term Liabilities",
    "Liabilities and Fund Balance|Total Liabilities",
    "Liabilities and Fund Balance|Total Fund Balance",
    "Liabilities and Fund Balance|Total Liabilities and Fund Balance",
    "Liabilities and Fund Balance|Total Balance Sheet",
  ],
  highlight: [
    "Assets|Total Assets",
    "Liabilities and Fund Balance|Total Liabilities",
    "Liabilities and Fund Balance|Total Fund Balance",
  ],
};

export class BalanceSheetTable extends LitElement {
  // Disable shadow DOM to use DaisyUI
  createRenderRoot() {
    return this;
  }

  static properties = {
    data: { type: Array },
    title: { type: String },
    maxHeight: { type: String },
  };

  constructor() {
    super();
    this.data = [];
    this.maxHeight = "";

    // Default expanded paths
    this.expandedPaths = new Set(BALANCE_SHEET_FORMATTING.expanded);
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    if (changedProperties.has("data")) {
      this.applyRowFormatting(this.data, BALANCE_SHEET_FORMATTING);
      this.applyCustomTotals(this.data, BALANCE_SHEET_CUSTOM_TOTALS);
    }
  }

  applyCustomTotals(data, customTotals) {
    // Sum custom row totals
    for (const tree of customTotals) {
      // Skip if target row already has actual values
      const targetRow = data.find((row) => row.tree === tree);
      if (!targetRow || targetRow.actual) {
        continue;
      }
      // Get direct children of target row
      const rows = data.filter((row) =>
        row.tree.match(new RegExp(`^${tree.replace("|", "\\|")}\\|[^\\|]+$`))
      );
      targetRow.actual = rows.reduce((acc, r) => acc + (r.actual || 0), 0);
      targetRow.actual_prev_month = rows.reduce(
        (acc, r) => acc + (r.actual_prev_month || 0),
        0
      );
      targetRow.actual_prev_year = rows.reduce(
        (acc, row) => acc + (row.actual_prev_year || 0),
        0
      );
      targetRow.diff_prev_month = rows.reduce(
        (acc, row) => acc + (row.diff_prev_month || 0),
        0
      );
      targetRow.diff_prev_year = rows.reduce(
        (acc, row) => acc + (row.diff_prev_year || 0),
        0
      );
    }
  }

  // Apply custom bold and highlighting to data rows
  applyRowFormatting(data, formatting) {
    for (const row of data) {
      if (formatting.bold.includes(row.tree)) {
        row.bold = true;
      }
      if (formatting.highlight.includes(row.tree)) {
        row.highlight = true;
      }
    }
  }

  // Finance number formatter
  createFormatter() {
    return (value, header, row) => {
      if (header.key !== "ledger_acct") {
        // Format financial values as currency with parentheses for negative values
        const num = parseFloat(value);
        if (isNaN(num)) {
          return "";
        }
        return formatAccounting(num);
      }
      return value;
    };
  }

  render() {
    if (!this.data?.length) {
      return html`
        <div class="text-center py-8 text-base-content/60">
          <div class="text-lg mb-2">No balance sheet available</div>
        </div>
      `;
    }

    return html`
      <tree-table
        .headers="${BALANCE_SHEET_HEADERS}"
        .data="${this.data}"
        treeColumn="tree"
        .expandedPaths="${this.expandedPaths}"
        .formatter="${this.createFormatter()}"
        maxHeight="${this.maxHeight}"
      >
      </tree-table>
    `;
  }
}

window.customElements.define("balance-sheet-table", BalanceSheetTable);
