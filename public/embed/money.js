/** Display-only normalization; PPSF uses whole dollars, other prices retain existing units. */
export function moneyText(value = '', pricePerSqFt = false) {
  return String(value).replace(/([−-]?)\$([−-]?)(\d[\d,]*(?:\.\d+)?)([KMB])?/g, (_, before, after, amount, unit) => {
    const n = Number(amount.replaceAll(',', ''));
    const sign = before || after ? '-' : '';
    if (pricePerSqFt) {
      const scale = {K: 1000, M: 1e6, B: 1e9}[unit] || 1;
      const punctuation = amount.endsWith(',') ? ',' : '';
      return `${sign}$${Math.round(n * scale).toLocaleString('en-US')}${punctuation}`;
    }
    if (unit) return `${sign}$${amount}${unit}`;
    if (n >= 1000) return `${sign}$${Number((n / (n >= 1e9 ? 1e9 : n >= 1e6 ? 1e6 : 1000)).toFixed(3))}${n >= 1e9 ? 'B' : n >= 1e6 ? 'M' : 'K'}`;
    return `${sign}$${amount}`;
  });
}
