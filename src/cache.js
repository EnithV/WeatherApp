/**
 * Almacén en memoria con tiempo de vida (TTL) por entrada.
 * Reduce solicitudes repetidas al mismo recurso.
 */
export function createCache(ttlMs) {
  const store = new Map();

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },

    set(key, value) {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },

    clear() {
      store.clear();
    },

    size() {
      return store.size;
    },
  };
}
