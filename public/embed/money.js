/** Display-only normalization; preserves the numeric value and existing K/M/B units. */
export function moneyText(value = '') {
  return String(value).replace(/([−-]?)\$([−-]?)(\d[\d,]*(?:\.\d+)?)([KMB])?/g, (_, before, after, amount, unit) => {
    const n = Number(amount.replaceAll(',', ''));
    const sign = before || after ? '-' : '';
    if (unit) return `${sign}$${amount}${unit}`;
    if (n >= 1000) return `${sign}$${Number((n / (n >= 1e9 ? 1e9 : n >= 1e6 ? 1e6 : 1000)).toFixed(3))}${n >= 1e9 ? 'B' : n >= 1e6 ? 'M' : 'K'}`;
    return `${sign}$${amount}`;
  });
}
