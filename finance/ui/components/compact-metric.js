import { LitElement, html } from "lit";
import { formatCurrencyInThousands } from "../data/util.js";

export class CompactMetric extends LitElement {
  // Disable shadow DOM to use DaisyUI
  createRenderRoot() {
    return this;
  }

  static properties = {
    title: { type: String, default: "" },
    value: { type: String, default: "" },
    variancePct: { type: Number, default: 0 },
    roundToThousands: { type: Boolean, default: false },
    showVariance: { type: Boolean, default: true },
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
    const variancePercent = Math.round(this.variancePct);
    const formattedValue = this.roundToThousands
      ? formatCurrencyInThousands(this.value)
      : this.value;
    const varianceHtml = this.showVariance
      ? html`
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            class="flex-shrink-0 ${this.getStatusColor()}"
          >
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
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
              ${variancePercent}%
            </text>
          </svg>
        `
      : "";

    return html`
      <div class="flex items-center gap-1.5">
        ${varianceHtml}
        <div class="ml-1">
          <div class="text-[0.6rem] text-gray-500">${this.title}</div>
          <div class="text-xs font-mono font-semibold truncate">
            ${formattedValue}
          </div>
        </div>
      </div>
    `;
  }
}

window.customElements.define("compact-metric", CompactMetric);
