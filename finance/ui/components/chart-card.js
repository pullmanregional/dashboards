import { LitElement, html, css } from "lit";
import * as echarts from "echarts";

export class ChartCard extends LitElement {
  // Disable shadow DOM to work with DaisyUI
  createRenderRoot() {
    return this;
  }

  static properties = {
    title: { type: String, default: "" },
    options: { type: Object, default: null },
    loading: { type: Boolean, default: false },
  };

  constructor() {
    super();
    this.chart = null;
  }

  firstUpdated() {
    this.initChart();
  }

  updated(changedProperties) {
    if (changedProperties.has("options") && this.options) {
      this.updateChart();
    }
  }

  initChart() {
    const container = this.querySelector(".chart-container");
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // If no dimensions, wait for DOM to be fully rendered and try again
      setTimeout(() => {
        this.initChart();
      }, 50);
      return;
    }

    this.chart = echarts.init(container);

    // Add resize observer
    this.resizeObserver = new ResizeObserver(() => {
      if (this.chart) {
        this.chart.resize();
      }
    });
    this.resizeObserver.observe(container);

    this.updateChart();
  }

  updateChart() {
    if (!this.chart || !this.options) return;
    this.chart.setOption(this.options, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.chart) {
      this.chart.dispose();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  render() {
    return html`
      <div class="card bg-base-100 shadow-lg">
        <div class="card-body !pt-2">
          <h2 class="card-title text-lg border-b border-base-300 pb-2 mb-4">
            ${this.title}
          </h2>
          <div class="h-80">
            <div class="chart-container w-full h-full"></div>
          </div>
        </div>
      </div>
    `;
  }
}

window.customElements.define("chart-card", ChartCard);
