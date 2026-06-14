const http = require('http');

const API_BASE = 'http://localhost:3000/api';
// We need a valid admin cookie, but wait, the API requires a cookie now.
// It's easier to just look at the MongoDB directly or I'll just write a script that connects to Mongo directly and tests the mongoose hooks if any, but actually XSS is happening at the Route level.

// Let's create an event through the API. We need a token.
// Since we don't have a token in this script, we can bypass the auth for testing or just login via the script first.

const loginAndTest = async () => {
  const loginData = JSON.stringify({ email: 'admin@system.com', password: 'admin123' });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  };

  const req = http.request(options, res => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      const cookieHeader = res.headers['set-cookie'];
      const tokenCookie = cookieHeader ? cookieHeader[0].split(';')[0] : null;

      if (!tokenCookie) {
        console.error('Login failed, no cookie.', body);
        return;
      }

      // Now create event
      const evtData = JSON.stringify({
        title: 'Hackathon <script>alert(1)</script>',
        category: 'tech',
        auditoriumId: 'aud_1777621475374', // Existing aud
        date: '2026-10-10',
        time: '10:00',
        description: 'Test XSS <img src="x" onerror="alert(2)">'
      });

      const evtReq = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/events',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(evtData),
          'Cookie': tokenCookie
        }
      }, evtRes => {
        let evtBody = '';
        evtRes.on('data', c => evtBody += c);
        evtRes.on('end', () => {
          console.log('Event Response:', evtBody);
        });
      });

      evtReq.write(evtData);
      evtReq.end();
    });
  });

  req.write(loginData);
  req.end();
};

loginAndTest();
