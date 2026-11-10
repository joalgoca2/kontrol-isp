export type SupportedCurrency =
  | "USD"
  | "MXN"
  | "EUR"
  | "BRL"
  | "COP"
  | "ARS"
  | "CLP"
  | "GBP";

export const EXCHANGE_RATES: Record<SupportedCurrency, number> = {
  USD: 1.0,
  MXN: 20.0,
  EUR: 0.92,
  BRL: 5.5,
  COP: 4000.0,
  ARS: 1000.0,
  CLP: 950.0,
  GBP: 0.78,
};

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  USD: "$",
  MXN: "$",
  EUR: "€",
  BRL: "R$",
  COP: "$",
  ARS: "$",
  CLP: "$",
  GBP: "£",
};

export function getSuggestedCurrency(
  locale?: string,
  timezone?: string
): SupportedCurrency {
  if (timezone) {
    if (timezone.includes("Mexico_City")) return "MXN";
    if (timezone.includes("Bogota")) return "COP";
    if (timezone.includes("Buenos_Aires")) return "ARS";
    if (timezone.includes("Santiago")) return "CLP";
    if (timezone.includes("Sao_Paulo")) return "BRL";
    if (timezone.includes("London")) return "GBP";
    if (timezone.includes("Madrid") || timezone.includes("Paris")) return "EUR";
  }

  switch (locale?.toLowerCase()) {
    case "es":
      return "MXN";
    case "pt":
      return "BRL";
    case "en":
    default:
      return "USD";
  }
}

export function convertCurrency(
  amountInUsd: number,
  targetCurrency: SupportedCurrency
): number {
  const rate = EXCHANGE_RATES[targetCurrency] ?? 1.0;
  return amountInUsd * rate;
}

export function formatCurrencyValue(
  amount: number,
  currency: SupportedCurrency
): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? "$";
  const formattedAmount = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (currency === "EUR" || currency === "GBP") {
    return `${formattedAmount} ${symbol} ${currency}`;
  }
  return `${symbol}${formattedAmount} ${currency}`;
}

export function formatConvertedPrice(
  amountInUsd: number,
  locale?: string,
  timezone?: string
): {
  usdFormatted: string;
  convertedFormatted?: string;
  targetCurrency: SupportedCurrency;
} {
  const targetCurrency = getSuggestedCurrency(locale, timezone);
  const usdFormatted = formatCurrencyValue(amountInUsd, "USD");

  if (targetCurrency === "USD") {
    return { usdFormatted, targetCurrency };
  }

  const convertedAmount = convertCurrency(amountInUsd, targetCurrency);
  const convertedFormatted = formatCurrencyValue(
    convertedAmount,
    targetCurrency
  );

  return {
    usdFormatted,
    convertedFormatted,
    targetCurrency,
  };
}
