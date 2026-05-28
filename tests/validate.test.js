import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCityName, parseCityList, parseCitiesFromParams, MAX_CITY_LENGTH } from '../src/weather.js';

describe('validateCityName', () => {
  it('acepta nombres válidos con acentos y guiones', () => {
    assert.equal(validateCityName('  Bogotá  '), 'Bogotá');
    assert.equal(validateCityName('São Paulo'), 'São Paulo');
    assert.equal(validateCityName('New York (NY)'), 'New York (NY)');
  });

  it('rechaza cadena vacía', () => {
    assert.throws(() => validateCityName(''), /Ingrese el nombre de una ciudad/);
    assert.throws(() => validateCityName('   '), /Ingrese el nombre de una ciudad/);
  });

  it('rechaza caracteres no permitidos', () => {
    assert.throws(() => validateCityName('Bogotá<script>'), /caracteres inválidos/);
    assert.throws(() => validateCityName('City@Home'), /caracteres inválidos/);
  });

  it('rechaza nombres que exceden la longitud máxima', () => {
    const longName = 'A'.repeat(MAX_CITY_LENGTH + 1);
    assert.throws(() => validateCityName(longName), /no puede exceder/);
  });
});

describe('parseCityList', () => {
  it('parsea varias ciudades separadas por coma', () => {
    const cities = parseCityList('Bogotá, Medellín , Londres');
    assert.deepEqual(cities, ['Bogotá', 'Medellín', 'Londres']);
  });

  it('rechaza lista vacía', () => {
    assert.throws(() => parseCityList('  ,  '), /al menos una ciudad/);
  });
});

describe('parseCitiesFromParams', () => {
  it('parsea un parámetro cities con comas internas', () => {
    assert.deepEqual(parseCitiesFromParams(['Bogotá, Medellín']), ['Bogotá', 'Medellín']);
  });

  it('parsea varios parámetros cities (sin comas en la URL)', () => {
    assert.deepEqual(parseCitiesFromParams(['Bogotá', 'Medellín', 'Londres']), [
      'Bogotá',
      'Medellín',
      'Londres',
    ]);
  });

  it('devuelve null cuando no hay parámetros', () => {
    assert.equal(parseCitiesFromParams([]), null);
  });
});
