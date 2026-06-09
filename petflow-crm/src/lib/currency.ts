/**
 * Formats a number as currency using the provided currency code.
 * Falls back to INR (Rupees) if the formatting fails or is invalid.
 */
export function formatCurrency(
  amount: number,
  currencyCode: string = 'INR',
  options?: Intl.NumberFormatOptions
): string {
  try {
    const cleanCode = (currencyCode || 'INR').trim().toUpperCase();
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: cleanCode,
      maximumFractionDigits: 0,
      ...options,
    }).format(amount);
  } catch (error) {
    // Fallback if the currency code isn't supported by the user's environment
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
        ...options,
      }).format(amount);
    } catch {
      return `₹${amount}`;
    }
  }
}
