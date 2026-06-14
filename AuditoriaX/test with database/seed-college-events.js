/**
 * seed-college-events.js
 * Inserts 10 realistic college events directly into MongoDB.
 * Run: node seed-college-events.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Event    = require('./models/Event');
const Auditorium = require('./models/Auditorium');
const SeatMap  = require('./models/SeatMap');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/auditoriax';

// Utility: return a future date string (YYYY-MM-DD) offset by `days` from today
const futureDate = days => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB:', MONGO_URI);

  // Load existing auditoriums so we can use real IDs & colleges
  const auditoriums = await Auditorium.find().lean();
  if (auditoriums.length === 0) {
    console.error('❌  No auditoriums found in the database. Run seed.js first.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // Helper: pick an auditorium by round-robin index
  const aud = i => auditoriums[i % auditoriums.length];

  const events = [
    {
      evtId: `evt_col_${Date.now()}_1`,
      title: 'Hackathon Horizon 2026',
      category: 'tech',
      auditoriumId: aud(0).audId,
      college: aud(0).college,
      date: futureDate(4),
      time: '09:00',
      duration: 10,
      clusters: ['1', '2', '3'],
      price: 0,
      color: '#5b8dee',
      description: '24-hour hackathon open to all branches. Build solutions for healthcare, agriculture & smart cities. Prize pool ₹3 Lakhs + FAANG internship fast-track.',
      createdBy: 'admin@system.com',
    },
    {
      evtId: `evt_col_${Date.now()}_2`,
      title: 'Rhythm & Rhapsody — Music Night',
      category: 'cultural',
      auditoriumId: aud(1).audId,
      college: aud(1).college,
      date: futureDate(6),
      time: '18:00',
      duration: 4,
      clusters: ['1', '2', '3', '4', '5'],
      price: 50,
      color: '#f472b6',
      description: 'Inter-college music festival featuring rock, classical fusion, and electronic acts. 20 bands competing. Entry ₹50. Food stalls open at 17:00.',
      createdBy: 'admin@system.com',
    },
    {
      evtId: `evt_col_${Date.now()}_3`,
      title: 'Research Paper Presentation Day',
      category: 'lecture',
      auditoriumId: aud(2).audId,
      college: aud(2).college,
      date: futureDate(8),
      time: '10:00',
      duration: 6,
      clusters: ['1', '2', '3', '4', '5'],
      price: 0,
      color: '#22d87a',
      description: 'Students and faculty present original research across CS, Biotech, Civil & ECE domains. Best paper award carries ₹50,000 grant and journal publication support.',
      createdBy: 'admin@system.com',
    },
    {
      evtId: `evt_col_${Date.now()}_4`,
      title: 'Entrepreneurship Summit 2026',
      category: 'other',
      auditoriumId: aud(3).audId,
      college: aud(3).college,
      date: futureDate(10),
      time: '11:00',
      duration: 5,
      clusters: ['1', '2', '3', '4', '5'],
      price: 199,
      color: '#fb923c',
      description: 'Panel discussions with founders from Y-Combinator startups, live pitch sessions, and 1:1 mentoring. Register your startup idea before March 20.',
      createdBy: 'admin@system.com',
    },
    {
      evtId: `evt_col_${Date.now()}_5`,
      title: 'Drama Fest: Spotlight 2026',
      category: 'cultural',
      auditoriumId: aud(0).audId,
      college: aud(0).college,
      date: futureDate(12),
      time: '17:30',
      duration: 3,
      clusters: ['2', '3', '4'],
      price: 30,
      color: '#a78bfa',
      description: 'Annual inter-college drama competition. Themes: social justice, mythology, and comedy. 15 teams performing in English, Telugu, and Hindi. Best actor award + ₹25,000.',
      createdBy: 'admin@system.com',
    },
    {
      evtId: `evt_col_${Date.now()}_6`,
      title: 'Cybersecurity Workshop by CERT-In',
      category: 'tech',
      auditoriumId: aud(1).audId,
      college: aud(1).college,
      date: futureDate(15),
      time: '10:00',
      duration: 5,
      clusters: ['1', '2', '3'],
      price: 299,
      color: '#34d399',
      description: 'Hands-on ethical hacking & penetration testing workshop conducted by CERT-In certified trainers. Includes CTF challenges. Certificate of completion provided.',
      createdBy: 'admin@system.com',
    },
    {
      evtId: `evt_col_${Date.now()}_7`,
      title: 'Sports & Fitness Conclave',
      category: 'other',
      auditoriumId: aud(2).audId,
      college: aud(2).college,
      date: futureDate(17),
      time: '09:00',
      duration: 8,
      clusters: ['1', '2', '3', '4', '5'],
      price: 0,
      color: '#f59e0b',
      description: 'Kick-off event for the inter-college sports season. Includes an indoor athletics showcase, nutrition talk by a national athlete, and prize distribution for last season.',
      createdBy: 'admin@system.com',
    },
    {
      evtId: `evt_col_${Date.now()}_8`,
      title: 'AI & ML Symposium 2026',
      category: 'tech',
      auditoriumId: aud(3).audId,
      college: aud(3).college,
      date: futureDate(20),
      time: '10:00',
      duration: 6,
      clusters: ['1', '2', '3'],
      price: 149,
      color: '#06b6d4',
      description: 'Keynotes by IIT & IISc professors on GANs, LLMs, and robotics. Student project expo, live demos of homegrown AI models, and industry Q&A panel.',
      createdBy: 'admin@system.com',
    },
    {
      evtId: `evt_col_${Date.now()}_9`,
      title: 'Literary Festival: Words & Worlds',
      category: 'cultural',
      auditoriumId: aud(0).audId,
      college: aud(0).college,
      date: futureDate(22),
      time: '16:00',
      duration: 4,
      clusters: ['2', '3', '4', '5'],
      price: 0,
      color: '#ec4899',
      description: 'Celebrating literature with poetry slams, short story competitions, book reviews, and a special session with bestselling author Chetan Bhagat (virtual).',
      createdBy: 'admin@system.com',
    },
    {
      evtId: `evt_col_${Date.now()}_10`,
      title: 'Career & Placement Fair 2026',
      category: 'other',
      auditoriumId: aud(1).audId,
      college: aud(1).college,
      date: futureDate(25),
      time: '09:30',
      duration: 7,
      clusters: ['1', '2', '3', '4', '5'],
      price: 0,
      color: '#8b5cf6',
      description: '50+ companies including TCS, Wipro, Microsoft, and Amazon participating. Resume workshops at 09:00, GD rounds at 11:00, final interviews from 14:00. Formal dress mandatory.',
      createdBy: 'admin@system.com',
    },
  ];

  let inserted = 0;
  const audMap = {};
  auditoriums.forEach(a => { audMap[a.audId] = a; });

  for (const evt of events) {
    // Skip if an event with this evtId already exists (shouldn't happen, but safe)
    const exists = await Event.findOne({ evtId: evt.evtId });
    if (exists) {
      console.log(`⚠️  Skipping "${evt.title}" — already exists.`);
      continue;
    }

    const audRecord = audMap[evt.auditoriumId];
    await Event.create({ ...evt, institutionId: audRecord.institutionId || null });

    // Create a seat map for this event
    await SeatMap.create({
      eventId: evt.evtId,
      institutionId: audRecord.institutionId || null,
      capacity: audRecord.capacity,
      seats: Array(audRecord.capacity).fill(false),
    });

    console.log(`✅  Created: ${evt.title} (${evt.date})`);
    inserted++;
  }

  console.log(`\n🎉  Done! ${inserted} events inserted.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('❌  Error:', err.message);
  process.exit(1);
});
