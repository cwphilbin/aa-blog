/** Names are carried from re-data's territory lookup by the report/feed writer. */
export function storedNeighborhoodNames(value) {
  const names = value?.neighborhoodNames;
  if (names === undefined) return undefined;
  if (!names || !['name_1', 'name_2', 'full'].every(key => typeof names[key] === 'string' && !/[\u0000-\u001f\u007f]/.test(names[key])) || !names.name_1 || !names.full) {
    throw new Error('Invalid stored neighborhood names');
  }
  return {name_1: names.name_1, name_2: names.name_2, full: names.full};
}
export function neighborhoodName(names) {
  return names.name_1 + (names.name_2 ? ' & ' + names.name_2 : '');
}
export function neighborhoodLabel(zip, names) {
  if (!/^[0-9]{5}$/.test(zip)) throw new Error('Five-digit ZIP required');
  return neighborhoodName(names) + ' (' + zip + ')';
}
