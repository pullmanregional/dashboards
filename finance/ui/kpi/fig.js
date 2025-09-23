function populateVolumeChart(chartEl, data) {
  const { volumes = [], budget = [] } = data;
  const months = volumes.slice(-12).map((v) => v.month);
  const actualVolumes = volumes.slice(-12).map((v) => v.volume || 0);

  const annualBudgetVolume = budget.reduce(
    (sum, b) => sum + (b.budget_volume || 0),
    0
  );
  const monthlyBudgetVolume = annualBudgetVolume / 12;
  const budgetLine = new Array(months.length).fill(monthlyBudgetVolume);

  const options = {
    title: {
      text: "Volume vs Budget",
      left: "center",
      textStyle: { fontSize: 16, fontWeight: "bold", color: "#1f2937" },
    },
    tooltip: { trigger: "axis" },
    legend: { data: ["Actual Volume", "Budget"], bottom: 0 },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "15%",
      top: "15%",
      containLabel: true,
    },
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
        itemStyle: { color: "#059669" },
        areaStyle: { opacity: 0.3, color: "#059669" },
      },
      {
        name: "Budget",
        type: "line",
        data: budgetLine,
        lineStyle: { type: "dashed", color: "#6b7280" },
        itemStyle: { color: "#6b7280" },
      },
    ],
  };

  chartEl.options = options;
}

function populateRevenueChart(chartEl, data) {
  const { stats = {} } = data;

  const dataPoints = [
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

  const options = {
    title: {
      text: "Revenue vs Expenses YTD",
      left: "center",
      textStyle: { fontSize: 16, fontWeight: "bold", color: "#1f2937" },
    },
    tooltip: {
      formatter: (params) => {
        const item = dataPoints.find((d) => d.name === params.name);
        return `${
          params.name
        }<br/>Actual: $${params.value.toLocaleString()}<br/>Budget: $${item.budget.toLocaleString()}`;
      },
    },
    legend: { data: ["Actual", "Budget"], bottom: 0 },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "15%",
      top: "15%",
      containLabel: true,
    },
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
          color: (params) => (params.dataIndex === 0 ? "#059669" : "#dc2626"),
        },
      },
      {
        name: "Budget",
        type: "bar",
        data: dataPoints.map((d) => d.budget),
        itemStyle: { color: "#6b7280", opacity: 0.6 },
      },
    ],
  };

  chartEl.options = options;
}

function populateProductivityChart(chartEl, data) {
  const { hours = [] } = data;

  const months = hours.slice(-12).map((h) => h.month);
  const prodHours = hours.slice(-12).map((h) => h.prod_hrs || 0);
  const nonprodHours = hours.slice(-12).map((h) => h.nonprod_hrs || 0);
  const fteValues = hours.slice(-12).map((h) => h.total_fte || 0);

  const options = {
    title: {
      text: "Productivity & FTE Trends",
      left: "center",
      textStyle: { fontSize: 16, fontWeight: "bold", color: "#1f2937" },
    },
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    legend: {
      data: ["Productive Hours", "Non-Productive Hours", "Total FTE"],
      bottom: 0,
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "15%",
      top: "15%",
      containLabel: true,
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
        itemStyle: { color: "#059669" },
      },
      {
        name: "Non-Productive Hours",
        type: "bar",
        stack: "hours",
        data: nonprodHours,
        itemStyle: { color: "#dc2626" },
      },
      {
        name: "Total FTE",
        type: "line",
        yAxisIndex: 1,
        data: fteValues,
        smooth: true,
        itemStyle: { color: "#3b82f6" },
        lineStyle: { width: 3 },
      },
    ],
  };

  chartEl.options = options;
}

export { populateVolumeChart, populateRevenueChart, populateProductivityChart };
