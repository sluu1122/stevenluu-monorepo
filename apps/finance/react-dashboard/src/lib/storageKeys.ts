// Shared localStorage keys used by both the repository layer and the
// providers that read/write them directly (outside the repository's own
// scenario/override data), so neither side hardcodes a string the other has
// to match.
export const ACTIVE_SCENARIO_STORAGE_KEY = 'retirement-planner:active-scenario-id';
