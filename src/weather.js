import { OPEN_METEO_BASE, OPEN_METEO_GEOCODING, SIMULATE_DELAY_MS, SIMULATE_FORCE_STATUS } from '../config/api.js';

/**
 * Realiza una petición HTTP y devuelve el JSON resultante si la respuesta es válida.
 * @param {string} url - URL completa de la petición.
 * @param {string} context - Texto descriptivo para los errores.
 * @returns {Promise<any>} El cuerpo JSON de la respuesta.
 * @throws {Error} Si falla la petición, la respuesta no es `ok` o el JSON es inválido.
 */
async function fetchJson(url, context) {
  const FETCH_TIMEOUT_MS = 5000; // tiempo máximo de espera para la petición (ms)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // Simulación: forzar un status HTTP (ej. 500) sin hacer la llamada real.
    if (SIMULATE_FORCE_STATUS) {
      const status = SIMULATE_FORCE_STATUS;
      const statusText = status >= 500 ? 'Internal Server Error' : 'Error';
      throw new Error(`${context}: ${status} ${statusText}`);
    }

    // Simulación: retraso de red antes de iniciar la petición.
    if (SIMULATE_DELAY_MS && SIMULATE_DELAY_MS > 0) {
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
      response = await fetch(url, { signal: controller.signal });
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`${context}: timeout después de ${FETCH_TIMEOUT_MS} ms`);
      }
      throw new Error(`${context}: error de red o conexión (${error.message})`);
    }

    if (!response.ok) {
      throw new Error(`${context}: ${response.status} ${response.statusText}`);
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

/**
 * Valida que un valor sea una cadena no vacía ni solo espacios.
 * @param {unknown} value - Valor a validar.
 * @param {string} name - Nombre del parámetro para el mensaje de error.
 * @throws {Error} Si el valor no es válido.
 */
function assertNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} debe ser una cadena no vacía.`);
  }
}

/**
 * Valida que un valor sea un número finito.
 * @param {unknown} value - Valor a validar.
 * @param {string} name - Nombre del parámetro para el mensaje de error.
 * @throws {Error} Si el valor no es un número finito.
 */
function assertFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} debe ser un número finito.`);
  }
}

/**
 * Obtiene las coordenadas geográficas de una ciudad usando la API de geocodificación de Open-Meteo.
 *
 * Esta función valida que el nombre de ciudad sea una cadena no vacía, construye la URL
 * con `URLSearchParams`, y retorna los datos de ubicación del primer resultado.
 *
 * @param {string} city - Nombre de la ciudad a buscar. Debe ser una cadena no vacía y no solo espacios.
 * @returns {Promise<{latitude:number, longitude:number, name:string, country:string}>} Un objeto con:
 *   - `latitude`: latitud en grados decimales.
 *   - `longitude`: longitud en grados decimales.
 *   - `name`: nombre oficial de la ciudad devuelto por la API.
 *   - `country`: código o nombre del país.
 * @throws {Error} Cuando:
 *   - `city` no es una cadena válida.
 *   - la API de geocodificación devuelve un error HTTP.
 *   - la respuesta no incluye resultados.
 *   - el resultado carece de `latitude`, `longitude`, `name` o `country`.
 * @example
 * const coords = await getCoordinates('Bogotá');
 * console.log(coords.latitude, coords.longitude);
 *
 * @note Usa la API de Open-Meteo Geocoding para obtener la primera coincidencia.
 * @note Las coordenadas devueltas son números en formato decimal.
 */
export async function getCoordinates(city) {
  assertNonEmptyString(city, 'city');

  const params = new URLSearchParams({
    name: city.trim(),
    count: '1',
    language: 'es',
    format: 'json',
  });

  const url = `${OPEN_METEO_GEOCODING}?${params.toString()}`;
  const data = await fetchJson(url, 'Error al obtener coordenadas');

  if (!data.results || data.results.length === 0) {
    throw new Error(`Ciudad no encontrada: ${city}`);
  }

  const result = data.results[0];
  const latitude = Number(result.latitude);
  const longitude = Number(result.longitude);
  const name = String(result.name ?? '');
  const country = String(result.country ?? '');

  assertFiniteNumber(latitude, 'latitude');
  assertFiniteNumber(longitude, 'longitude');

  if (!name || !country) {
    throw new Error(`Error al obtener coordenadas: datos incompletos para la ciudad ${city}`);
  }

  return { latitude, longitude, name, country };
}

/**
 * Obtiene la temperatura actual en una ubicación específica usando la API de Open-Meteo.
 *
 * Se validan las coordenadas como números finitos y se construye la consulta con
 * `URLSearchParams`. La unidad de temperatura solicitada es Celsius.
 *
 * @param {number} latitude - Latitud de la ubicación en grados decimales.
 * @param {number} longitude - Longitud de la ubicación en grados decimales.
 * @returns {Promise<{temperature:number, unit:string}>} Un objeto con:
 *   - `temperature`: valor numérico de la temperatura actual.
 *   - `unit`: unidad de temperatura, por ejemplo `°C`.
 * @throws {Error} Cuando:
 *   - `latitude` o `longitude` no son números finitos.
 *   - la API de Open-Meteo devuelve un error HTTP.
 *   - la respuesta no incluye datos de `current_weather`.
 *   - la temperatura devuelta no es un número válido.
 * @example
 * const weather = await getCurrentTemperature(4.7110, -74.0721);
 * console.log(`${weather.temperature} ${weather.unit}`);
 *
 * @note Usa el endpoint `forecast` de Open-Meteo con `current_weather=true`.
 * @note La unidad de temperatura se fija en Celsius en la solicitud.
 */
export async function getCurrentTemperature(latitude, longitude) {
  assertFiniteNumber(latitude, 'latitude');
  assertFiniteNumber(longitude, 'longitude');

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current_weather: 'true',
    temperature_unit: 'celsius',
  });

  const url = `${OPEN_METEO_BASE}?${params.toString()}`;
  const data = await fetchJson(url, 'Error al obtener temperatura');

  if (!data.current_weather) {
    throw new Error('Error al obtener temperatura: datos de clima actuales no disponibles.');
  }

  const temperature = Number(data.current_weather.temperature);
  const unit = String(data.current_weather_units?.temperature ?? '°C');

  assertFiniteNumber(temperature, 'temperature');

  return { temperature, unit };
}

/**
 * Obtiene detalles meteorológicos actuales para una ubicación específica usando la API de Open-Meteo.
 *
 * Esta función valida las coordenadas como números finitos, construye la URL con `URLSearchParams`
 * y combina `current_weather`, `hourly` y `daily` para devolver un conjunto de datos completo.
 *
 * @param {number} latitude - Latitud de la ubicación en grados decimales.
 * @param {number} longitude - Longitud de la ubicación en grados decimales.
 * @returns {Promise<{temperature:number, temperatureUnit:string, humidity:number, humidityUnit:string, windSpeed:number, windSpeedUnit:string, precipitation:number, precipitationUnit:string}>} Un objeto con:
 *   - `temperature`: temperatura actual.
 *   - `temperatureUnit`: unidad de temperatura, por ejemplo `°C`.
 *   - `humidity`: humedad relativa actual.
 *   - `humidityUnit`: unidad de humedad, por ejemplo `%`.
 *   - `windSpeed`: velocidad del viento actual.
 *   - `windSpeedUnit`: unidad de la velocidad del viento, por ejemplo `km/h`.
 *   - `precipitation`: precipitación actual.
 *   - `precipitationUnit`: unidad de precipitación, por ejemplo `mm`.
 * @throws {Error} Cuando:
 *   - `latitude` o `longitude` no son números finitos.
 *   - la API de Open-Meteo devuelve un error HTTP.
 *   - la respuesta no incluye datos necesarios en `current_weather`, `hourly` o `daily`.
 *   - no se puede obtener el valor de humedad o precipitación actual.
 * @example
 * const details = await getWeatherDetails(4.7110, -74.0721);
 * console.log(`${details.temperature} ${details.temperatureUnit}`, `${details.humidity}${details.humidityUnit}`, `${details.windSpeed} ${details.windSpeedUnit}`, `${details.precipitation} ${details.precipitationUnit}`);
 *
 * @note Usa `current_weather=true`, `hourly=relativehumidity_2m,precipitation` y `daily=precipitation_sum`.
 */
export async function getWeatherDetails(latitude, longitude) {
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
  const data = await fetchJson(url, 'Error al obtener detalles del clima');

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

  const precipitation = Number.isFinite(hourlyPrecipitation) ? hourlyPrecipitation : Number.isFinite(dailyPrecipitation) ? dailyPrecipitation : NaN;
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
