// Platform Configuration and Compliance Feature Flags

export interface CurrencyConfig {
  code: string;
  symbol: string;
  minStake: number;
  maxStake: number;
  step: number;
  presetAmounts: number[];
  defaultAmount: number;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  INR: {
    code: 'INR',
    symbol: '₹',
    minStake: 100,
    maxStake: 50000,
    step: 100,
    presetAmounts: [500, 1000, 2500, 5000, 10000],
    defaultAmount: 1000
  },
  USD: {
    code: 'USD',
    symbol: '$',
    minStake: 10,
    maxStake: 2000,
    step: 5,
    presetAmounts: [25, 50, 100, 250, 500],
    defaultAmount: 50
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    minStake: 10,
    maxStake: 2000,
    step: 5,
    presetAmounts: [25, 50, 100, 250, 500],
    defaultAmount: 50
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    minStake: 10,
    maxStake: 2000,
    step: 5,
    presetAmounts: [20, 50, 100, 200, 400],
    defaultAmount: 50
  }
};

export const CONFIG = {
  // Global feature flags
  REAL_MONEY_STAKES_ENABLED: process.env.REAL_MONEY_STAKES_ENABLED !== 'false',
  COMMUNITY_ENABLED: true,
  COMMENTS_ENABLED: true,
  PUBLIC_CHALLENGES_ENABLED: true,
  REFUNDS_ENABLED: true,
  PROOF_REVIEW_ENABLED: true,

  // Staking limits and defaults
  defaultCurrency: 'INR',
  supportedCountries: ['IN', 'US', 'GB', 'CA', 'AU', 'EU', 'SG', 'AE'],
  
  // Platform fee model (transparent, 0% platform commission initially)
  platformFeePercent: 0,
  estimatedPaymentFeePercent: 2.0, // payment gateway processing pass-through reference if applicable

  // Dispute & Settlement configuration
  disputeWindowDays: 7,
  minAgeRequirement: 18,

  // Admin emails (configured in environment or fallback)
  adminEmails: (process.env.ADMIN_EMAILS || 'admin@streakgrid.app,nitesh@streakgrid.app')
    .split(',')
    .map((e) => e.trim().toLowerCase())
};

export function getCurrencyConfig(currencyCode: string = 'INR'): CurrencyConfig {
  return SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES.INR;
}

export function formatCurrencyAmount(amount: number, currencyCode: string = 'INR'): string {
  const cfg = getCurrencyConfig(currencyCode);
  return `${cfg.symbol}${amount.toLocaleString('en-US')}`;
}
