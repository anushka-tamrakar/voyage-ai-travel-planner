// Currency utilities with dynamic live exchange rate fetching & 12h localStorage cache

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'Indian Rupee (INR)', locale: 'en-IN' },
  { code: 'USD', symbol: '$', label: 'US Dollar (USD)', locale: 'en-US' },
  { code: 'EUR', symbol: '€', label: 'Euro (EUR)', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', label: 'British Pound (GBP)', locale: 'en-GB' },
  { code: 'AED', symbol: 'AED', label: 'UAE Dirham (AED)', locale: 'en-AE' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar (SGD)', locale: 'en-SG' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen (JPY)', locale: 'ja-JP' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar (AUD)', locale: 'en-AU' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar (CAD)', locale: 'en-CA' },
];

export const FALLBACK_RATES_FROM_INR = {
  INR: 1.0,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0094,
  AED: 0.044,
  SGD: 0.016,
  JPY: 1.85,
  AUD: 0.018,
  CAD: 0.0165,
};

const CACHE_KEY = 'voyage_exchange_rates_v1';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export const getExchangeRates = async () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS && parsed.rates) {
        return parsed.rates;
      }
    }

    const response = await fetch('https://open.er-api.com/v6/latest/INR');
    if (!response.ok) throw new Error('Failed to fetch rates');
    const data = await response.json();
    if (data && data.rates) {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          rates: data.rates,
        })
      );
      return data.rates;
    }
  } catch (err) {
    console.warn('Using fallback exchange rates table:', err);
  }
  return FALLBACK_RATES_FROM_INR;
};

export const convertINR = (amountInINR, targetCurrency, rates = FALLBACK_RATES_FROM_INR) => {
  const num = Number(amountInINR) || 0;
  if (targetCurrency === 'INR') return num;
  const rate = rates[targetCurrency] || FALLBACK_RATES_FROM_INR[targetCurrency] || 1;
  return num * rate;
};

export const convertToINR = (amountInCurrency, sourceCurrency, rates = FALLBACK_RATES_FROM_INR) => {
  const num = Number(amountInCurrency) || 0;
  if (sourceCurrency === 'INR') return num;
  const rate = rates[sourceCurrency] || FALLBACK_RATES_FROM_INR[sourceCurrency] || 1;
  return Math.round(num / rate);
};

export const formatCurrency = (amountInINR, targetCurrency = 'INR', rates = FALLBACK_RATES_FROM_INR) => {
  const converted = convertINR(amountInINR, targetCurrency, rates);
  const currencyMeta = SUPPORTED_CURRENCIES.find((c) => c.code === targetCurrency) || SUPPORTED_CURRENCIES[0];

  try {
    return new Intl.NumberFormat(currencyMeta.locale, {
      style: 'currency',
      currency: targetCurrency,
      maximumFractionDigits: targetCurrency === 'JPY' ? 0 : 0,
    }).format(converted);
  } catch (e) {
    return `${currencyMeta.symbol} ${Math.round(converted).toLocaleString('en-IN')}`;
  }
};

export const parseCostToINR = (costStr) => {
  if (typeof costStr === 'number') return costStr;
  if (!costStr) return 0;
  const s = String(costStr);
  const digits = s.replace(/[^0-9.]/g, '');
  const val = parseFloat(digits);
  return isNaN(val) ? 0 : val;
};
