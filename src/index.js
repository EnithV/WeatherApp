import {
  getWeatherForCity,
  getWeatherForCities,
  validateCityName,
} from './weather.js';
import { MAX_CITIES_PER_REQUEST } from '../config/api.js';

function usageError(message) {
  const error = new Error(message);
  error.name = 'UsageError';
  return error;
}

function getCitiesFromArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    throw usageError(
      'Uso:\n' +
        '  Una ciudad:  node src/index.js "Bogotá"\n' +
        '  Varias:      node src/index.js --cities "Bogotá" "Medellín" "Londres"\n' +
        '               node src/index.js --cities "Bogotá,Medellín,Londres"',
    );
  }

  if (args[0] === '--cities' || args[0] === '-m') {
    const rest = args.slice(1);
    if (rest.length === 0) {
      throw usageError('Proporcione al menos una ciudad después de --cities.');
    }

    const cities = [];
    for (const arg of rest) {
      for (const part of arg.split(',')) {
        const trimmed = part.trim();
        if (trimmed) {
          cities.push(validateCityName(trimmed));
        }
      }
    }

    if (cities.length === 0) {
      throw usageError('No se encontraron nombres de ciudad válidos.');
    }
    if (cities.length > MAX_CITIES_PER_REQUEST) {
      throw usageError(`Máximo ${MAX_CITIES_PER_REQUEST} ciudades por consulta.`);
    }

    return cities;
  }

  return [validateCityName(args.join(' '))];
}

function printWeatherResult(result) {
  const { place, weather, cached } = result;
  const cacheNote = cached ? ' (desde caché)' : '';
  console.log(`\nCiudad: ${place.name}, ${place.country}${cacheNote}`);
  console.log(`Temperatura actual: ${weather.temperature} ${weather.temperatureUnit}`);
  console.log(`Humedad: ${weather.humidity} ${weather.humidityUnit}`);
  console.log(`Velocidad del viento: ${weather.windSpeed} ${weather.windSpeedUnit}`);
  console.log(`Precipitación: ${weather.precipitation} ${weather.precipitationUnit}`);
}

async function main() {
  try {
    const cities = getCitiesFromArgs();

    if (cities.length === 1) {
      console.log(`Consultando clima para: ${cities[0]}...`);
      const result = await getWeatherForCity(cities[0]);
      printWeatherResult(result);
      return;
    }

    console.log(`Consultando clima para ${cities.length} ciudades...`);
    const results = await getWeatherForCities(cities);

    for (const item of results) {
      if (item.ok) {
        printWeatherResult(item);
      } else {
        console.log(`\n${item.city}: Error — ${item.error}`);
      }
    }
  } catch (error) {
    if (error.name === 'UsageError') {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }

    console.error('Error al consultar el clima:', error.message);
    process.exitCode = 1;
  }
}

main();
