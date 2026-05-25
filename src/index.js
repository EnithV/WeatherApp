import { getCoordinates, getWeatherDetails } from './weather.js';

function getCityFromArgs() {
  const args = process.argv.slice(2);
  const city = args.join(' ').trim();

  if (city.length === 0) {
    const error = new Error('Uso inválido: proporcione el nombre de la ciudad, por ejemplo: node src/index.js "Bogotá".');
    error.name = 'UsageError';
    throw error;
  }

  return city;
}

async function main() {
  try {
    const city = getCityFromArgs();
    console.log(`Consultando clima para: ${city}...`);

    const { latitude, longitude, name, country } = await getCoordinates(city);
    const details = await getWeatherDetails(latitude, longitude);

    console.log(`Ciudad: ${name}, ${country}`);
    console.log(`Temperatura actual: ${details.temperature} ${details.temperatureUnit}`);
    console.log(`Humedad: ${details.humidity} ${details.humidityUnit}`);
    console.log(`Velocidad del viento: ${details.windSpeed} ${details.windSpeedUnit}`);
    console.log(`Precipitación: ${details.precipitation} ${details.precipitationUnit}`);
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
