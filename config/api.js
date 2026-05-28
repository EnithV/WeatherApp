/** Endpoints de Open-Meteo. */
export const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
export const OPEN_METEO_GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search';

/** TTL de caché en memoria (10 minutos). */
export const CACHE_TTL_MS = 10 * 60 * 1000;

/** Máximo de ciudades consultadas en paralelo por solicitud. */
export const MAX_PARALLEL_CITIES = 3;

/** Máximo de ciudades por consulta (CLI y API). */
export const MAX_CITIES_PER_REQUEST = 5;

export const SERVER_PORT = Number(process.env.PORT) || 3000;

/** Límite de solicitudes por IP al endpoint /api/weather. */
export const RATE_LIMIT_MAX = 30;
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const isTest = process.env.NODE_ENV === 'test';

/**
 * Simulación de red para desarrollo local.
 * SIMULATE_DELAY_MS > 0 retrasa respuestas; SIMULATE_FORCE_STATUS fuerza un error HTTP.
 * Deshabilitados en NODE_ENV=test para no alterar las pruebas automatizadas.
 */
export const SIMULATE_DELAY_MS = isTest ? 0 : 0;
export const SIMULATE_FORCE_STATUS = isTest ? null : null;
