import { LitElement, html, css } from "lit";

export class DataTable extends LitElement {
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

  getStatusColor(variance) {
    const absVariance = Math.abs(variance);

    if (absVariance < 5) {
      return "text-success";
    } else if (absVariance >= 5 && absVariance < 8) {
      return "text-warning";
    } else {
      return "text-error";
    }
  }

  renderCell(cell, index) {
    if (typeof cell === "object") {
      if (cell.type === "variance") {
        const colorClass = this.getStatusColor(cell.variance);
        return html`<td class="text-right font-mono ${colorClass}">
          ${cell.value}
        </td>`;
      } else if (cell.type === "status") {
        const statusColor = this.getStatusColor(cell.variance);
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
    const maxHeightClass = this.maxHeight ? this.maxHeight : "";
    const containerClass = `overflow-x-auto ${maxHeightClass}`;

    return html`
      <div class="${containerClass}">
        <table class="table table-sm table-hover">
          <thead class="sticky top-0 bg-base-200 text-xs uppercase">
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
    `;
  }
}

window.customElements.define("data-table", DataTable);
