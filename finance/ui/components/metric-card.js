import { LitElement, html, css } from "lit";

export class MetricCard extends LitElement {
  // Disable shadow DOM to use DaisyUI
  createRenderRoot() {
    return this;
  }

  static properties = {
    title: { type: String, default: "" },
    value: { type: String, default: "" },
    variance: { type: Number, default: 0 },
    statusText: { type: String, default: "" },
    hideDetails: { type: Boolean, default: false },
  };

  constructor() {
    super();
  }

  getStatusColor() {
    const absVariance = Math.abs(this.variance);

    if (absVariance < 5) {
      return "text-success";
    } else if (absVariance >= 5 && absVariance < 8) {
      return "text-warning";
    } else {
      return "text-error";
    }
  }

  render() {
    return html`
      <div class="stat border border-base-300 rounded-lg py-2 relative">
        <div class="stat-title text-xs font-bold mb-1 uppercase">
          ${this.title}
        </div>
        <div class="stat-value text-lg/[1.2] font-mono mb-1">${this.value}</div>
        ${!this.hideDetails
          ? html`
              <div class="stat-desc text-[0.6875rem]">${this.statusText}</div>
              <div class="absolute right-4 top-1/2 -translate-y-1/2">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  class="${this.getStatusColor()}"
                >
                  <circle cx="12" cy="12" r="10" fill="currentColor" />
                </svg>
              </div>
            `
          : ""}
      </div>
    `;
  }
}

window.customElements.define("metric-card", MetricCard);
