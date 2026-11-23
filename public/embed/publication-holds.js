/** User-approved October holds. Sources and existing routes are retained. */
const octoberHolds = new Set(["11930", "30332", "33122", "34138", "34139", "34140", "34681", "37228", "43217", "85264", "85337", "90743", "92059", "92086", "92254", "92282", "92347", "93254", "93441", "94018", "94060", "94074", "94514", "95615", "95639", "95830", "98224"]);
export function publicationExcluded(zip, month) {
  return month === '2026-10' && octoberHolds.has(zip);
}
