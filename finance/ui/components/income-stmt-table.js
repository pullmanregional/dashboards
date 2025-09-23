import { LitElement, html } from "lit";
import "./tree-table.js";

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
    this.title = "Income Statement";
    this.maxHeight = "max-h-96";
  }

  // Transform income statement data and add financial-specific properties
  transformData() {
    if (!this.data || this.data.length === 0) {
      return [];
    }

    return this.data.map((row) => ({
      tree: row.tree,
      "Ledger Account": row["Ledger Account"],
      Actual: row["Actual"],
      Budget: row["Budget"],
      "YTD Actual": row["YTD Actual"],
      "YTD Budget": row["YTD Budget"],
      // Add financial-specific styling
      bold: this.isBoldRow(row),
      highlight: row.highlight,
    }));
  }

  // Define the headers for the income statement table
  getHeaders() {
    return [
      { title: "Account/Category", key: "Ledger Account", align: "text-left" },
      {
        title: "Actual",
        key: "Actual",
        align: "text-right",
        classes: "font-mono",
        summable: true,
      },
      {
        title: "Budget",
        key: "Budget",
        align: "text-right",
        classes: "font-mono",
        summable: true,
      },
      {
        title: "YTD Actual",
        key: "YTD Actual",
        align: "text-right",
        classes: "font-mono",
        summable: true,
      },
      {
        title: "YTD Budget",
        key: "YTD Budget",
        align: "text-right",
        classes: "font-mono",
        summable: true,
      },
    ];
  }

  // Financial-specific logic for determining bold rows
  isBoldRow(row) {
    const name = row["Ledger Account"] || "";
    return (
      !this.hasDataValues(row) || // Header rows
      name.includes("Total") ||
      name.includes("Margin") ||
      name.includes("Net")
    );
  }

  // Financial-specific logic for determining highlighted rows
  isHighlightRow(row) {
    const name = row["Ledger Account"] || "";
    return (
      name.includes("Net Revenue") ||
      name.includes("Operating Margin") ||
      name.includes("Total Operating")
    );
  }

  // Check if a row has financial data values
  hasDataValues(row) {
    return row["Actual"] !== null && row["Actual"] !== undefined;
  }

  // Financial-specific formatter
  createFormatter() {
    return (value, header, row) => {
      if (header.summable) {
        // Format financial values as currency
        if (value === null || value === undefined || value === "") return "-";
        const num = parseFloat(value);
        if (isNaN(num)) return "-";
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(num);
      }
      // Default formatting for non-financial columns
      if (value === null || value === undefined || value === "") return "-";
      return String(value);
    };
  }

  render() {
    const transformedData = this.transformData();
    const headers = this.getHeaders();

    if (transformedData.length === 0) {
      return html`
        <div class="card bg-base-100 shadow-lg">
          <div class="card-body p-4">
            <h2 class="card-title text-lg border-b border-base-300 pb-2 mb-4">
              ${this.title}
            </h2>
            <div class="text-center py-8 text-base-content/60">
              <div class="text-lg mb-2">No income statement data available</div>
              <div class="text-sm">
                Select a time period to view financial data
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return html`
      <tree-table
        title="${this.title}"
        .headers="${headers}"
        .data="${transformedData}"
        maxHeight=""
        treeColumn="tree"
        ?calculateTotals="${true}"
        ?collapsed="${true}"
        ?compact="${true}"
        fontSize="text-xs"
        .formatter="${this.createFormatter()}"
      >
      </tree-table>
    `;
  }
}

window.customElements.define("income-stmt-table", IncomeStmtTable);
