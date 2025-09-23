import { LitElement, html, css } from "lit";

export class TableCard extends LitElement {
  // Disable shadow DOM to use DaisyUI
  createRenderRoot() {
    return this;
  }

  static properties = {
    title: { type: String },
    headers: { type: Array },
    rows: { type: Array },
    maxHeight: { type: String },
  };

  constructor() {
    super();
    this.title = "";
    this.headers = [];
    this.rows = [];
    this.maxHeight = "";
  }

  getStatusColor(variance, isExpense = false) {
    const threshold = 5;
    const absVariance = Math.abs(variance);

    if (absVariance <= threshold) {
      return "text-success";
    } else if ((isExpense && variance < 0) || (!isExpense && variance > 0)) {
      return "text-success";
    } else if (absVariance <= threshold * 2) {
      return "text-warning";
    } else {
      return "text-error";
    }
  }

  renderCell(cell, index) {
    if (typeof cell === "object") {
      if (cell.type === "variance") {
        const colorClass = cell.variance >= 0 ? "text-success" : "text-error";
        return html`<td class="text-right font-mono ${colorClass}">
          ${cell.value}
        </td>`;
      } else if (cell.type === "status") {
        const statusColor = this.getStatusColor(cell.variance, cell.isExpense);
        return html`<td class="text-center">
          <span class="${statusColor} text-lg">●</span>
        </td>`;
      } else if (cell.type === "number") {
        return html`<td class="text-right font-mono">${cell.value}</td>`;
      } else if (cell.type === "center") {
        return html`<td class="text-center">${cell.value}</td>`;
      }
    }
    return html`<td class="font-medium">${cell}</td>`;
  }

  render() {
    const containerClass = this.maxHeight
      ? `overflow-x-auto ${this.maxHeight}`
      : "overflow-x-auto";

    return html`
      <div class="card bg-base-100 shadow-lg">
        <div class="card-body !pt-2">
          <h2 class="card-title text-lg border-b border-base-300 pb-2 mb-4">
            ${this.title}
          </h2>
          <div class="${containerClass}">
            <table class="table table-sm table-hover">
              <thead class="sticky top-0 bg-base-200">
                <tr>
                  ${this.headers.map(
                    (header) =>
                      html`<th class="${header.align || "text-left"}">
                        ${header.title}
                      </th>`
                  )}
                </tr>
              </thead>
              <tbody>
                ${this.rows.map(
                  (row) => html`
                    <tr>
                      ${row.map((cell, index) => this.renderCell(cell, index))}
                    </tr>
                  `
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

window.customElements.define("table-card", TableCard);
