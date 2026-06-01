async function getWeather() {
  const city = document.getElementById('cityInput').value;
  if (!city) {
    alert("Please enter a city name!");
    return;
  }

  try {
    const response = await fetch(`/weather/${city}`);
    const data = await response.json();

    if (data.error) {
      document.getElementById('result').innerHTML = `<p style="color:red;">${data.error}</p>`;
    } else {
      document.getElementById('result').innerHTML = `
        <h2>${data.city}</h2>
        <p>🌡 Temperature: ${data.temperature}°C</p>
        <p>🌥 Condition: ${data.description}</p>
      `;
    }
  } catch (err) {
    document.getElementById('result').innerHTML = `<p style="color:red;">Error fetching data.</p>`;
    console.error(err);
  }
}
