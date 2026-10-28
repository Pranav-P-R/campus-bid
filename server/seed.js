const bcrypt = require('bcryptjs');
const { initDb, query, transaction } = require('./db');

async function seed() {
  console.log('--- Starting Database Seeding ---');
  await initDb();

  const hashedPw = await bcrypt.hash('password123', 10);
  const adminPw = await bcrypt.hash('adminpassword', 10);

  // 1. Create Users
  console.log('Seeding demo students...');
  const users = [
    {
      fullName: 'Priya Sharma',
      displayName: 'Priya S.',
      email: 'priya.sharma@campus.edu',
      campusId: 'CAMPUS-2024-CS042',
      passwordHash: hashedPw,
      isAdmin: false
    },
    {
      fullName: 'Rahul Verma',
      displayName: 'Rahul V.',
      email: 'rahul.verma@campus.edu',
      campusId: 'CAMPUS-2023-ME108',
      passwordHash: hashedPw,
      isAdmin: false
    },
    {
      fullName: 'Ananya Patel',
      displayName: 'Ananya P.',
      email: 'ananya.patel@campus.edu',
      campusId: 'CAMPUS-2024-EC019',
      passwordHash: hashedPw,
      isAdmin: false
    },
    {
      fullName: 'Vikram Singh',
      displayName: 'Vikram S.',
      email: 'vikram.singh@campus.edu',
      campusId: 'CAMPUS-2023-CE077',
      passwordHash: hashedPw,
      isAdmin: false
    },
    {
      fullName: 'Prof. Campus Admin',
      displayName: 'Campus Admin',
      email: 'admin@campus.edu',
      campusId: 'CAMPUS-FAC-001',
      passwordHash: adminPw,
      isAdmin: true
    }
  ];

  const userMap = {};
  for (const u of users) {
    const res = await query(
      `INSERT INTO users (full_name, display_name, email, password_hash, campus_id, email_verified, campus_verified, is_admin)
       VALUES ($1, $2, $3, $4, $5, TRUE, TRUE, $6)
       ON CONFLICT (email)
       DO UPDATE SET full_name = $1, display_name = $2, password_hash = $4, updated_at = NOW()
       RETURNING id, display_name, email`,
      [u.fullName, u.displayName, u.email, u.passwordHash, u.campusId, u.isAdmin]
    );
    userMap[u.displayName] = res.rows[0];
  }
  console.log(`Seeded ${Object.keys(userMap).length} students.`);

  // Categories
  const catRes = await query('SELECT id, slug FROM categories');
  const catMap = {};
  catRes.rows.forEach(c => { catMap[c.slug] = c.id; });

  // 2. Auctions
  console.log('Seeding sample campus auctions...');

  const now = Date.now();
  const sampleAuctions = [
    {
      seller: 'Priya S.',
      category: 'cycles',
      title: 'Hero Sprint Pro 21-Speed Gear Cycle (Hostel 4)',
      description: 'Well-maintained 21-speed hybrid bicycle. Dual disc brakes, front shock absorbers, bottle holder, and sturdy campus lock included. Great for commuting between academic blocks and hostels.',
      condition: 'good',
      startingPrice: 1200.00,
      minIncrement: 100.00,
      endTime: new Date(now + 45 * 60 * 1000), // 45 mins
      status: 'active',
      images: [
        'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=800&q=80'
      ]
    },
    {
      seller: 'Rahul V.',
      category: 'calculators',
      title: 'Casio fx-991EX ClassWiz Scientific Calculator (Allowed in Exams)',
      description: 'Original Casio fx-991EX with QR code functionality, matrix & spreadsheet functions. Solar + battery working perfectly. Slide-on hard case with reference formulas included.',
      condition: 'like_new',
      startingPrice: 400.00,
      minIncrement: 50.00,
      endTime: new Date(now + 12 * 60 * 1000), // 12 mins
      status: 'active',
      images: [
        'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?auto=format&fit=crop&w=800&q=80'
      ]
    },
    {
      seller: 'Ananya P.',
      category: 'books',
      title: "Thomas' Calculus (14th Edition) + Complete Solutions Manual",
      description: 'Essential textbook for First & Second year engineering math courses (Calculus I & II). Pristine condition, no pen markings, includes companion multivariable calculus notes.',
      condition: 'like_new',
      startingPrice: 350.00,
      minIncrement: 25.00,
      endTime: new Date(now + 90 * 60 * 1000), // 90 mins
      status: 'active',
      images: [
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80'
      ]
    },
    {
      seller: 'Vikram S.',
      category: 'electronics',
      title: 'Logitech MX Master 3S Wireless Performance Mouse',
      description: 'Ergonomic silent click mouse with MagSpeed electromagnetic wheel. Connects via Bluetooth or Logi Bolt receiver. Up to 70 days battery life. USB-C charging cable included.',
      condition: 'good',
      startingPrice: 1800.00,
      minIncrement: 100.00,
      endTime: new Date(now + 3 * 3600 * 1000), // 3 hours
      status: 'active',
      images: [
        'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80'
      ]
    },
    {
      seller: 'Priya S.',
      category: 'hostel-items',
      title: 'Haier 50L Compact Hostel Refrigerator (Works on Room Backup)',
      description: 'Energy efficient single-door mini fridge with freezer compartment. Keeps milk, fruits, cold drinks chilled. Completely silent operation. Perfect for 2-3 roomies.',
      condition: 'good',
      startingPrice: 3000.00,
      minIncrement: 200.00,
      endTime: new Date(now + 4 * 3600 * 1000), // 4 hours
      status: 'active',
      images: [
        'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=800&q=80'
      ]
    },
    {
      seller: 'Ananya P.',
      category: 'hostel-items',
      title: 'Engineering Mini Drafter + A1 Wooden Drawing Board + T-Scale',
      description: 'Complete engineering graphics / drawing kit. Stainless steel arm, smooth angle locking knob. Board has no dents. Passed ED exam with A grade with this set.',
      condition: 'like_new',
      startingPrice: 450.00,
      minIncrement: 50.00,
      endTime: new Date(now + 8 * 3600 * 1000), // 8 hours
      status: 'active',
      images: [
        'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=800&q=80'
      ]
    },
    {
      seller: 'Vikram S.',
      category: 'hostel-items',
      title: '⚡ Anti-Sniping Demo: Yonex Carbonex Badminton Rackets (Pair)',
      description: 'DEMO ITEM: Closing in ~50 seconds! Place a bid right now in the final 30 seconds to witness the automatic +60s Anti-Sniping deadline extension rule live on your screen!',
      condition: 'good',
      startingPrice: 300.00,
      minIncrement: 20.00,
      endTime: new Date(now + 50 * 1000), // 50 seconds - immediate anti-snipe testing!
      status: 'active',
      images: [
        'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80'
      ]
    },
    {
      seller: 'Priya S.',
      category: 'electronics',
      title: 'Amazon Kindle Paperwhite (10th Gen 8GB Waterproof)',
      description: '300 ppi glare-free display with adjustable warm light. Battery lasts weeks. Loaded with engineering, philosophy, and sci-fi books.',
      condition: 'like_new',
      startingPrice: 2200.00,
      minIncrement: 100.00,
      startTime: new Date(now - 2 * 3600 * 1000), // started 2 hours ago
      endTime: new Date(now - 10 * 60 * 1000), // closed 10 mins ago
      status: 'closed',
      images: [
        'https://images.unsplash.com/photo-1592496431122-2349e0fbc666?auto=format&fit=crop&w=800&q=80'
      ]
    }
  ];

  for (const item of sampleAuctions) {
    const seller = userMap[item.seller];
    const catId = catMap[item.category];

    // Check if item already exists
    const existing = await query('SELECT id FROM auctions WHERE title = $1', [item.title]);
    if (existing.rows.length > 0) continue;

    const startTime = item.startTime || new Date(now - 30 * 60 * 1000);

    const insRes = await query(
      `INSERT INTO auctions (
        seller_id, category_id, title, description, item_condition,
        starting_price, min_bid_increment, start_time, end_time, status, closed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, title, starting_price, min_bid_increment`,
      [
        seller.id,
        catId,
        item.title,
        item.description,
        item.condition,
        item.startingPrice,
        item.minIncrement,
        startTime,
        item.endTime,
        item.status,
        item.status === 'closed' ? item.endTime : null
      ]
    );

    const auc = insRes.rows[0];

    // Images
    for (let i = 0; i < item.images.length; i++) {
      await query(
        `INSERT INTO auction_images (auction_id, image_url, sort_order) VALUES ($1, $2, $3)`,
        [auc.id, item.images[i], i]
      );
    }

    // Seed realistic bids on Cycle
    if (item.title.includes('Hero Sprint')) {
      const b1 = userMap['Rahul V.'];
      const b2 = userMap['Ananya P.'];
      const { v4: uuidv4 } = require('uuid');

      // Rahul bids 1200
      await query(
        `INSERT INTO bids (auction_id, bidder_id, amount, bid_type, request_key, created_at)
         VALUES ($1, $2, 1200.00, 'manual', $3, NOW() - INTERVAL '30 minutes')`,
        [auc.id, b1.id, uuidv4()]
      );

      // Ananya bids 1400
      await query(
        `INSERT INTO bids (auction_id, bidder_id, amount, bid_type, request_key, created_at)
         VALUES ($1, $2, 1400.00, 'manual', $3, NOW() - INTERVAL '15 minutes')`,
        [auc.id, b2.id, uuidv4()]
      );

      // Rahul bids 1500
      await query(
        `INSERT INTO bids (auction_id, bidder_id, amount, bid_type, request_key, created_at)
         VALUES ($1, $2, 1500.00, 'manual', $3, NOW() - INTERVAL '5 minutes')`,
        [auc.id, b1.id, uuidv4()]
      );

      await query(
        `UPDATE auctions SET current_price = 1500.00, current_high_bidder_id = $1 WHERE id = $2`,
        [b1.id, auc.id]
      );

      // Q&A
      await query(
        `INSERT INTO questions (auction_id, asker_id, question_text, answer_text, answered_by_user_id, answered_at)
         VALUES ($1, $2, 'Are the gears shifting smoothly without chain slippage?', 'Yes, got it serviced last month at the campus cycle store, both derailleurs are tuned.', $3, NOW() - INTERVAL '20 minutes')`,
        [auc.id, userMap['Vikram S.'].id, seller.id]
      );
    }

    // Seed realistic bids on Calculator
    if (item.title.includes('Casio fx-991EX')) {
      const b1 = userMap['Vikram S.'];
      const { v4: uuidv4 } = require('uuid');

      await query(
        `INSERT INTO bids (auction_id, bidder_id, amount, bid_type, request_key, created_at)
         VALUES ($1, $2, 400.00, 'manual', $3, NOW() - INTERVAL '10 minutes')`,
        [auc.id, b1.id, uuidv4()]
      );
      await query(
        `UPDATE auctions SET current_price = 400.00, current_high_bidder_id = $1 WHERE id = $2`,
        [b1.id, auc.id]
      );

      await query(
        `INSERT INTO questions (auction_id, asker_id, question_text, answer_text, answered_by_user_id, answered_at)
         VALUES ($1, $2, 'Can you handover near SAC or Library today evening?', 'Sure, I can meet right after my 5 PM lab near Central Library.', $3, NOW() - INTERVAL '5 minutes')`,
        [auc.id, userMap['Ananya P.'].id, seller.id]
      );
    }

    // Seed closed auction sale outcome for Kindle
    if (item.title.includes('Kindle Paperwhite')) {
      const buyer = userMap['Rahul V.'];
      const { v4: uuidv4 } = require('uuid');

      const bidRes = await query(
        `INSERT INTO bids (auction_id, bidder_id, amount, bid_type, request_key, created_at)
         VALUES ($1, $2, 2400.00, 'manual', $3, NOW() - INTERVAL '15 minutes')
         RETURNING id`,
        [auc.id, buyer.id, uuidv4()]
      );

      await query(
        `UPDATE auctions SET current_price = 2400.00, current_high_bidder_id = $1 WHERE id = $2`,
        [buyer.id, auc.id]
      );

      await query(
        `INSERT INTO sales (auction_id, seller_id, buyer_id, winning_bid_id, final_price, status)
         VALUES ($1, $2, $3, $4, 2400.00, 'pending_seller_approval')
         ON CONFLICT (auction_id) DO NOTHING`,
        [auc.id, seller.id, buyer.id, bidRes.rows[0].id]
      );
    }
  }

  // 3. Saved searches demo
  console.log('Seeding sample saved searches...');
  const rahul = userMap['Rahul V.'];
  if (rahul) {
    await query(
      `INSERT INTO saved_searches (user_id, name, keyword, category_id, max_price)
       VALUES ($1, 'Scientific calculator under ₹500', 'calculator', $2, 500.00)
       ON CONFLICT DO NOTHING`,
      [rahul.id, catMap['calculators']]
    );
  }

  console.log('✅ Database seeded successfully with demo students and active campus auctions!');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = { seed };
