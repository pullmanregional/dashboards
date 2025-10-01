import { LitElement, html } from "lit";

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

  formatAsThousands(value) {
    // Parse the value to get numeric value
    const numericValue = parseFloat(value.replace(/[$,]/g, ""));
    if (isNaN(numericValue)) return value;

    // Format as $XXXk with thousand separators
    const valueInK = Math.round(numericValue / 1000);
    const formattedValue = valueInK.toLocaleString("en-US");
    return `$${formattedValue}k`;
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
      ? this.formatAsThousands(this.value)
      : this.value;

    return html`
      <div class="flex items-center gap-1.5 border-0">
        <div class="min-w-0">
          <div class="text-[0.6rem] text-gray-500">${this.title}</div>
          <div class="text-xs font-mono font-semibold truncate">
            ${formattedValue}
          </div>
        </div>
        ${this.showVariance
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
          : ""}
      </div>
    `;
  }
}

window.customElements.define("compact-metric", CompactMetric);
