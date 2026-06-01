const API_KEY = '85ad66619fcac0858c4196f4cdf3c8a6';
const BASE    = 'https://api.openweathermap.org/data/2.5';
const GEO     = 'https://api.openweathermap.org/geo/1.0';
 
/* ─── STATE ──────────────────────────────────────────────────────── */
let isCelsius   = true;
let currentData = null;         // last weather response
let recentSearches = JSON.parse(localStorage.getItem('nimbus_recent') || '[]');
 
/* ─── DOM REFS ───────────────────────────────────────────────────── */
const cityInput     = document.getElementById('cityInput');
const loadingOverlay= document.getElementById('loadingOverlay');
const weatherCard   = document.getElementById('weatherCard');
const errorBanner   = document.getElementById('errorBanner');
const errorText     = document.getElementById('errorText');
const suggestionsEl = document.getElementById('suggestions');
const recentSection = document.getElementById('recentSection');
const recentChips   = document.getElementById('recentChips');
const unitLabel     = document.getElementById('unitLabel');
const themeBtn      = document.getElementById('themeBtn');
const themeIcon     = document.getElementById('themeIcon');
const unitToggle    = document.getElementById('unitToggle');
 
/* ─── INIT ───────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  spawnParticles();
  drawCanvas();
  startClock();
  renderRecentSearches();
 
  cityInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') getWeather();
  });
 
  cityInput.addEventListener('input', debounce(handleAutocomplete, 380));
 
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-bar') && !e.target.closest('.suggestions')) {
      closeSuggestions();
    }
  });
 
  themeBtn.addEventListener('click', toggleTheme);
  unitToggle.addEventListener('click', toggleUnit);
});
 
/* ─── MAIN FETCH ─────────────────────────────────────────────────── */
async function getWeather(cityOverride) {
  const city = cityOverride || cityInput.value.trim();
  if (!city) { shakeInput(); return; }
 
  closeSuggestions();
  showLoading(true);
  hideError();
  hideCard();
 
  try {
    /* current weather */
    const [current, forecast] = await Promise.all([
      fetchJSON(`${BASE}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`),
      fetchJSON(`${BASE}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric&cnt=40`)
    ]);
 
    currentData = current;
    renderWeather(current, forecast);
    addToRecent(current.name);
    cityInput.value = '';
  } catch (err) {
    showError(err.message);
  } finally {
    showLoading(false);
  }
}
 
/* geo-location shortcut */
async function useMyLocation() {
  if (!navigator.geolocation) { showError('Geolocation not supported.'); return; }
  showLoading(true);
  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const { latitude: lat, longitude: lon } = pos.coords;
      const [current, forecast] = await Promise.all([
        fetchJSON(`${BASE}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`),
        fetchJSON(`${BASE}/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&cnt=40`)
      ]);
      currentData = current;
      renderWeather(current, forecast);
      addToRecent(current.name);
    } catch (err) {
      showError(err.message);
    } finally {
      showLoading(false);
    }
  }, () => {
    showLoading(false);
    showError('Location access denied.');
  });
}
 
function quickSearch(city) {
  cityInput.value = city;
  getWeather(city);
}
 
/* ─── RENDER ─────────────────────────────────────────────────────── */
function renderWeather(d, forecast) {
  /* city + meta */
  document.getElementById('cityName').textContent = d.name;
  document.getElementById('cityMeta').textContent =
    `${d.sys.country}  •  ${d.coord.lat.toFixed(2)}°N, ${d.coord.lon.toFixed(2)}°E`;
 
  /* icon + condition */
  const emoji = conditionEmoji(d.weather[0].id);
  document.getElementById('weatherIconBig').textContent = emoji;
  document.getElementById('conditionText').textContent = d.weather[0].description;
 
  /* temperature */
  renderTemp(d.main.temp, d.main.feels_like);
 
  /* details */
  document.getElementById('humidity').textContent   = d.main.humidity;
  document.getElementById('wind').textContent       = Math.round(d.wind.speed * 3.6);
  document.getElementById('visibility').textContent = (d.visibility / 1000).toFixed(1);
  document.getElementById('pressure').textContent   = d.main.pressure;
  document.getElementById('sunrise').textContent    = formatTime(d.sys.sunrise, d.timezone);
  document.getElementById('sunset').textContent     = formatTime(d.sys.sunset,  d.timezone);
 
  /* 5-day forecast (one entry per day at ~12:00) */
  const daily = getDailyForecasts(forecast.list);
  const forecastRow = document.getElementById('forecastRow');
  forecastRow.innerHTML = daily.map((item, i) => `
    <div class="forecast-day" style="animation-delay:${i * 0.08}s">
      <div class="forecast-day-name">${formatDay(item.dt)}</div>
      <div class="forecast-icon">${conditionEmoji(item.weather[0].id)}</div>
      <div class="forecast-temp">
        ${displayTemp(item.main.temp_max)}<span>${displayTemp(item.main.temp_min)}</span>
      </div>
    </div>
  `).join('');
 
  /* Hourly (next 8 entries = 24h) */
  const hourly = forecast.list.slice(0, 8);
  const hourlyRow = document.getElementById('hourlyRow');
  hourlyRow.innerHTML = hourly.map((item, i) => `
    <div class="hourly-item" style="animation-delay:${i * 0.06}s">
      <div class="hourly-time">${formatHour(item.dt)}</div>
      <div class="hourly-icon">${conditionEmoji(item.weather[0].id)}</div>
      <div class="hourly-temp">${displayTemp(item.main.temp)}</div>
    </div>
  `).join('');
 
  /* background tint based on weather */
  applyWeatherTheme(d.weather[0].id);
 
  showCard();
}
 
function renderTemp(temp, feelsLike) {
  if (!currentData) return;
  const t  = isCelsius ? temp       : cToF(temp);
  const fl = isCelsius ? feelsLike  : cToF(feelsLike);
  const u  = isCelsius ? '°C'       : '°F';
  document.getElementById('tempValue').textContent = Math.round(t);
  document.getElementById('tempUnit').textContent  = u;
  document.getElementById('feelsLike').textContent = `Feels like ${Math.round(fl)}${u}`;
}
 
function displayTemp(celsiusVal) {
  const v = isCelsius ? celsiusVal : cToF(celsiusVal);
  const u = isCelsius ? '°' : '°';
  return `${Math.round(v)}${u}`;
}
 
/* ─── UNIT TOGGLE ────────────────────────────────────────────────── */
function toggleUnit() {
  isCelsius = !isCelsius;
  unitLabel.textContent = isCelsius ? '°C' : '°F';
  if (currentData) {
    renderWeather(currentData, window._lastForecast || { list: [] });
  }
}
 
/* ─── THEME TOGGLE ───────────────────────────────────────────────── */
function toggleTheme() {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  themeIcon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  localStorage.setItem('nimbus_theme', isLight ? 'light' : 'dark');
}
 
/* apply saved theme */
if (localStorage.getItem('nimbus_theme') === 'light') {
  document.body.classList.add('light-mode');
  if (themeIcon) themeIcon.className = 'fa-solid fa-sun';
}
 
/* ─── AUTOCOMPLETE ───────────────────────────────────────────────── */
async function handleAutocomplete() {
  const q = cityInput.value.trim();
  if (q.length < 2) { closeSuggestions(); return; }
  try {
    const results = await fetchJSON(
      `${GEO}/direct?q=${encodeURIComponent(q)}&limit=5&appid=${API_KEY}`
    );
    if (!results.length) { closeSuggestions(); return; }
    suggestionsEl.innerHTML = results.map(r => `
      <li onclick="quickSearch('${r.name}')">
        <i class="fa-solid fa-location-dot"></i>
        ${r.name}${r.state ? ', ' + r.state : ''}, ${r.country}
      </li>
    `).join('');
    suggestionsEl.classList.add('open');
  } catch { closeSuggestions(); }
}
 
function closeSuggestions() {
  suggestionsEl.classList.remove('open');
}
 
/* ─── RECENT SEARCHES ────────────────────────────────────────────── */
function addToRecent(city) {
  recentSearches = [city, ...recentSearches.filter(c => c !== city)].slice(0, 8);
  localStorage.setItem('nimbus_recent', JSON.stringify(recentSearches));
  renderRecentSearches();
}
 
function renderRecentSearches() {
  if (!recentSearches.length) return;
  recentChips.innerHTML = recentSearches.map(c => `
    <button class="recent-chip" onclick="quickSearch('${c}')">${c}</button>
  `).join('');
  recentSection.classList.remove('hidden');
}
 
/* ─── LIVE CLOCK ─────────────────────────────────────────────────── */
function startClock() {
  tick();
  setInterval(tick, 1000);
}
function tick() {
  const now = new Date();
  const timeEl = document.getElementById('liveTime');
  const dateEl = document.getElementById('liveDate');
  if (timeEl) timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (dateEl) dateEl.textContent = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}
 
/* ─── ANIMATED BACKGROUND CANVAS ────────────────────────────────── */
function drawCanvas() {
  const canvas = document.getElementById('bgCanvas');
  const ctx    = canvas.getContext('2d');
  let t = 0;
 
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();
 
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isLight = document.body.classList.contains('light-mode');
 
    for (let i = 0; i < 3; i++) {
      const x = canvas.width  * (0.2 + i * 0.3 + 0.12 * Math.sin(t * 0.0007 + i));
      const y = canvas.height * (0.3 + i * 0.2 + 0.10 * Math.cos(t * 0.0009 + i));
      const r = Math.min(canvas.width, canvas.height) * (0.25 + 0.05 * Math.sin(t * 0.001 + i));
 
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      const colors = isLight
        ? ['rgba(13,148,136,0.18)', 'rgba(56,189,248,0.10)', 'transparent']
        : ['rgba(94,234,212,0.10)', 'rgba(56,189,248,0.07)', 'transparent'];
      grd.addColorStop(0, colors[0]);
      grd.addColorStop(0.5, colors[1]);
      grd.addColorStop(1, colors[2]);
 
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }
    t++;
    requestAnimationFrame(draw);
  }
  draw();
}
 
/* ─── PARTICLES ──────────────────────────────────────────────────── */
function spawnParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 18; i++) {
    const el = document.createElement('div');
    el.className = 'particle';
    const size = 4 + Math.random() * 10;
    el.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random() * 100}%;
      --dur:${10 + Math.random() * 18}s;
      --delay:-${Math.random() * 20}s;
    `;
    container.appendChild(el);
  }
}
 
/* ─── WEATHER THEME ──────────────────────────────────────────────── */
function applyWeatherTheme(id) {
  /* subtle accent shift depending on weather group */
  const root = document.documentElement;
  if      (id >= 200 && id < 300) root.style.setProperty('--accent', '#a78bfa'); // thunder
  else if (id >= 300 && id < 600) root.style.setProperty('--accent', '#60a5fa'); // rain/drizzle
  else if (id >= 600 && id < 700) root.style.setProperty('--accent', '#e2e8f0'); // snow
  else if (id >= 700 && id < 800) root.style.setProperty('--accent', '#fcd34d'); // haze/fog
  else if (id === 800)             root.style.setProperty('--accent', '#fbbf24'); // clear
  else                             root.style.setProperty('--accent', '#5eead4'); // clouds
}
 
/* ─── HELPERS ─────────────────────────────────────────────────────── */
async function fetchJSON(url) {
  const r = await fetch(url);
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
}
 
function cToF(c) { return c * 9/5 + 32; }
 
function formatTime(unix, tzOffset) {
  const d = new Date((unix + tzOffset) * 1000);
  return d.toUTCString().slice(17, 22);
}
 
function formatDay(unix) {
  return new Date(unix * 1000).toLocaleDateString([], { weekday: 'short' });
}
 
function formatHour(unix) {
  return new Date(unix * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}
 
function getDailyForecasts(list) {
  const seen = {};
  return list.filter(item => {
    const day = new Date(item.dt * 1000).toDateString();
    if (!seen[day]) { seen[day] = true; return true; }
    return false;
  }).slice(0, 5);
}
 
function conditionEmoji(id) {
  if (id >= 200 && id < 300) return '⛈';
  if (id >= 300 && id < 400) return '🌦';
  if (id >= 500 && id < 600) return '🌧';
  if (id >= 600 && id < 700) return '❄️';
  if (id >= 700 && id < 800) return '🌫';
  if (id === 800)              return '☀️';
  if (id === 801)              return '🌤';
  if (id === 802)              return '⛅';
  return '☁️';
}
 
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
 
function shakeInput() {
  const bar = document.getElementById('searchBar');
  bar.style.animation = 'none';
  bar.offsetHeight; // reflow
  bar.style.animation = 'shake 0.45s ease';
  setTimeout(() => bar.style.animation = '', 500);
}
 
/* visibility helpers */
function showLoading(v)  { loadingOverlay.classList.toggle('hidden', !v); }
function showCard()      { weatherCard.classList.remove('hidden'); }
function hideCard()      { weatherCard.classList.add('hidden'); }
function showError(msg)  { errorText.textContent = msg; errorBanner.classList.remove('hidden'); }
function hideError()     { errorBanner.classList.add('hidden'); }
 
/* cache forecast reference for unit toggling */
const _origRenderWeather = renderWeather;
window.renderWeather = function(d, forecast) {
  window._lastForecast = forecast;
  _origRenderWeather(d, forecast);
};
 
