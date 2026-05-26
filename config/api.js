export const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
export const OPEN_METEO_GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search';

/**
 * Optional network simulation flags for local development and testing.
 * Set SIMULATE_DELAY_MS > 0 to delay responses, or SIMULATE_FORCE_STATUS to force an HTTP error.
 * Restore defaults (0 and null) before production use.
 */
export const SIMULATE_DELAY_MS = 0;
export const SIMULATE_FORCE_STATUS = null;
