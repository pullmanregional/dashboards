import { LitElement, html } from "lit";
import "./tree-table.js";

// Income statement column headers
const INCOME_STMT_HEADERS = [
  { title: "Account/Category", key: "Ledger Account", align: "text-left" },
  {
    title: "Month Actual",
    key: "Actual",
    align: "text-right",
    classes: "font-mono",
    summable: true,
  },
  {
    title: "Month Budget",
    key: "Budget",
    align: "text-right",
    classes: "font-mono",
    summable: true,
  },
  {
    title: "Variance",
    key: "Variance",
    align: "text-right",
    classes: "font-mono",
    summable: true,
  },
  {
    title: "YTD Actual",
    key: "YTD Actual",
    align: "text-right",
    classes: "font-mono border-l border-base-300",
    summable: true,
  },
  {
    title: "YTD Budget",
    key: "YTD Budget",
    align: "text-right",
    classes: "font-mono",
    summable: true,
  },
  {
    title: "Variance",
    key: "YTD Variance",
    align: "text-right",
    classes: "font-mono",
    summable: true,
  },
];

export class IncomeStmtTable extends LitElement {
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
  }

  // Finance number formatter
  createFormatter() {
    return (value, header, row) => {
      if (header.summable) {
        // Format financial values as currency
        const num = parseFloat(value);
        if (isNaN(num)) {
          return "-";
        }

        // Format with parentheses for negative values
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Math.abs(num));

        return num < 0 ? `(${formatted})` : formatted;
      }
      // Default formatting for non-financial columns
      if (value === null || value === undefined || value === "") return "-";
      return String(value);
    };
  }

  render() {
    if (!this.data?.length) {
      return html`
        <div class="text-center py-8 text-base-content/60">
          <div class="text-lg mb-2">No income statement data available</div>
        </div>
      `;
    }

    return html`
      <tree-table
        .headers="${INCOME_STMT_HEADERS}"
        .data="${this.data}"
        treeColumn="tree"
        calculateTotals
        .formatter="${this.createFormatter()}"
        maxHeight="${this.maxHeight}"
      >
      </tree-table>
    `;
  }
}

window.customElements.define("income-stmt-table", IncomeStmtTable);
