/**
 * Integración con Open-Meteo: geocodificación, pronóstico actual,
 * validación de entradas, caché y consultas concurrentes.
 */
import {
  CACHE_TTL_MS,
  MAX_PARALLEL_CITIES,
  MAX_CITIES_PER_REQUEST,
  OPEN_METEO_BASE,
  OPEN_METEO_GEOCODING,
  SIMULATE_DELAY_MS,
  SIMULATE_FORCE_STATUS,
} from '../config/api.js';
import { createCache } from './cache.js';

export const MAX_CITY_LENGTH = 100;
const CITY_PATTERN = /^[\p{L}\p{N}\s\-,.()]+$/u;

const weatherCache = createCache(CACHE_TTL_MS);

export function normalizeCityKey(city) {
  return city.trim().toLowerCase();
}

/** Valida y devuelve el nombre de ciudad normalizado para CLI, API y cliente web. */
export function validateCityName(value) {
  const city = String(value ?? '').trim();

  if (!city) {
    throw new Error('Ingrese el nombre de una ciudad.');
  }
  if (city.length > MAX_CITY_LENGTH) {
    throw new Error(`El nombre de la ciudad no puede exceder ${MAX_CITY_LENGTH} caracteres.`);
  }
  if (!CITY_PATTERN.test(city)) {
    throw new Error('El nombre de la ciudad contiene caracteres inválidos.');
  }

  return city;
}

function assertFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} debe ser un número finito.`);
  }
}

/**
 * Petición HTTP con timeout, reintentos ante 429/5xx y JSON tipado.
 * options.fetchImpl permite inyectar fetch en pruebas unitarias.
 */
export async function fetchJson(url, context, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const skipSimulation = options.skipSimulation ?? false;
  const FETCH_TIMEOUT_MS = 5000;
  const MAX_RETRIES = 2;
  const BASE_RETRY_DELAY_MS = 500;
  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      if (!skipSimulation && SIMULATE_FORCE_STATUS) {
        const status = SIMULATE_FORCE_STATUS;
        const statusText = status >= 500 ? 'Internal Server Error' : 'Error';
        throw new Error(`${context}: ${status} ${statusText}`);
      }

      if (!skipSimulation && SIMULATE_DELAY_MS > 0) {
        await new Promise((resolve, reject) => {
          const t = setTimeout(resolve, SIMULATE_DELAY_MS);
          controller.signal.addEventListener('abort', () => {
            clearTimeout(t);
            reject(new Error(`${context}: timeout después de ${FETCH_TIMEOUT_MS} ms`));
          }, { once: true });
        });
      }

      let response;
      try {
        response = await fetchImpl(url, { signal: controller.signal });
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error(`${context}: timeout después de ${FETCH_TIMEOUT_MS} ms`);
        }

        if (attempt < MAX_RETRIES) {
          attempt += 1;
          const retryDelay = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }

        throw new Error(`${context}: error de red o conexión (${error.message})`);
      }

      if (!response.ok) {
        const { status, statusText } = response;
        const isRetryable = status === 429 || (status >= 500 && status < 600);

        if (isRetryable && attempt < MAX_RETRIES) {
          attempt += 1;
          const retryDelay = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }

        if (status === 429) {
          throw new Error(`${context}: límite de tasa alcanzado (429 ${statusText}). Intente de nuevo más tarde.`);
        }

        throw new Error(`${context}: ${status} ${statusText}`);
      }

      try {
        return await response.json();
      } catch (error) {
        throw new Error(`${context}: respuesta JSON inválida (${error.message})`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/** Vacía la caché de resultados meteorológicos. */
export function clearWeatherCache() {
  weatherCache.clear();
}

export async function getCoordinates(city, options = {}) {
  const validCity = validateCityName(city);

  const params = new URLSearchParams({
    name: validCity,
    count: '1',
    language: 'es',
    format: 'json',
  });

  const url = `${OPEN_METEO_GEOCODING}?${params.toString()}`;
  const data = await fetchJson(url, 'Error al obtener coordenadas', options);

  if (!data.results || data.results.length === 0) {
    throw new Error(`Ciudad no encontrada: ${validCity}`);
  }

  const result = data.results[0];
  const latitude = Number(result.latitude);
  const longitude = Number(result.longitude);
  const name = String(result.name ?? '');
  const country = String(result.country ?? '');

  assertFiniteNumber(latitude, 'latitude');
  assertFiniteNumber(longitude, 'longitude');

  if (!name || !country) {
    throw new Error(`Error al obtener coordenadas: datos incompletos para la ciudad ${validCity}`);
  }

  return { latitude, longitude, name, country };
}

export async function getCurrentTemperature(latitude, longitude, options = {}) {
  assertFiniteNumber(latitude, 'latitude');
  assertFiniteNumber(longitude, 'longitude');

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current_weather: 'true',
    temperature_unit: 'celsius',
  });

  const url = `${OPEN_METEO_BASE}?${params.toString()}`;
  const data = await fetchJson(url, 'Error al obtener temperatura', options);

  if (!data.current_weather) {
    throw new Error('Error al obtener temperatura: datos de clima actuales no disponibles.');
  }

  const temperature = Number(data.current_weather.temperature);
  const unit = String(data.current_weather_units?.temperature ?? '°C');

  assertFiniteNumber(temperature, 'temperature');

  return { temperature, unit };
}

export async function getWeatherDetails(latitude, longitude, options = {}) {
  assertFiniteNumber(latitude, 'latitude');
  assertFiniteNumber(longitude, 'longitude');

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current_weather: 'true',
    hourly: 'relativehumidity_2m,precipitation',
    daily: 'precipitation_sum',
    temperature_unit: 'celsius',
    timezone: 'auto',
  });

  const url = `${OPEN_METEO_BASE}?${params.toString()}`;
  const data = await fetchJson(url, 'Error al obtener detalles del clima', options);

  if (!data.current_weather) {
    throw new Error('Error al obtener detalles del clima: datos de clima actuales no disponibles.');
  }

  const temperature = Number(data.current_weather.temperature);
  const temperatureUnit = String(data.current_weather_units?.temperature ?? '°C');
  const windSpeed = Number(data.current_weather.windspeed);
  const windSpeedUnit = String(data.current_weather_units?.windspeed ?? 'km/h');
  const currentTimeRaw = String(data.current_weather.time ?? '');
  const currentTimeMatch = currentTimeRaw.match(/^\d{4}-\d{2}-\d{2}T\d{2}/);
  const currentTime = currentTimeMatch ? `${currentTimeMatch[0]}:00` : currentTimeRaw;

  assertFiniteNumber(temperature, 'temperature');
  assertFiniteNumber(windSpeed, 'windSpeed');

  if (!data.hourly || !Array.isArray(data.hourly.time)) {
    throw new Error('Error al obtener detalles del clima: datos horarios no disponibles.');
  }

  let timeIndex = data.hourly.time.findIndex((hour) => String(hour) === currentTime);
  if (timeIndex === -1) {
    timeIndex = 0;
  }

  const humidity = Number(data.hourly.relativehumidity_2m?.[timeIndex]);
  const humidityUnit = String(data.hourly_units?.relativehumidity_2m ?? '%');
  const hourlyPrecipitation = Number(data.hourly.precipitation?.[timeIndex]);
  const dailyPrecipitation = Number(data.daily?.precipitation_sum?.[0]);
  const precipitationUnit = String(data.hourly_units?.precipitation ?? data.daily_units?.precipitation_sum ?? 'mm');

  if (!Number.isFinite(humidity)) {
    throw new Error('Error al obtener detalles del clima: humedad actual no es un número válido.');
  }

  const precipitation = Number.isFinite(hourlyPrecipitation)
    ? hourlyPrecipitation
    : Number.isFinite(dailyPrecipitation)
      ? dailyPrecipitation
      : NaN;

  if (!Number.isFinite(precipitation)) {
    throw new Error('Error al obtener detalles del clima: precipitación actual no es un número válido.');
  }

  return {
    temperature,
    temperatureUnit,
    humidity,
    humidityUnit,
    windSpeed,
    windSpeedUnit,
    precipitation,
    precipitationUnit,
  };
}

/** Resuelve ubicación y condiciones actuales; aplica caché por nombre de ciudad. */
export async function getWeatherForCity(city, options = {}) {
  const validCity = validateCityName(city);
  const useCache = options.useCache !== false;
  const cacheKey = `weather:${normalizeCityKey(validCity)}`;

  if (useCache) {
    const cached = weatherCache.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }
  }

  const place = await getCoordinates(validCity, options);
  const weather = await getWeatherDetails(place.latitude, place.longitude, options);

  const result = {
    city: validCity,
    cached: false,
    place: {
      name: place.name,
      country: place.country,
      latitude: place.latitude,
      longitude: place.longitude,
    },
    weather,
  };

  if (useCache) {
    weatherCache.set(cacheKey, result);
  }

  return result;
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/** Consulta varias ciudades con concurrencia acotada; errores parciales no detienen el lote. */
export async function getWeatherForCities(cities, options = {}) {
  if (!Array.isArray(cities) || cities.length === 0) {
    throw new Error('Debe proporcionar al menos una ciudad.');
  }
  if (cities.length > MAX_CITIES_PER_REQUEST) {
    throw new Error(`Máximo ${MAX_CITIES_PER_REQUEST} ciudades por consulta.`);
  }

  const validated = cities.map((c) => validateCityName(c));

  return mapWithConcurrency(validated, MAX_PARALLEL_CITIES, async (city) => {
    try {
      const data = await getWeatherForCity(city, options);
      return { city, ok: true, ...data };
    } catch (error) {
      return {
        city,
        ok: false,
        cached: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

export function parseCityList(input) {
  const cities = String(input ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (cities.length === 0) {
    throw new Error('Ingrese al menos una ciudad.');
  }
  if (cities.length > MAX_CITIES_PER_REQUEST) {
    throw new Error(`Máximo ${MAX_CITIES_PER_REQUEST} ciudades por consulta.`);
  }

  return cities.map((c) => validateCityName(c));
}

/**
 * Parsea ciudades desde query ?cities= (uno o varios parámetros).
 * Varios ?cities= evita comas en la URL, que algunos proxies (p. ej. Render) rechazan.
 */
export function parseCitiesFromParams(citiesValues) {
  if (!Array.isArray(citiesValues) || citiesValues.length === 0) {
    return null;
  }
  if (citiesValues.length === 1) {
    return parseCityList(citiesValues[0]);
  }
  if (citiesValues.length > MAX_CITIES_PER_REQUEST) {
    throw new Error(`Máximo ${MAX_CITIES_PER_REQUEST} ciudades por consulta.`);
  }
  return citiesValues.map((c) => validateCityName(c));
}
