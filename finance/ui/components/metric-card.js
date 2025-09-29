import { LitElement, html, css } from "lit";

export class MetricCard extends LitElement {
  // Disable shadow DOM to use DaisyUI
  createRenderRoot() {
    return this;
  }

  static properties = {
    title: { type: String },
    value: { type: String },
    budgetValue: { type: String },
    variance: { type: Number },
    isExpense: { type: Boolean },
  };

  constructor() {
    super();
    this.title = "";
    this.value = "";
    this.budgetValue = "";
    this.variance = 0;
    this.isExpense = false;
  }

  getStatusColor() {
    const threshold = 5;
    const absVariance = Math.abs(this.variance);

    if (absVariance <= threshold) {
      return "text-success";
    } else if (
      (this.isExpense && this.variance < 0) ||
      (!this.isExpense && this.variance > 0)
    ) {
      return "text-success";
    } else if (absVariance <= threshold * 2) {
      return "text-warning";
    } else {
      return "text-error";
    }
  }

  render() {
    return html`
      <div class="stat border border-base-300 rounded-lg">
        <div class="stat-title text-xs font-bold mb-2 uppercase">
          ${this.title}
        </div>
        <div class="stat-value text-lg/[1.2] font-mono mb-1">${this.value}</div>
        <div class="stat-desc text-0.6875rem">Budget: ${this.budgetValue}</div>
        <div class="stat-actions">
          <span class="${this.getStatusColor()} text-lg">●</span>
        </div>
      </div>
    `;
  }
}

window.customElements.define("metric-card", MetricCard);
