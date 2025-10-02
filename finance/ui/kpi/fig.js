// ------------------------------------------------------------
// Chart configuration constants
// ------------------------------------------------------------
const CHART_CONFIG = {
  colors: {
    primary: "#059669",
    secondary: "#6b7280",
    revenue: "#059669",
    expense: "#dc2626",
    productive: "#059669",
    nonproductive: "#dc2626",
    fte: "#3b82f6",
  },

  commonOptions: {
    title: {
      left: "center",
      textStyle: { fontSize: 16, fontWeight: "bold", color: "#1f2937" },
    },
    tooltip: { trigger: "axis" },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "15%",
      top: "30%",
      containLabel: true,
    },
  },
};

// ------------------------------------------------------------
// Volume chart utilities
// ------------------------------------------------------------
function calculateBudgetLine(budget, monthsLength) {
  const annualBudgetVolume = budget.reduce(
    (sum, b) => sum + (b.budget_volume || 0),
    0
  );
  const monthlyBudgetVolume = Math.floor(annualBudgetVolume / 12);
  return new Array(monthsLength).fill(monthlyBudgetVolume);
}

function createVolumeChartOptions(months, actualVolumes, budgetLine) {
  return {
    ...CHART_CONFIG.commonOptions,
    title: {
      ...CHART_CONFIG.commonOptions.title,
      text: "Volume vs Budget",
    },
    legend: { data: ["Actual Volume", "Budget"], bottom: 0 },
    xAxis: {
      type: "category",
      data: months,
      axisLabel: { rotate: 45 },
    },
    yAxis: { type: "value", name: "Volume" },
    series: [
      {
        name: "Actual Volume",
        type: "line",
        data: actualVolumes,
        smooth: true,
        itemStyle: { color: CHART_CONFIG.colors.primary },
        areaStyle: { opacity: 0.3, color: CHART_CONFIG.colors.primary },
      },
      {
        name: "Budget",
        type: "line",
        data: budgetLine,
        lineStyle: { type: "dashed", color: CHART_CONFIG.colors.secondary },
        itemStyle: { color: CHART_CONFIG.colors.secondary },
      },
    ],
  };
}

function populateVolumeChart(chartEl, data) {
  const { volumes = [], budget = [] } = data;
  const months = volumes.slice(-12).map((v) => v.month);
  const actualVolumes = volumes.slice(-12).map((v) => v.volume || 0);
  const budgetLine = calculateBudgetLine(budget, months.length);

  chartEl.options = createVolumeChartOptions(months, actualVolumes, budgetLine);
}

// ------------------------------------------------------------
// Revenue chart utilities
// ------------------------------------------------------------
function createRevenueDataPoints(stats) {
  return [
    {
      name: "Revenue",
      value: stats.ytdRevenue || 0,
      budget: stats.ytdBudgetRevenue || 0,
    },
    {
      name: "Expenses",
      value: stats.ytdExpense || 0,
      budget: stats.ytdBudgetExpense || 0,
    },
  ];
}

function createRevenueTooltipFormatter(dataPoints) {
  return (params) => {
    const item = dataPoints.find((d) => d.name === params.name);
    return `${
      params.name
    }<br/>Actual: $${params.value.toLocaleString()}<br/>Budget: $${item.budget.toLocaleString()}`;
  };
}

function createRevenueChartOptions(dataPoints) {
  return {
    ...CHART_CONFIG.commonOptions,
    title: {
      ...CHART_CONFIG.commonOptions.title,
      text: "Revenue vs Expenses YTD",
    },
    tooltip: {
      formatter: createRevenueTooltipFormatter(dataPoints),
    },
    legend: { data: ["Actual", "Budget"], bottom: 0 },
    xAxis: { type: "category", data: dataPoints.map((d) => d.name) },
    yAxis: {
      type: "value",
      axisLabel: { formatter: (value) => `$${(value / 1000000).toFixed(1)}M` },
    },
    series: [
      {
        name: "Actual",
        type: "bar",
        data: dataPoints.map((d) => d.value),
        itemStyle: {
          color: (params) =>
            params.dataIndex === 0
              ? CHART_CONFIG.colors.revenue
              : CHART_CONFIG.colors.expense,
        },
      },
      {
        name: "Budget",
        type: "bar",
        data: dataPoints.map((d) => d.budget),
        itemStyle: { color: CHART_CONFIG.colors.secondary, opacity: 0.6 },
      },
    ],
  };
}

function populateRevenueChart(chartEl, data) {
  const { stats = {} } = data;
  const dataPoints = createRevenueDataPoints(stats);
  chartEl.options = createRevenueChartOptions(dataPoints);
}

// ------------------------------------------------------------
// Productivity chart utilities
// ------------------------------------------------------------
function extractProductivityData(hours) {
  const recentHours = hours.slice(-12);
  return {
    months: recentHours.map((h) => h.month),
    prodHours: recentHours.map((h) => Math.round(h.prod_hrs || 0)),
    nonprodHours: recentHours.map((h) => Math.round(h.nonprod_hrs || 0)),
    fteValues: recentHours.map((h) => Math.round(h.total_fte || 0)),
  };
}

function createProductivityChartOptions(
  months,
  prodHours,
  nonprodHours,
  fteValues
) {
  return {
    ...CHART_CONFIG.commonOptions,
    title: {
      ...CHART_CONFIG.commonOptions.title,
      text: "Productivity & FTE",
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line" },
      formatter: (params) => {
        let result = `<strong>${params[0].axisValue}</strong><br/>`;
        let prodValue = 0;
        let nonprodValue = 0;
        let total = 0;

        params.forEach((item) => {
          if (item.seriesName === "Productive Hours") {
            prodValue = item.value;
          } else if (item.seriesName === "Non-Productive Hours") {
            nonprodValue = item.value;
          }
        });

        total = prodValue + nonprodValue;

        params.forEach((item) => {
          const marker = item.marker;
          if (item.seriesName === "Productive Hours" && total > 0) {
            const pct = Math.round((prodValue / total) * 100);
            result += `${marker} ${
              item.seriesName
            }: ${item.value.toLocaleString()} (${pct}%)<br/>`;
          } else if (item.seriesName === "Non-Productive Hours" && total > 0) {
            const pct = Math.round((nonprodValue / total) * 100);
            result += `${marker} ${
              item.seriesName
            }: ${item.value.toLocaleString()} (${pct}%)<br/>`;
          } else {
            result += `${marker} ${
              item.seriesName
            }: ${item.value.toLocaleString()}<br/>`;
          }
        });

        return result;
      },
    },
    legend: {
      data: ["Productive Hours", "Non-Productive Hours", "Total FTE"],
      bottom: 0,
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: months,
      axisLabel: { rotate: 45 },
    },
    yAxis: [
      {
        type: "value",
        name: "Hours",
        position: "left",
        axisLabel: { formatter: "{value}" },
      },
      {
        type: "value",
        name: "FTE",
        position: "right",
        axisLabel: { formatter: "{value}" },
      },
    ],
    series: [
      {
        name: "Productive Hours",
        type: "bar",
        stack: "hours",
        data: prodHours,
        itemStyle: { color: CHART_CONFIG.colors.productive },
      },
      {
        name: "Non-Productive Hours",
        type: "bar",
        stack: "hours",
        data: nonprodHours,
        itemStyle: { color: CHART_CONFIG.colors.nonproductive },
      },
      {
        name: "Total FTE",
        type: "line",
        yAxisIndex: 1,
        data: fteValues,
        smooth: true,
        itemStyle: { color: CHART_CONFIG.colors.fte },
        lineStyle: { width: 3 },
      },
    ],
  };
}

function populateProductivityChart(chartEl, data) {
  const { hours = [] } = data;
  const { months, prodHours, nonprodHours, fteValues } =
    extractProductivityData(hours);
  chartEl.options = createProductivityChartOptions(
    months,
    prodHours,
    nonprodHours,
    fteValues
  );
}

export { populateVolumeChart, populateRevenueChart, populateProductivityChart };
