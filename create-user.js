const apiUrl = 'https://vzbymfelssijrwoqpjnr.supabase.co/auth/v1/signup';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6YnltZmVsc3NpanJ3b3Fwam5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MjcyOTMsImV4cCI6MjA5MDEwMzI5M30.UXbCf4laK5hcHsuv4YJJ3qxa7xeIGqCFNbPzMKMxJAY';

async function main() {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'justino@golrila.com',
      password: '1145Biel',
      data: {
        username: 'Justino',
        name: 'Administrador Principal',
        role: 'admin'
      }
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
main();
