import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchJson } from '../src/weather.js';

function mockFetchSequence(responses) {
  let callIndex = 0;

  return async () => {
    const current = responses[callIndex];
    callIndex += 1;
    return current();
  };
}

describe('fetchJson', () => {
  it('reintenta cuando el servidor responde 503 y luego responde ok', async () => {
    let attempts = 0;

    const fetchImpl = mockFetchSequence([
      async () => {
        attempts += 1;
        return { ok: false, status: 503, statusText: 'Service Unavailable' };
      },
      async () => {
        attempts += 1;
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({ ok: true }),
        };
      },
    ]);

    const data = await fetchJson('https://example.test/api', 'Prueba', {
      fetchImpl,
      skipSimulation: true,
    });

    assert.equal(data.ok, true);
    assert.equal(attempts, 2);
  });

  it('lanza error descriptivo cuando la respuesta no es ok y no es reintentable', async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await assert.rejects(
      () => fetchJson('https://example.test/missing', 'Recurso', { fetchImpl, skipSimulation: true }),
      /Recurso: 404 Not Found/,
    );
  });

  it('lanza error cuando el JSON es inválido', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => {
        throw new Error('Unexpected token');
      },
    });

    await assert.rejects(
      () => fetchJson('https://example.test/bad-json', 'Datos', { fetchImpl, skipSimulation: true }),
      /respuesta JSON inválida/,
    );
  });
});
