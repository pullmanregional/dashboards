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
    key: "lastMonth",
    align: "text-right",
    classes: "font-mono",
  },
  {
    title: "Change from Last Month",
    key: "changeFromLastMonth",
    align: "text-right",
    classes: "font-mono",
  },
  {
    title: "Last Year",
    key: "lastYear",
    align: "text-right",
    classes: "font-mono",
  },
  {
    title: "Change from Last Year",
    key: "changeFromLastYear",
    align: "text-right",
    classes: "font-mono",
  },
];

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
    this.expandedPaths = new Set([
      "Assets",
      "Assets|Current Assets",
      "Assets|Net Patient Accounts Receivable|Third Party Settlement Receivables",
      "Assets|Net Patient Accounts Receivable",
      "Assets|Fixed Assets",
      "Assets|Other Assets",
      "Liabilities and Fund Balance",
      "Liabilities and Fund Balance|Current Liabilities",
      "Liabilities and Fund Balance|Long Term Liabilities",
      "Liabilities and Fund Balance|Fund Balance",
    ]);
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
