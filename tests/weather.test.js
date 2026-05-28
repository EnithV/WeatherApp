import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCoordinates,
  getWeatherForCity,
  clearWeatherCache,
} from '../src/weather.js';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

function createMockFetch({ geocodingBody, forecastBody, geocodingEmpty = false } = {}) {
  return async (url) => {
    const urlStr = String(url);

    if (urlStr.startsWith(GEOCODING_URL)) {
      if (geocodingEmpty) {
        return jsonResponse({ results: [] });
      }
      return jsonResponse(geocodingBody ?? {
        results: [{
          latitude: 4.71,
          longitude: -74.07,
          name: 'Bogotá',
          country: 'Colombia',
        }],
      });
    }

    if (urlStr.startsWith(FORECAST_URL)) {
      return jsonResponse(forecastBody ?? {
        current_weather: {
          temperature: 19,
          windspeed: 5,
          time: '2026-05-28T12:00',
        },
        current_weather_units: { temperature: '°C', windspeed: 'km/h' },
        hourly: {
          time: ['2026-05-28T12:00'],
          relativehumidity_2m: [80],
          precipitation: [0],
        },
        hourly_units: { relativehumidity_2m: '%', precipitation: 'mm' },
        daily: { precipitation_sum: [0] },
        daily_units: { precipitation_sum: 'mm' },
      });
    }

    return { ok: false, status: 404, statusText: 'Not Found' };
  };
}

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
  };
}

describe('getCoordinates', () => {
  it('devuelve coordenadas cuando la API encuentra la ciudad', async () => {
    const coords = await getCoordinates('Bogotá', {
      fetchImpl: createMockFetch(),
      skipSimulation: true,
    });

    assert.equal(coords.name, 'Bogotá');
    assert.equal(coords.country, 'Colombia');
    assert.equal(coords.latitude, 4.71);
  });

  it('lanza error cuando la ciudad no existe', async () => {
    await assert.rejects(
      () => getCoordinates('CiudadInventadaXYZ', {
        fetchImpl: createMockFetch({ geocodingEmpty: true }),
        skipSimulation: true,
      }),
      /Ciudad no encontrada/,
    );
  });
});

describe('getWeatherForCity', () => {
  beforeEach(() => {
    clearWeatherCache();
  });

  it('usa caché en la segunda consulta de la misma ciudad', async () => {
    let fetchCalls = 0;
    const baseFetch = createMockFetch();
    const fetchImpl = async (...args) => {
      fetchCalls += 1;
      return baseFetch(...args);
    };

    const first = await getWeatherForCity('Bogotá', { fetchImpl, useCache: true });
    const second = await getWeatherForCity('Bogotá', { fetchImpl, useCache: true });

    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.equal(first.weather.temperature, 19);
    assert.equal(fetchCalls, 2, 'solo dos peticiones HTTP (geocoding + forecast) gracias a la caché');
  });
});
