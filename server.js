// server.js
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const Weather = require('./models/Weather');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(express.static('public')); // serve frontend files

// Connect MongoDB
connectDB();

// Route: Fetch weather by city
app.get('/weather/:city', async (req, res) => {
  try {
    const city = req.params.city;

    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.WEATHER_API_KEY}&units=metric`
    );

    const data = {
      city: response.data.name,
      temperature: response.data.main.temp,
      description: response.data.weather[0].description,
    };

    // Save to MongoDB
    const weather = new Weather(data);
    await weather.save();

    res.json(data);
  } catch (err) {
    console.log(error.response?.data);
    console.error(err);
    res.status(500).json({ error: 'Error fetching weather data' });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));