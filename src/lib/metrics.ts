/** Missing metrics stay unavailable; never coerce null into a real zero. */
export function displayableMetric(value: unknown, keepZero = false): value is number {
  return typeof value === 'number' && Number.isFinite(value) && (value !== 0 || keepZero);
}
