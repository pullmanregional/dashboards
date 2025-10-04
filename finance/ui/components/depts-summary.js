import { LitElement, html } from "lit";
import dayjs from "dayjs";
import { formatAccounting } from "../data/util.js";
import "./data-chart.js";

// Escape HTML characters using browser
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Represents one department line in the summary table
export class DeptData {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.monthRevenue = data.monthRevenue;
    this.monthExpense = data.monthExpense;
    this.ytdRevenue = data.ytdRevenue;
    this.ytdExpense = data.ytdExpense;
    this.ytdNetIncome = data.ytdNetIncome;
    this.variance = data.variance;
    this.variancePct = data.variancePct;

    // Trends should be arrays of [{ month: string, value: number }]
    this.volumeTrend = data.volumeTrend;
    this.fteTrend = data.fteTrend;
    Object.freeze(this);
  }
}

export class DeptsSummary extends LitElement {
  // Disable shadow DOM to use DaisyUI
  createRenderRoot() {
    return this;
  }

  static properties = {
    deptData: { type: Array }, // array of [DeptData]
    selectedMonth: { type: String },
    expandedRows: { type: Set },
    feedback: { type: Object },
  };

  constructor() {
    super();
    this.deptData = [];
    this.selectedMonth = null;
    this.expandedRows = new Set();
    this.feedback = {};
  }

  // Determine status indicator color based on variance percentage
  getStatusColor(variancePercent) {
    const absVariance = Math.abs(variancePercent);

    if (absVariance < 5) {
      return "text-success";
    } else if (absVariance >= 5 && absVariance < 8) {
      return "text-warning";
    } else {
      return "text-error";
    }
  }

  // Send event to parent to notify of row expansion state changes
  dispatchToggleRow() {
    const event = new CustomEvent("expanded-changed", {
      detail: { expandedRows: Array.from(this.expandedRows) },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  // Toggle expansion state for individual department row by updating the
  // ids in the expandedRows property
  toggleRow(deptId) {
    const expandedRows = this.expandedRows;
    if (expandedRows.has(deptId)) {
      expandedRows.delete(deptId);
    } else {
      expandedRows.add(deptId);
    }

    // Create a new set object to trigger proper re-render
    this.expandedRows = new Set(expandedRows);
    this.requestUpdate();
    this.dispatchToggleRow();
  }

  // Toggle all rows between expanded and collapsed
  toggleAllRows() {
    const expandedRows = new Set();
    if (this.expandedRows.size === 0) {
      // Expand all once all rows are collapsed
      this.deptData.forEach((dept) => expandedRows.add(dept.id));
    }
    this.expandedRows = expandedRows;
    this.requestUpdate();
    this.dispatchToggleRow();
  }

  updated(changedProperties) {
    // Populate charts for expanded rows after component updates
    if (
      changedProperties.has("expandedRows") ||
      changedProperties.has("deptData")
    ) {
      this.expandedRows.forEach((deptId) => {
        this.renderExpandedRowCharts(deptId);
      });
    }
  }

  renderRow(dept) {
    const statusColor = this.getStatusColor(dept.variancePct);
    const isExpanded = this.expandedRows.has(dept.id);
    const chevronClass = isExpanded ? "fa-chevron-down" : "fa-chevron-right";

    return html`
      <tr class="hover:bg-base-200" data-dept-id="${dept.id}">
        <td class="py-1 px-2 w-8">
          <button
            class="btn btn-ghost btn-xs p-0 min-h-0 h-6"
            @click="${() => this.toggleRow(dept.id)}"
          >
            <i class="fas text-xs ${chevronClass}"></i>
          </button>
        </td>
        <td class="py-1 px-2 font-medium text-xs">${dept.name}</td>
        <td class="py-1 px-2 text-right font-mono text-xs">
          ${formatAccounting(dept.monthRevenue)}
        </td>
        <td
          class="py-1 px-2 text-right font-mono text-xs border-r-2 border-base-300"
        >
          ${formatAccounting(dept.monthExpense)}
        </td>
        <td class="py-1 px-2 text-right font-mono text-xs">
          ${formatAccounting(dept.ytdRevenue)}
        </td>
        <td
          class="py-1 px-2 text-right font-mono text-xs border-r-2 border-base-300"
        >
          ${formatAccounting(dept.ytdExpense)}
        </td>
        <td class="py-1 px-2 text-right font-mono text-xs">
          ${formatAccounting(dept.ytdNetIncome)}
        </td>
        <td class="py-1 px-2 text-right font-mono text-xs">
          ${formatAccounting(dept.variance)}
        </td>
        <td class="py-1 px-2 text-right font-mono text-xs ${statusColor}">
          ${Math.round(dept.variancePct)}%
        </td>
        <td class="py-1 px-2 text-center ${statusColor}">
          <i class="fas fa-circle text-sm"></i>
        </td>
      </tr>
      ${isExpanded ? this.renderExpandedRow(dept) : ""}
    `;
  }

  renderExpandedRow(dept) {
    const feedbackKey = `${dept.id}-${this.selectedMonth}`;
    const feedbackComment = this.feedback[feedbackKey] || "";
    const escapedComment = escapeHtml(feedbackComment);
    const commentColor = escapedComment ? "" : "text-base-content/40";
    return html`
      <tr class="bg-base-50">
        <td colspan="10" class="p-6">
          <div class="flex gap-4 justify-start items-center ml-8 my-1">
            <div
              class="border border-base-300 rounded-md p-1 flex flex-row gap-4 h-32"
            >
              <div class="w-80">
                <data-chart
                  id="volume-chart-${dept.id}"
                  height="h-30"
                ></data-chart>
              </div>
              <div class="w-80">
                <data-chart
                  id="fte-chart-${dept.id}"
                  height="h-30"
                ></data-chart>
              </div>
            </div>
            <div
              class="border border-base-300 rounded-md p-2 h-32 text-xs flex-1 ${commentColor}"
            >
              ${escapedComment || "No comments for this month"}
            </div>
            <div class="flex justify-end">
              <a
                href="kpi.html?dept=${dept.id}&month=${this.selectedMonth}"
                class="btn btn-ghost btn-xs flex items-center no-underline h-10"
                title="View details"
              >
                <i class="fas fa-chevron-right"></i>
              </a>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  // Display the charts for an expanded department row. This function is triggered
  // by expandedRows property change rather than by render() function.
  renderExpandedRowCharts(deptId) {
    const dept = this.deptData.find((d) => d.id === deptId);
    if (!dept) return;

    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      const volumeChart = this.querySelector(`#volume-chart-${deptId}`);
      const fteChart = this.querySelector(`#fte-chart-${deptId}`);

      if (volumeChart) {
        volumeChart.options = this.getEchartOptions(
          dept.volumeTrend,
          "Volumes",
          true // round values and format with commas
        );
      }

      if (fteChart) {
        fteChart.options = this.getEchartOptions(dept.fteTrend, "FTE");
      }
    }, 0);
  }

  getEchartOptions(data, title, roundValues = false) {
    // ECharts line chart configuration given a set of data [{month, value}]
    const months = data.map((d) => dayjs(d.month).format("MMM YYYY"));
    const values = data.map((d) => d.value);

    return {
      title: {
        text: title,
        left: "center",
        top: "0px",
        textStyle: { fontSize: 12, fontWeight: "bold", color: "#1f2937" },
      },
      grid: {
        left: "10%",
        right: "10%",
        bottom: "15%",
        top: "25%",
        containLabel: false,
      },
      tooltip: {
        trigger: "axis",
        formatter: (params) => {
          const value = params[0].value;
          const formatted = roundValues
            ? Math.round(value).toLocaleString()
            : value.toFixed(1);
          return `${params[0].axisValue}<br/>${formatted}`;
        },
      },
      xAxis: {
        type: "category",
        data: months,
        axisLabel: { fontSize: 10 },
      },
      yAxis: {
        type: "value",
        axisLabel: { fontSize: 10 },
      },
      series: [
        {
          type: "line",
          data: values,
          smooth: true,
          itemStyle: { color: "#3b82f6" },
          lineStyle: { width: 2 },
          // areaStyle: { opacity: 0.3, color: "#3b82f6" },
          animation: false,
        },
      ],
    };
  }

  render() {
    const toggleAllTitle =
      this.expandedRows.size > 0 ? "Collapse All" : "Expand All";
    const toggleAllIconClass =
      this.expandedRows.size > 0 ? "fa-minus-square" : "fa-plus-square";
    return html`
      <div class="card bg-base-100 shadow-lg">
        <div class="card-body p-4">
          <div class="overflow-x-auto">
            <table class="table table-xs">
              <thead class="bg-base-200 text-xs uppercase">
                <tr>
                  <th class="w-8">
                    <button
                      class="btn btn-ghost btn-xs hover:bg-base-300 px-1 py-1 border-0"
                      title="${toggleAllTitle}"
                      @click="${this.toggleAllRows}"
                    >
                      <i class="fa-regular ${toggleAllIconClass}"></i>
                    </button>
                  </th>
                  <th class="text-left">Department</th>
                  <th class="text-right">Month Revenue</th>
                  <th class="text-right border-r-2 border-base-300">
                    Month Expenses
                  </th>
                  <th class="text-right">YTD Revenue</th>
                  <th class="text-right border-r-2 border-base-300">
                    YTD Expenses
                  </th>
                  <th class="text-right">Net Income</th>
                  <th class="text-right">Variance to Budget</th>
                  <th class="text-right">%</th>
                  <th class="text-center"></th>
                </tr>
              </thead>
              <tbody>
                ${this.deptData.map((dept) => this.renderRow(dept))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
}

window.customElements.define("depts-summary", DeptsSummary);
