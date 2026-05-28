import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCache } from '../src/cache.js';

describe('createCache', () => {
  it('devuelve undefined cuando la entrada expiró', async () => {
    const cache = createCache(50);
    cache.set('key', { temp: 20 });
    assert.deepEqual(cache.get('key'), { temp: 20 });

    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(cache.get('key'), undefined);
  });

  it('clear elimina todas las entradas', () => {
    const cache = createCache(10000);
    cache.set('a', 1);
    cache.set('b', 2);
    assert.equal(cache.size(), 2);
    cache.clear();
    assert.equal(cache.size(), 0);
  });
});
