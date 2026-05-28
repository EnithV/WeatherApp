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
  document.querySelector('.container')?.classList.remove('container--wide');
}

function createDetailItem(iconClass, label, value) {
  const item = document.createElement('div');
  item.className = 'detail-item';

  const icon = document.createElement('i');
  icon.className = iconClass;
  icon.setAttribute('aria-hidden', 'true');

  const labelEl = document.createElement('span');
  labelEl.className = 'label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'value';
  valueEl.textContent = value;

  item.append(icon, labelEl, valueEl);
  return item;
}

function createCompareCityCard(item) {
  const card = document.createElement('article');
  card.className = 'compare-city-card';

  if (!item.ok) {
    card.classList.add('compare-city-card--error');
    const error = document.createElement('p');
    error.className = 'compare-error mb-0';
    error.textContent = `${item.city}: ${item.error}`;
    card.appendChild(error);
    return card;
  }

  const title = document.createElement('h3');
  title.className = 'city-name compare-city-name';
  const cacheNote = item.cached ? ' · caché' : '';
  title.innerHTML = `<i class="bi bi-geo-alt-fill" aria-hidden="true"></i> <span></span>`;
  title.querySelector('span').textContent = `${item.place.name}, ${item.place.country}${cacheNote}`;

  const details = document.createElement('div');
  details.className = 'weather-details compare-details';
  details.append(
    createDetailItem('bi bi-thermometer-half', 'Temperatura', `${item.weather.temperature} ${item.weather.temperatureUnit}`),
    createDetailItem('bi bi-droplet', 'Humedad', `${item.weather.humidity} ${item.weather.humidityUnit}`),
    createDetailItem('bi bi-wind', 'Viento', `${item.weather.windSpeed} ${item.weather.windSpeedUnit}`),
    createDetailItem('bi bi-cloud-rain', 'Precipitación', `${item.weather.precipitation} ${item.weather.precipitationUnit}`),
  );

  card.append(title, details);
  return card;
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
    $multiBody.appendChild(createCompareCityCard(item));
  }

  document.querySelector('.container')?.classList.add('container--wide');
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
