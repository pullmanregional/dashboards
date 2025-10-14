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
    details: { type: String, default: "" },
    hideDetails: { type: Boolean, default: false },
    roundToThousands: { type: Boolean, default: false },
    border: { type: Boolean, default: false },
    cardCss: { type: String, default: "" },
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
    const borderCss = this.border ? "border rounded-lg border-base-300" : "";
    const cardClasses = (this.cardCss || "")
      .split(" ")
      .filter(Boolean)
      .map((cls) => `!${cls}`)
      .join(" ");
    const formattedValue = this.roundToThousands
      ? formatCurrencyInThousands(this.value)
      : this.value;
    const varianceHtml = !isNaN(this.variancePct)
      ? html`
          <div class="stat-figure">
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
      : "";

    return html`
      <div
        class="stat flex items-center gap-3 overflow-hidden ${borderCss} ${cardClasses}"
      >
        ${!this.hideDetails ? varianceHtml : ""}
        <div class="flex flex-col gap-1 overflow-hidden">
          <div class="stat-title text-xs font-bold uppercase truncate">
            ${this.title}
          </div>
          <div class="stat-value text-base font-mono">${formattedValue}</div>
          ${!this.hideDetails
            ? html`<div
                class="stat-desc text-[0.6875rem] truncate"
                .innerHTML="${this.details}"
              ></div>`
            : ""}
        </div>
      </div>
    `;
  }
}

window.customElements.define("metric-card", MetricCard);
