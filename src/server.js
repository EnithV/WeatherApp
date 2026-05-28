/**
 * Servidor HTTP: contenido estático en public/ y API REST en /api/weather.
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  SERVER_PORT,
} from '../config/api.js';
import {
  getWeatherForCity,
  getWeatherForCities,
  parseCitiesFromParams,
} from './weather.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

/** @type {Map<string, { count: number, resetAt: number }>} */
const rateLimitStore = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitStore.set(ip, entry);
  }

  entry.count += 1;

  if (entry.count > RATE_LIMIT_MAX) {
    return false;
  }

  return true;
}

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

async function serveStatic(req, res) {
  let urlPath = req.url?.split('?')[0] ?? '/';
  if (urlPath === '/') {
    urlPath = '/index.html';
  }

  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}

async function handleWeatherApi(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const city = url.searchParams.get('city');
  const citiesValues = url.searchParams.getAll('cities');

  try {
    const cities = parseCitiesFromParams(citiesValues);
    if (cities) {
      const results = await getWeatherForCities(cities);
      sendJson(res, 200, { results });
      return;
    }

    if (city) {
      const result = await getWeatherForCity(city);
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 400, { error: 'Proporcione el parámetro city o cities.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    sendJson(res, 400, { error: message });
  }
}

async function handleRequest(req, res) {
  const method = req.method ?? 'GET';
  const pathname = req.url?.split('?')[0] ?? '/';

  if (method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  if (method === 'GET' && pathname === '/api/weather') {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) {
      sendJson(res, 429, { error: 'Demasiadas solicitudes. Intente de nuevo en un minuto.' });
      return;
    }
    await handleWeatherApi(req, res);
    return;
  }

  if (method === 'GET') {
    await serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end('Method Not Allowed');
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error('Error interno del servidor:', error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'Error interno del servidor.' });
    }
  });
});

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  server.listen(SERVER_PORT, () => {
    console.log(`Servidor activo: http://localhost:${SERVER_PORT}`);
  });
}

export { server, handleRequest };
