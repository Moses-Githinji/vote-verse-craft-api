const test = async () => {
  const fetch = (await import('node-fetch')).default;
  const loginRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@greenvalley.school.ke', password: 'school2025' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data.tokens.accessToken;

  const votersRes = await fetch('http://localhost:4000/api/v1/school/voters', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Status:', votersRes.status);
  console.log('Response:', await votersRes.text());
}

test();
