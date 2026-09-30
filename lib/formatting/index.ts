export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  precision: number;
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: "USD", name: "US Dollar", symbol: "$", precision: 2 },
  { code: "EUR", name: "Euro", symbol: "€", precision: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", precision: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", precision: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", precision: 2 },
  { code: "PKR", name: "Pakistani Rupee", symbol: "Rs", precision: 2 },
  { code: "INR", name: "Indian Rupee", symbol: "₹", precision: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", precision: 0 },
  { code: "AED", name: "UAE Dirham", symbol: "AED", precision: 2 },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR", precision: 2 },
];

export function getCurrencyConfig(code = "USD"): CurrencyConfig {
  return (
    SUPPORTED_CURRENCIES.find((c) => c.code.toUpperCase() === code.toUpperCase()) || {
      code: code.toUpperCase(),
      name: code.toUpperCase(),
      symbol: "$",
      precision: 2,
    }
  );
}

export function formatCurrencyWithSettings(
  amount: number,
  currencyCode = "USD",
  numberFormat = "comma_dot"
): string {
  const currency = getCurrencyConfig(currencyCode);
  const formattedNumber = formatNumberWithSettings(amount, numberFormat, currency.precision);
  return `${currency.symbol}${formattedNumber}`;
}

export function formatNumberWithSettings(
  value: number,
  numberFormat = "comma_dot",
  decimals = 2
): string {
  const fixed = value.toFixed(decimals);
  const [integerPart, decimalPart] = fixed.split(".");

  let thousandsSeparator = ",";
  let decimalSeparator = ".";

  if (numberFormat === "dot_comma") {
    thousandsSeparator = ".";
    decimalSeparator = ",";
  } else if (numberFormat === "space_dot") {
    thousandsSeparator = " ";
    decimalSeparator = ".";
  }

  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
  return decimals > 0 ? `${formattedInteger}${decimalSeparator}${decimalPart}` : formattedInteger;
}

export function formatDateWithSettings(
  date: Date | string | number,
  dateFormat = "YYYY-MM-DD"
): string {
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  switch (dateFormat) {
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "DD/MM/YYYY":
      return `${day}/${month}/${year}`;
    case "YYYY-MM-DD":
    default:
      return `${year}-${month}-${day}`;
  }
}
