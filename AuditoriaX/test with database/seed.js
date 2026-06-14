/**
 * seed.js — Seeds the MongoDB database with default auditoriums and events
 * Run this once: node seed.js
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Auditorium = require('./models/Auditorium');
const Event = require('./models/Event');
const SeatMap = require('./models/SeatMap');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/auditoriax';

const futureDate = d => {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().split('T')[0];
};

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Check if already seeded
  const audCount = await Auditorium.countDocuments();
  if (audCount > 0) {
    console.log('Database already has data. Skipping seed.');
    await mongoose.disconnect();
    return;
  }

  // Seed admin user
  const adminHash = await bcrypt.hash('admin123', 10);
  await User.create({
    email: 'admin@system.com',
    password: adminHash,
    role: 'admin',
    college: 'System Admin'
  });
  console.log('Admin user created');

  // Seed auditoriums
  const auditoriums = [
    { audId: 'aud_1', college: 'KL University', name: 'KLU Main Auditorium', capacity: 300, city: 'Vijayawada', facilities: ['AC', 'Projector', 'Wi-Fi', 'Parking'], teacherSeats: 30, girlSeats: 108, boySeats: 162 },
    { audId: 'aud_2', college: 'KL University', name: 'KLU Seminar Hall', capacity: 150, city: 'Vijayawada', facilities: ['AC', 'Projector'], teacherSeats: 20, girlSeats: 52, boySeats: 78 },
    { audId: 'aud_3', college: 'VIT University', name: 'VIT Auditorium', capacity: 500, city: 'Vellore', facilities: ['AC', 'Stage Lighting', 'Sound System', 'Recording Studio'], teacherSeats: 20, girlSeats: 192, boySeats: 288 },
    { audId: 'aud_4', college: 'SRM University', name: 'SRM Convention Hall', capacity: 200, city: 'Chennai', facilities: ['AC', 'Projector', 'Wi-Fi'], teacherSeats: 20, girlSeats: 72, boySeats: 108 },
  ];
  await Auditorium.insertMany(auditoriums);
  console.log('Auditoriums seeded');

  // Seed events
  const events = [
    { evtId: 'evt_1', title: 'TechFest 2025', category: 'tech', auditoriumId: 'aud_1', college: 'KL University', date: futureDate(3), time: '10:00', duration: 6, clusters: ['1','2','3'], price: 0, color: '#5b8dee', description: "KLU's biggest annual tech symposium! Hackathons, robotics competitions, AI workshops, and prize pool of ₹5 lakhs.", createdBy: 'admin@system.com' },
    { evtId: 'evt_2', title: 'Cultural Fiesta 2025', category: 'cultural', auditoriumId: 'aud_2', college: 'KL University', date: futureDate(7), time: '17:00', duration: 5, clusters: ['1','2','3','4','5'], price: 0, color: '#f472b6', description: 'An evening of dance, music, drama, and fashion. Clusters 1-5 welcome! Performances by 30+ student groups.', createdBy: 'admin@system.com' },
    { evtId: 'evt_3', title: 'AI Revolution: Guest Lecture', category: 'lecture', auditoriumId: 'aud_3', college: 'VIT University', date: futureDate(2), time: '11:00', duration: 3, clusters: ['1','2','3','4','5'], price: 250, color: '#22d87a', description: 'Keynote by Dr. Rajeev Menon, Chief AI Officer at Infosys. Topics: LLMs, Generative AI, and the future of work. Open to all colleges.', createdBy: 'admin@system.com' },
    { evtId: 'evt_4', title: 'National Coding Championship', category: 'tech', auditoriumId: 'aud_4', college: 'SRM University', date: futureDate(10), time: '09:00', duration: 8, clusters: ['1','2','3','4','5'], price: 199, color: '#fb923c', description: 'Compete against coders from 100+ colleges. DSA rounds, system design, and a final hackathon. Top 3 win cash prizes + internship offers.', createdBy: 'admin@system.com' },
    { evtId: 'evt_5', title: 'Inter-College Debate Championship', category: 'cultural', auditoriumId: 'aud_1', college: 'KL University', date: futureDate(14), time: '14:00', duration: 4, clusters: ['2','3','4'], price: 0, color: '#a78bfa', description: 'Regional debate championship open to all colleges. Topics include climate policy, AI ethics, and economic reforms. Register your 2-member team.', createdBy: 'admin@system.com' },
    { evtId: 'evt_6', title: 'Startup Pitch Day 2025', category: 'other', auditoriumId: 'aud_3', college: 'VIT University', date: futureDate(5), time: '13:00', duration: 5, clusters: ['1','2','3','4','5'], price: 149, color: '#34d399', description: 'Present your startup idea to a panel of VCs and angel investors. Best pitch wins ₹1 Lakh funding + mentorship. Open to all college teams.', createdBy: 'admin@system.com' },
  ];

  // Dynamically generate 10 more events
  for (let i = 1; i <= 10; i++) {
    const aud = auditoriums[i % auditoriums.length]; // pick an auditorium
    events.push({
      evtId: `evt_gen_${i}`,
      title: `Generated Event ${i}`,
      category: i % 2 === 0 ? 'tech' : 'cultural',
      auditoriumId: aud.audId,
      college: aud.college,
      date: futureDate(i * 2 + 10), // staggered dates further out
      time: '10:00',
      duration: 3,
      clusters: ['1', '2', '3'],
      price: i * 50,
      color: '#ff5722',
      description: `This is an auto-generated event number ${i}.`,
      createdBy: 'admin@system.com'
    });
  }

  await Event.insertMany(events);
  console.log('Events seeded');

  // Create seat maps for each event
  const audMap = {};
  auditoriums.forEach(a => { audMap[a.audId] = a.capacity; });

  for (const evt of events) {
    const cap = audMap[evt.auditoriumId];
    await SeatMap.create({
      eventId: evt.evtId,
      capacity: cap,
      seats: Array(cap).fill(false)
    });
  }
  console.log('Seat maps created');

  await mongoose.disconnect();
  console.log('Seed complete!');
}

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
