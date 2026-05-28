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

async function fetchWeatherApi(query) {
  const response = await fetch(`/api/weather?${query}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Error ${response.status}`);
  }

  return data;
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

  const isMulti = rawInput.includes(',');

  try {
    if (isMulti) {
      const data = await fetchWeatherApi(`cities=${encodeURIComponent(rawInput)}`);
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
