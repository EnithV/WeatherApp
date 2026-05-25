export const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
export const OPEN_METEO_GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search';

// --- Simulación temporal (para pruebas locales) ---
// Cambia estos valores manualmente para simular condiciones de red/servidor.
// IMPORTANTE: estos valores son temporales para pruebas; recuerda revertirlos después.
export const SIMULATE_DELAY_MS = 0; // Si >0, simula retraso de red antes de realizar fetch (ms)
export const SIMULATE_FORCE_STATUS = null; // Si se establece (por ejemplo 500), fuerza un error HTTP simulado
