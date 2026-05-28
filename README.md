# Weather App

Aplicación de clima en Node.js que consulta [Open-Meteo](https://open-meteo.com), con **CLI**, **servidor HTTP** e **interfaz web**. Incluye caché en memoria, consulta de varias ciudades, reintentos automáticos, pruebas automatizadas y prácticas de seguridad documentadas.

## Estructura del proyecto

```
Weather_App/
├── config/
│   └── api.js          # URLs, TTL de caché, puerto, límites
├── src/
│   ├── index.js        # CLI (una o varias ciudades)
│   ├── server.js       # Servidor HTTP + API REST + archivos estáticos
│   ├── weather.js      # Lógica compartida (API, validación, caché)
│   └── cache.js        # Caché en memoria con TTL
├── public/
│   ├── index.html      # Interfaz web
│   ├── app.js          # Cliente que consume /api/weather
│   └── styles.css
├── tests/              # Pruebas con node:test
├── LICENSE             # MIT
└── package.json
```

## Requisitos

- Node.js 18+ (usa `fetch` nativo y `node:test`)

## Instalación

```bash
npm install
```

No hay dependencias externas de producción.

## Uso — CLI

**Una ciudad:**

```bash
node src/index.js "Bogotá"
# o
npm start -- "Bogotá"
```

**Varias ciudades (comparación):**

```bash
node src/index.js --cities "Bogotá" "Medellín" "Londres"
node src/index.js --cities "Bogotá,Medellín,Londres"
```

Salida de ejemplo:

```text
Consultando clima para: Bogotá...

Ciudad: Bogotá, Colombia
Temperatura actual: 19.4 °C
Humedad: 82 %
Velocidad del viento: 5.4 km/h
Precipitación: 0.0 mm
```

## Uso — Interfaz web

1. Inicia el servidor:

```bash
npm run start:web
```

2. Abre en el navegador: **http://localhost:3000**

3. Busca una ciudad (`Bogotá`) o varias separadas por coma (`Bogotá, Medellín, Londres`).

La web **no llama a Open-Meteo directamente**: usa la API local, que aplica la misma lógica, caché y reintentos que la CLI.

## API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Estado del servidor |
| GET | `/api/weather?city=Bogotá` | Clima de una ciudad |
| GET | `/api/weather?cities=Bogotá,Medellín` | Comparar hasta 5 ciudades |

Respuesta (una ciudad):

```json
{
  "city": "Bogotá",
  "cached": false,
  "place": { "name": "Bogotá", "country": "Colombia", "latitude": 4.71, "longitude": -74.07 },
  "weather": {
    "temperature": 19.4,
    "temperatureUnit": "°C",
    "humidity": 82,
    "humidityUnit": "%",
    "windSpeed": 5.4,
    "windSpeedUnit": "km/h",
    "precipitation": 0,
    "precipitationUnit": "mm"
  }
}
```

Límite de tasa en el servidor: **30 solicitudes por minuto por IP** en `/api/weather`.

## Funcionalidades avanzadas

- **Caché en memoria** (10 min): evita consultas repetidas a Open-Meteo para la misma ciudad.
- **Varias ciudades en paralelo** (máx. 3 simultáneas, hasta 5 por consulta): CLI con `--cities` y web con nombres separados por coma.
- **Interfaz web** con vista individual y tabla comparativa.
- **Reintentos** con backoff ante errores 429/5xx y timeout de 5 s.

## Manejo de errores

- Ciudad vacía o con caracteres no permitidos
- Ciudad no encontrada en geocodificación
- Timeout de red (5 s)
- Reintentos automáticos (hasta 2) en 429 y errores 5xx
- JSON inválido o datos incompletos de la API
- Límite de ciudades por consulta (5) y rate limit en el servidor (30/min)

## Pruebas

```bash
npm test
```

Incluye pruebas de validación, `fetchJson` con mocks, geocodificación, caché y expiración TTL. Las pruebas **no** llaman a Open-Meteo en vivo.

## Seguridad

- Validación unificada de nombres de ciudad (`validateCityName`) en CLI, servidor y parseo de API.
- URLs construidas con `URLSearchParams` (sin concatenación insegura).
- La interfaz muestra datos con `textContent` (no `innerHTML`) para evitar XSS.
- `.env` está en `.gitignore`; Open-Meteo no requiere API key para este uso.
- Rate limiting en `/api/weather`.
- Rutas de archivos estáticos validadas para evitar path traversal.
- Simulación de errores de red (`SIMULATE_*` en `config/api.js`) desactivada cuando `NODE_ENV=test`.

## Licencia y consideraciones éticas

- **Licencia del proyecto:** [MIT](LICENSE).
- **Datos meteorológicos:** provistos por [Open-Meteo](https://open-meteo.com). El uso debe ajustarse a sus términos; la caché y el límite de solicitudes contribuyen a un consumo responsable del servicio.
- **Credenciales:** no incluir claves API ni secretos en el repositorio. Variables sensibles deben residir en `.env` (excluido por `.gitignore`).
- **Privacidad:** la aplicación no persiste datos personales; únicamente envía nombres de ciudad a Open-Meteo para la consulta.
- **Dependencias externas:** la interfaz web utiliza Bootstrap e iconos desde CDN; en entornos restrictivos conviene alojar esos recursos de forma local.

## Notas sobre la API

- Geocodificación: `geocoding-api.open-meteo.com`
- Pronóstico: `api.open-meteo.com/v1/forecast`
- Temperatura en Celsius; unidades dinámicas en la respuesta.

## Desarrollo

| Script | Acción |
|--------|--------|
| `npm start -- "Ciudad"` | CLI una ciudad |
| `npm run start:web` | Servidor + UI en puerto 3000 |
| `npm test` | Ejecutar pruebas |
| `npm run test:watch` | Pruebas en modo watch |

Variables opcionales: `PORT` (puerto del servidor), `NODE_ENV=test` (para pruebas).

## Importar la lógica

```js
import { getWeatherForCity, getWeatherForCities } from './src/weather.js';

const bogota = await getWeatherForCity('Bogotá');
const comparison = await getWeatherForCities(['Bogotá', 'Medellín']);
```
