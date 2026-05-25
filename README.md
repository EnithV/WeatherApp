# Weather App

Aplicación de clima sencilla en Node.js que recibe el nombre de una ciudad desde la terminal, consulta la API gratuita de Open-Meteo y muestra en consola temperatura, humedad, velocidad del viento y precipitación con unidades dinámicas.

## Estructura del proyecto

- `src/`
  - `index.js` - entrada principal y manejo de argumentos.
  - `weather.js` - funciones para consultar Open-Meteo y procesar los resultados.
- `config/`
  - `api.js` - URLs de los endpoints de Open-Meteo.
- `package.json` - configuración del proyecto y dependencias.
- `.gitignore` - archivos ignorados por Git.

## Instalación

1. Abre un terminal en el directorio del proyecto.
2. Instala dependencias (si es necesario):

```bash
npm install
```

> Nota: este proyecto usa la API nativa de `fetch` disponible en entornos Node.js recientes.

## Uso

Ejecuta la aplicación con el nombre de ciudad entre comillas:

```bash
node src/index.js "Bogotá"
```

También puedes usar el script `start` si está configurado en `package.json`:

```bash
npm start -- "Bogotá"
```

## Formato esperado de respuesta

La aplicación imprime en consola el nombre de la ciudad, el país y los detalles actuales del clima: temperatura, humedad, velocidad del viento y precipitación. Las unidades se obtienen dinámicamente de la API.

```text
Ciudad: Bogotá, Colombia
Temperatura actual: 19.4 °C
Humedad: 82 %
Velocidad del viento: 5.4 km/h
Precipitación: 0.0 mm
```

### Ejemplo de salida real

```text
Consultando clima para: Bogotá...
Ciudad: Bogotá, Colombia
Temperatura actual: 19.4 °C
Humedad: 82 %
Velocidad del viento: 5.4 km/h
Precipitación: 0.0 mm
```

## Manejo de errores

La aplicación detecta varios casos comunes y muestra mensajes claros:

- Ciudad inválida o vacía:
  - Si no se proporciona ningún argumento o sólo espacios, se muestra un mensaje de uso válido.
- Ciudad no encontrada:
  - Si Open-Meteo no devuelve resultados para la ciudad solicitada, la salida indica que la ciudad no existe.
- Error de red o API:
  - Si hay un problema de conexión o la API responde con un error HTTP, se muestra `Error al consultar el clima:` seguido del detalle.
- Error interno de datos:
  - Si la respuesta de la API no contiene los campos esperados, se lanza un error con contexto específico.
- Reintentos automáticos:
  - Si la API responde con `429` o hay un error de servidor transitorio, la función intenta nuevamente hasta 2 veces con backoff exponencial suave.

## Validación y seguridad

- En el frontend se valida que el nombre de la ciudad no esté vacío, no supere 100 caracteres y solo contenga caracteres razonables (letras, números, espacios y algunos símbolos comunes).
- El texto de ciudad y país se muestra con `textContent` en lugar de `innerHTML` para evitar riesgos de inyección de contenido en la UI.

## Notas sobre la API

- La aplicación utiliza Open-Meteo para obtener datos de clima.
- Se usan dos endpoints:
  - geocodificación (`geocoding-api.open-meteo.com`) para convertir el nombre de ciudad en coordenadas.
  - forecast (`api.open-meteo.com/v1/forecast`) para obtener la temperatura actual.
- Open-Meteo es gratuita y no requiere clave API para estas consultas.
- La temperatura se solicita en Celsius (`temperature_unit=celsius`).

## Estructura de datos y uso de módulos

Si deseas usar la lógica en otro proyecto, puedes importar las funciones desde `src/weather.js`:

```js
import { getCoordinates, getWeatherDetails } from './src/weather.js';

const coords = await getCoordinates('Bogotá');
const details = await getWeatherDetails(coords.latitude, coords.longitude);
```

La nueva función `getWeatherDetails` devuelve todos los datos del clima actual con sus unidades correspondientes:

- `getCoordinates(city)` retorna:
  - `latitude` (number)
  - `longitude` (number)
  - `name` (string)
  - `country` (string)
- `getWeatherDetails(latitude, longitude)` retorna:
  - `temperature` (number)
  - `temperatureUnit` (string)
  - `humidity` (number)
  - `humidityUnit` (string)
  - `windSpeed` (number)
  - `windSpeedUnit` (string)
  - `precipitation` (number)
  - `precipitationUnit` (string)

## Notas finales

Este proyecto es ideal para aprender cómo consumir APIs desde Node.js y cómo estructurar la lógica de consulta a servicios externos. Si quieres, también puedo ayudarte a ampliar la app con pronóstico de varios días, viento, humedad o texto enriquecido.
