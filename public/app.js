const $form = document.getElementById('searchForm');
const $city = document.getElementById('cityInput');
const $status = document.getElementById('status');
const $result = document.getElementById('result');
const $multiResult = document.getElementById('multiResult');
const $multiBody = document.getElementById('multiBody');

function setStatus(text, isError = false) {
  $status.textContent = text;
  $status.className = isError ? 'status text-center text-danger' : 'status text-center text-muted';
}

function hideResults() {
  $result.classList.add('hidden');
  $multiResult.classList.add('hidden');
}

function setCell(row, text, className) {
  const cell = document.createElement('td');
  if (className) cell.className = className;
  cell.textContent = text;
  row.appendChild(cell);
}

function showSingleResult(data) {
  const placeLabel = document.querySelector('#place span');
  const cacheNote = data.cached ? ' · caché' : '';
  placeLabel.textContent = `${data.place.name}, ${data.place.country}${cacheNote}`;
  document.getElementById('temperature').textContent = `${data.weather.temperature} ${data.weather.temperatureUnit}`;
  document.getElementById('humidity').textContent = `${data.weather.humidity} ${data.weather.humidityUnit}`;
  document.getElementById('wind').textContent = `${data.weather.windSpeed} ${data.weather.windSpeedUnit}`;
  document.getElementById('precipitation').textContent = `${data.weather.precipitation} ${data.weather.precipitationUnit}`;
  $result.classList.remove('hidden');
}

function showMultiResults(results) {
  $multiBody.replaceChildren();

  for (const item of results) {
    const row = document.createElement('tr');

    if (item.ok) {
      const placeName = item.cached
        ? `${item.place.name}, ${item.place.country} (caché)`
        : `${item.place.name}, ${item.place.country}`;
      setCell(row, placeName);
      setCell(row, `${item.weather.temperature} ${item.weather.temperatureUnit}`);
      setCell(row, `${item.weather.humidity} ${item.weather.humidityUnit}`);
      setCell(row, `${item.weather.windSpeed} ${item.weather.windSpeedUnit}`);
      setCell(row, `${item.weather.precipitation} ${item.weather.precipitationUnit}`);
    } else {
      const cell = document.createElement('td');
      cell.colSpan = 5;
      cell.className = 'text-danger';
      cell.textContent = `${item.city}: ${item.error}`;
      row.appendChild(cell);
    }

    $multiBody.appendChild(row);
  }

  $multiResult.classList.remove('hidden');
}

function splitCityInput(rawInput) {
  return rawInput
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildMultiCityQuery(rawInput) {
  const cities = splitCityInput(rawInput);
  if (cities.length === 0) {
    throw new Error('Ingrese al menos una ciudad.');
  }
  return cities.map((city) => `cities=${encodeURIComponent(city)}`).join('&');
}

async function fetchWeatherApi(query, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(`/api/weather?${query}`);
    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();

    if (!contentType.includes('application/json')) {
      if (response.status === 404 && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        continue;
      }
      if (response.status === 404) {
        throw new Error('El servidor está iniciando. Espere unos segundos e intente de nuevo.');
      }
      throw new Error(`Respuesta inesperada del servidor (${response.status}).`);
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 2500));
        continue;
      }
      throw new Error('Respuesta inválida del servidor.');
    }

    if (!response.ok) {
      throw new Error(data.error || `Error ${response.status}`);
    }

    return data;
  }

  throw new Error('No se pudo consultar el clima.');
}

$form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  hideResults();
  setStatus('Consultando...');

  const rawInput = $city.value.trim();
  if (!rawInput) {
    setStatus('Ingrese el nombre de una ciudad.', true);
    return;
  }

  const cityList = splitCityInput(rawInput);
  const isMulti = cityList.length > 1;

  try {
    if (isMulti) {
      const data = await fetchWeatherApi(buildMultiCityQuery(rawInput));
      showMultiResults(data.results);
      setStatus(`${data.results.length} ciudades consultadas.`);
    } else {
      const data = await fetchWeatherApi(`city=${encodeURIComponent(rawInput)}`);
      showSingleResult(data);
      setStatus('');
    }
  } catch (err) {
    setStatus(err.message || 'Error al consultar el clima', true);
  }
});
