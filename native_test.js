const http = require('http');

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      const token = result.data.tokens.accessToken;
      // Now fetch voters
      const getOptions = {
        hostname: 'localhost',
        port: 4000,
        path: '/api/v1/school/voters',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };
      const req2 = http.request(getOptions, (res2) => {
        let data2 = '';
        res2.on('data', (chunk) => { data2 += chunk; });
        res2.on('end', () => {
          console.log(`Status: ${res2.statusCode}`);
          console.log(`Response: ${data2}`);
        });
      });
      req2.end();
    } catch (err) {
      console.log('Error parsing login response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(JSON.stringify({ email: 'admin@greenvalley.school.ke', password: 'school2025' }));
req.end();
