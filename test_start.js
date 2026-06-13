const axios = require('axios');

async function testStart() {
  try {
    // I need to login first to get a token
    const login = await axios.post('https://yt-live-manager-backend.onrender.com/api/auth/login', {
      email: 'admin@example.com',
      password: 'password123'
    });
    const token = login.data.token;
    console.log("Logged in!");

    const streamId = '6a2d67665f3bf8e41a6cb859';
    console.log("Attempting to start stream: ", streamId);
    
    const res = await axios.post(`https://yt-live-manager-backend.onrender.com/api/stream/${streamId}/start`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log("Response:", res.data);
  } catch (err) {
    if (err.response) {
      console.error("API Error:", err.response.data);
    } else {
      console.error("Error:", err.message);
    }
  }
}

testStart();
