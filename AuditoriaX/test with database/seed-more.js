const http = require('http');

const API_BASE = 'http://localhost:3000/api';

const postData = (path, data) => {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api' + path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
};

const auds = [
  { college: 'VIT University', name: 'VIT Grand Auditorium', capacity: 500, city: 'Vellore', facilities: ['AC', 'Recording Studio', 'Stage Lighting'], teacherSeats: 30, girlSeats: 188, boySeats: 282 },
  { college: 'SRM University', name: 'Tech Park Hall', capacity: 150, city: 'Chennai', facilities: ['AC', 'Projector', 'Wi-Fi'], teacherSeats: 15, girlSeats: 54, boySeats: 81 }
];

async function seed() {
  try {
    console.log('Seeding auditoriums...');
    const audRes1 = await postData('/auditoriums', auds[0]);
    const audRes2 = await postData('/auditoriums', auds[1]);
    console.log('Auditoriums created');

    // Also get the existing auditoriums to map events to them
    const existingAud1 = 'aud_1777621475374'; // KL University
    const existingAud2 = 'aud_1777621520611'; // VNR University

    const dt = (days) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().split('T')[0];
    };

    const events = [
      { title: 'Global AI Summit 2026', category: 'tech', auditoriumId: audRes1.id, date: dt(5), time: '10:00', duration: 8, price: 500, color: '#5b8dee', description: 'Join industry leaders for a full-day summit on Artificial Intelligence, GenAI, and the future of technology.', createdBy: 'admin@system.com' },
      { title: 'Inter-College Dance Battle', category: 'cultural', auditoriumId: existingAud1, date: dt(7), time: '17:00', duration: 4, price: 150, color: '#f472b6', description: 'The biggest dance battle of the year. Crews from 20+ colleges competing for the grand prize.', createdBy: 'admin@system.com' },
      { title: 'Cybersecurity Workshop', category: 'tech', auditoriumId: audRes2.id, date: dt(2), time: '14:00', duration: 3, price: 0, color: '#22d87a', description: 'Hands-on ethical hacking workshop. Bring your laptops. Free entry for students!', createdBy: 'admin@system.com' },
      { title: 'National Level Hackathon', category: 'tech', auditoriumId: existingAud2, date: dt(14), time: '09:00', duration: 24, price: 200, color: '#fb923c', description: '24-hour coding marathon. Build solutions for real-world problems. Great prizes and internship opportunities.', createdBy: 'admin@system.com' },
      { title: 'Startup Pitch Fest', category: 'other', auditoriumId: audRes1.id, date: dt(10), time: '11:00', duration: 5, price: 300, color: '#8888a8', description: 'Pitch your startup idea to top VCs and Angel Investors. Networking lunch included.', createdBy: 'admin@system.com' },
      { title: 'Guest Lecture: Space Exploration', category: 'lecture', auditoriumId: audRes2.id, date: dt(4), time: '15:00', duration: 2, price: 0, color: '#a78bfa', description: 'Special lecture by ISRO scientists on upcoming lunar missions and deep space exploration.', createdBy: 'admin@system.com' }
    ];

    console.log('Seeding events...');
    for (const evt of events) {
      await postData('/events', evt);
    }
    console.log('Successfully seeded ' + events.length + ' events!');

  } catch (err) {
    console.error('Error seeding data:', err);
  }
}

seed();
