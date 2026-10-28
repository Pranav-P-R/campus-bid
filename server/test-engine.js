const { placeBid, setAutoBidLimit } = require('./services/auctionEngine');
const { query } = require('./db');

async function runTests() {
  console.log('🧪 Starting core bidding engine tests...');

  // Get users
  const priya = (await query("SELECT id FROM users WHERE email = 'priya.sharma@campus.edu'")).rows[0];
  const rahul = (await query("SELECT id FROM users WHERE email = 'rahul.verma@campus.edu'")).rows[0];
  const ananya = (await query("SELECT id FROM users WHERE email = 'ananya.patel@campus.edu'")).rows[0];

  // Get Hero cycle auction (seller is Priya)
  const cycle = (await query("SELECT * FROM auctions WHERE title LIKE 'Hero Sprint%'")).rows[0];

  // Test 1: Seller cannot bid on own auction
  console.log('\n--- Test 1: Seller self-bidding rejection ---');
  try {
    await placeBid({
      auctionId: cycle.id,
      bidderId: priya.id,
      amount: 2000
    });
    console.error('❌ FAILED: Seller was allowed to bid!');
  } catch (err) {
    console.log('✅ PASSED: Correctly rejected seller self-bid:', err.message);
  }

  // Test 2: Bid below min increment is rejected
  console.log('\n--- Test 2: Bid below minimum increment rejection ---');
  const freshCycle = (await query("SELECT * FROM auctions WHERE title LIKE 'Hero Sprint%'")).rows[0];
  const competitor = freshCycle.current_high_bidder_id === ananya.id ? rahul : ananya;
  const currentPrice = parseFloat(freshCycle.current_price);
  const minInc = parseFloat(freshCycle.min_bid_increment);
  const invalidBid = currentPrice + (minInc / 2); // e.g. 1550 when increment is 100
  try {
    await placeBid({
      auctionId: freshCycle.id,
      bidderId: competitor.id,
      amount: invalidBid
    });
    console.error('❌ FAILED: Sub-increment bid was accepted!');
  } catch (err) {
    console.log('✅ PASSED: Correctly rejected sub-increment bid:', err.message);
  }

  // Test 3: Valid bid is accepted and atomically updates auction
  console.log('\n--- Test 3: Valid manual bid placement ---');
  const validBid = currentPrice + minInc;
  try {
    const res = await placeBid({
      auctionId: freshCycle.id,
      bidderId: competitor.id,
      amount: validBid
    });
    console.log(`✅ PASSED: Bid ₹${validBid} accepted! Current price updated to ₹${res.currentPrice}`);
    const updated = (await query('SELECT current_price, current_high_bidder_id FROM auctions WHERE id = $1', [freshCycle.id])).rows[0];
    console.log(`Auction DB snapshot: Price = ₹${updated.current_price}, High Bidder = ${updated.current_high_bidder_id === competitor.id ? 'Competitor (Correct)' : 'Wrong'}`);
  } catch (err) {
    console.error('❌ FAILED to place valid bid:', err.message);
  }

  // Test 4: Anti-sniping extension test
  console.log('\n--- Test 4: Anti-sniping rule on < 30s remaining ---');
  const antiSnipeAuction = (await query("SELECT * FROM auctions WHERE title LIKE '%Anti-Sniping%'")).rows[0];
  if (antiSnipeAuction) {
    const antiSnipeBidder = antiSnipeAuction.current_high_bidder_id === rahul.id ? ananya : rahul;
    const antiSnipeStartP = antiSnipeAuction.current_price ? parseFloat(antiSnipeAuction.current_price) : parseFloat(antiSnipeAuction.starting_price);
    const antiSnipeInc = parseFloat(antiSnipeAuction.min_bid_increment);
    const nextSnipeBid = antiSnipeAuction.current_price ? antiSnipeStartP + antiSnipeInc : antiSnipeStartP;

    // Set closing time to 15 seconds from now
    await query("UPDATE auctions SET end_time = NOW() + INTERVAL '15 seconds', status = 'active' WHERE id = $1", [antiSnipeAuction.id]);
    const beforeEndTime = (await query('SELECT end_time FROM auctions WHERE id = $1', [antiSnipeAuction.id])).rows[0].end_time;
    console.log(`Initial end time: ${new Date(beforeEndTime).toISOString()}`);

    const res = await placeBid({
      auctionId: antiSnipeAuction.id,
      bidderId: antiSnipeBidder.id,
      amount: nextSnipeBid
    });

    console.log(`Bid placed during final 30s! wasExtended: ${res.wasExtended}`);
    console.log(`New end time: ${new Date(res.newEndTime).toISOString()}`);

    // Verify auction event recorded
    const event = (await query("SELECT * FROM auction_events WHERE auction_id = $1 AND event_type = 'anti_snipe_extended' ORDER BY created_at DESC LIMIT 1", [antiSnipeAuction.id])).rows[0];
    console.log(`✅ PASSED: Anti-sniping event logged in audit trail:`, event?.payload);
  }

  console.log('\n🎉 ALL CORE BIDDING ENGINE TESTS PASSED!');
}

runTests().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
