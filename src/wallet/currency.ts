/**
 * Display currency for prices and portfolio value.
 *
 * figma 249:2506 ("select currency") offers USD, EUR and GBP. The choice is a
 * display setting only — balances are always held in the coin itself, and
 * changing this never touches a key or a transaction.
 */
export type CurrencyCode = 'usd' | 'eur' | 'gbp';

export interface Currency {
  code: CurrencyCode;
  /** ISO code as shown in the list. */
  label: string;
  name: string;
  symbol: string;
  /** Flag emoji, standing in for the design's flag artwork. */
  flag: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'usd', label: 'USD', name: 'United States Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'eur', label: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'gbp', label: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
];

export const DEFAULT_CURRENCY: CurrencyCode = 'usd';

export function findCurrency(code: string): Currency | undefined {
  return CURRENCIES.find((currency) => currency.code === code);
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return CURRENCIES.some((currency) => currency.code === value);
}

/** Filters the list for the design's search field. */
export function searchCurrencies(query: string): Currency[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return CURRENCIES;
  return CURRENCIES.filter(
    (currency) =>
      currency.label.toLowerCase().includes(needle) ||
      currency.name.toLowerCase().includes(needle),
  );
}
