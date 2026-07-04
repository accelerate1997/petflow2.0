/**
 * Country / Market configuration presets for PetFlow.
 * When a tenant selects their country in Settings, these values are
 * auto-applied. All values remain individually editable after applying.
 */

export interface CountryConfig {
  label: string
  currency_symbol: string
  currency_code: string
  tax_label: string
  tax_presets: number[]
  date_format: string
  time_format: '12h' | '24h'
  timezone: string
  phone_prefix: string
  tip_enabled: boolean
}

export const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  IN: {
    label: 'India 🇮🇳',
    currency_symbol: '₹',
    currency_code: 'INR',
    tax_label: 'GST',
    tax_presets: [0, 5, 12, 18],
    date_format: 'DD/MM/YYYY',
    time_format: '24h',
    timezone: 'Asia/Kolkata',
    phone_prefix: '+91',
    tip_enabled: false,
  },
  AE: {
    label: 'UAE / Dubai 🇦🇪',
    currency_symbol: 'د.إ',
    currency_code: 'AED',
    tax_label: 'VAT',
    tax_presets: [0, 5],
    date_format: 'DD/MM/YYYY',
    time_format: '24h',
    timezone: 'Asia/Dubai',
    phone_prefix: '+971',
    tip_enabled: false,
  },
  US: {
    label: 'United States 🇺🇸',
    currency_symbol: '$',
    currency_code: 'USD',
    tax_label: 'Sales Tax',
    tax_presets: [0, 6, 8, 10],
    date_format: 'MM/DD/YYYY',
    time_format: '12h',
    timezone: 'America/New_York',
    phone_prefix: '+1',
    tip_enabled: true,
  },
  GB: {
    label: 'United Kingdom 🇬🇧',
    currency_symbol: '£',
    currency_code: 'GBP',
    tax_label: 'VAT',
    tax_presets: [0, 5, 20],
    date_format: 'DD/MM/YYYY',
    time_format: '24h',
    timezone: 'Europe/London',
    phone_prefix: '+44',
    tip_enabled: false,
  },
  AU: {
    label: 'Australia 🇦🇺',
    currency_symbol: 'A$',
    currency_code: 'AUD',
    tax_label: 'GST',
    tax_presets: [0, 10],
    date_format: 'DD/MM/YYYY',
    time_format: '12h',
    timezone: 'Australia/Sydney',
    phone_prefix: '+61',
    tip_enabled: false,
  },
  CA: {
    label: 'Canada 🇨🇦',
    currency_symbol: 'CA$',
    currency_code: 'CAD',
    tax_label: 'Tax',
    tax_presets: [0, 5, 13, 15],
    date_format: 'MM/DD/YYYY',
    time_format: '12h',
    timezone: 'America/Toronto',
    phone_prefix: '+1',
    tip_enabled: true,
  },
  SG: {
    label: 'Singapore 🇸🇬',
    currency_symbol: 'S$',
    currency_code: 'SGD',
    tax_label: 'GST',
    tax_presets: [0, 9],
    date_format: 'DD/MM/YYYY',
    time_format: '24h',
    timezone: 'Asia/Singapore',
    phone_prefix: '+65',
    tip_enabled: false,
  },
}

export type CountryCode = keyof typeof COUNTRY_CONFIGS
