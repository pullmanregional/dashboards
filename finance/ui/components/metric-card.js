import { LitElement, html, css } from "lit";
import { formatCurrencyInThousands } from "../data/util.js";

export class MetricCard extends LitElement {
  // Disable shadow DOM to use DaisyUI
  createRenderRoot() {
    return this;
  }

  static properties = {
    title: { type: String, default: "" },
    value: { type: String, default: "" },
    variancePct: { type: Number, default: 0 },
    statusText: { type: String, default: "" },
    hideDetails: { type: Boolean, default: false },
    roundToThousands: { type: Boolean, default: false },
  };

  constructor() {
    super();
  }

  getStatusColor() {
    const absVariance = Math.abs(this.variancePct);

    if (absVariance < 5) {
      return "text-success";
    } else if (absVariance >= 5 && absVariance < 8) {
      return "text-warning";
    } else {
      return "text-error";
    }
  }

  render() {
    const formattedValue = this.roundToThousands
      ? formatCurrencyInThousands(this.value)
      : this.value;

    return html`
      <div class="stat border border-base-300 rounded-lg p-0 relative">
        <div class="stat-title text-xs font-bold uppercase">${this.title}</div>
        <div class="text-base font-mono">${formattedValue}</div>
        ${!this.hideDetails
          ? html`
              <div class="text-[0.6875rem]">${this.statusText}</div>
              <div class="absolute right-4 top-1/2 -translate-y-1/2">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 36 36"
                  class="${this.getStatusColor()}"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                  />
                  <text
                    x="18"
                    y="18"
                    text-anchor="middle"
                    dominant-baseline="central"
                    font-size="10"
                    font-weight="600"
                    fill="currentColor"
                  >
                    ${Math.round(this.variancePct)}%
                  </text>
                </svg>
              </div>
            `
          : ""}
      </div>
    `;
  }
}

window.customElements.define("metric-card", MetricCard);
