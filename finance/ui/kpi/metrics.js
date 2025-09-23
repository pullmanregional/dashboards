function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value || 0);
}

function populateFinancialMetrics(metricEl, data) {
  const stats = data.stats;
  const revenueVariance =
    ((stats.ytdRevenue - stats.ytdBudgetRevenue) / stats.ytdBudgetRevenue) *
    100;
  const expenseVariance =
    ((stats.ytdExpense - stats.ytdBudgetExpense) / stats.ytdBudgetExpense) *
    100;
  const volumeVariance =
    ((stats.ytmVolume - stats.ytmBudgetVolume) / stats.ytmBudgetVolume) * 100;

  const metrics = [
    {
      title: "YTD Revenue",
      value: formatCurrency(stats.ytdRevenue),
      budgetValue: formatCurrency(stats.ytdBudgetRevenue),
      variance: revenueVariance,
      isExpense: false,
    },
    {
      title: "YTD Expenses",
      value: formatCurrency(stats.ytdExpense),
      budgetValue: formatCurrency(stats.ytdBudgetExpense),
      variance: expenseVariance,
      isExpense: true,
    },
    {
      title: "Net Operating Income",
      value: formatCurrency((stats.ytdRevenue || 0) - (stats.ytdExpense || 0)),
      budgetValue: formatCurrency(
        (stats.ytdBudgetRevenue || 0) - (stats.ytdBudgetExpense || 0)
      ),
      variance: revenueVariance,
      isExpense: false,
    },
    {
      title: `Volume (${stats.volumeUnit || "Units"})`,
      value: formatNumber(stats.ytmVolume),
      budgetValue: formatNumber(stats.ytmBudgetVolume),
      variance: volumeVariance,
      isExpense: false,
    },
  ];

  metricEl.innerHTML = "";
  metrics.forEach((metric) => {
    const metricCard = document.createElement("metric-card");
    metricCard.title = metric.title;
    metricCard.value = metric.value;
    metricCard.budgetValue = metric.budgetValue;
    metricCard.variance = metric.variance;
    metricCard.isExpense = metric.isExpense;
    metricEl.appendChild(metricCard);
  });
}

function populateKPITable(tableEl, data) {
  const stats = data.stats;
  const revenueVariance = stats.varianceRevenuePerVolume || 0;
  const expenseVariance = stats.varianceExpensePerVolume || 0;

  const headers = [
    { title: "KPI", align: "text-left" },
    { title: "Actual", align: "text-right" },
    { title: "Target", align: "text-right" },
    { title: "Variance %", align: "text-right" },
    { title: "Status", align: "text-center" },
  ];

  const rows = [
    [
      `Revenue per ${stats.volumeUnit || "Unit"}`,
      { type: "number", value: formatCurrency(stats.revenuePerVolume) },
      { type: "number", value: formatCurrency(stats.targetRevenuePerVolume) },
      {
        type: "variance",
        value: `${revenueVariance}%`,
        variance: revenueVariance,
      },
      { type: "status", variance: revenueVariance, isExpense: false },
    ],
    [
      `Expense per ${stats.volumeUnit || "Unit"}`,
      { type: "number", value: formatCurrency(stats.expensePerVolume) },
      { type: "number", value: formatCurrency(stats.targetExpensePerVolume) },
      {
        type: "variance",
        value: `${expenseVariance}%`,
        variance: expenseVariance,
      },
      { type: "status", variance: expenseVariance, isExpense: true },
    ],
    [
      "Budgeted FTE",
      { type: "number", value: formatNumber(stats.budgetFTE, 1) },
      { type: "number", value: formatNumber(stats.budgetFTE, 1) },
      { type: "variance", value: "0%", variance: 0 },
      { type: "status", variance: 0, isExpense: false },
    ],
  ];

  tableEl.headers = headers;
  tableEl.rows = rows;
}

function populateVolumeTable(tableEl, data) {
  const volumes = data.volumes.slice(0, 12);

  const headers = [
    { title: "Month", align: "text-left" },
    { title: "Volume", align: "text-right" },
    { title: "Unit", align: "text-center" },
  ];

  const rows = volumes.map((row) => [
    row.month,
    { type: "number", value: formatNumber(row.volume) },
    { type: "center", value: row.unit },
  ]);

  tableEl.headers = headers;
  tableEl.rows = rows;
}

export { populateFinancialMetrics, populateKPITable, populateVolumeTable };
