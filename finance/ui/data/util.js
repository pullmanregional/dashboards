import dayjs from "dayjs";
import dayOfYear from "dayjs/plugin/dayOfYear";
dayjs.extend(dayOfYear);

// ------------------------------------------------------------
// Date-based utility functions
// ------------------------------------------------------------
export function fteHrsInYear(year) {
  const FTE_HOURS_PER_YEAR = 2080;
  const FTE_HOURS_PER_LEAP_YEAR = 2088;
  const isLeapYear = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
  return isLeapYear ? FTE_HOURS_PER_LEAP_YEAR : FTE_HOURS_PER_YEAR;
}

// Calculate percentage of year completed through end of given month
export function pctOfYearThroughDate(monthStr) {
  const month = dayjs(monthStr);
  const daysThroughMonthEnd = month.endOf("month").dayOfYear();
  const daysInYear = month.endOf("year").dayOfYear();
  return daysThroughMonthEnd / daysInYear;
}

// ------------------------------------------------------------
// Accounting utilities
// ------------------------------------------------------------
export function calcVariance(actual, budget) {
  const variance = ((actual - budget) / budget) * 100;
  return variance || 0;
}

// ------------------------------------------------------------
// Number formatting
// ------------------------------------------------------------
const FORMATTERS = {
  currency: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }),

  number: (decimals = 0) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
};

export function formatCurrency(value) {
  return FORMATTERS.currency.format(value || 0);
}

export function formatAccounting(value) {
  const absValue = Math.abs(value || 0);
  const currency = FORMATTERS.currency.format(absValue);
  return value < 0 ? `(${currency})` : currency;
}

export function formatNumber(value, decimals = 0) {
  return FORMATTERS.number(decimals).format(value || 0);
}

export function formatCurrencyInThousands(value) {
  // Get numeric value
  value = value?.toString() || "0";
  const num = parseFloat(value.replace(/[$,]/g, ""));
  if (isNaN(num)) return value;

  // Format as $XXXk with thousand separators
  const valueInK = Math.round(num / 1000);
  const ret = valueInK.toLocaleString("en-US");
  return `$${ret}k`;
}

export function formatVariancePct(actual, budget) {
  if (!budget || budget === 0) return { value: "-", percent: "" };
  const variance = actual - budget;
  const percentVariance = Math.round((variance / budget) * 100);
  return {
    value: formatCurrency(variance),
    percent: `${percentVariance}%`,
  };
}
