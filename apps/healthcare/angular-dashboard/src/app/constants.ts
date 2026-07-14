export const SEARCH_TIMEOUT_MS = 8_000;
// Generous because CPU-only inference on self-hosted hardware (e.g. a NAS) can
// take minutes for the first request while the model loads into memory.
export const MN_TIMEOUT_MS     = 150_000;
