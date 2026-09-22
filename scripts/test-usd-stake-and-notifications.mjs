import Database from 'better-sqlite3';

const db = new Database('./data/streakgrid.db');

async function testUsdStakeAndNotifications() {
  console.log('--- Testing USD Stake & Notifications Integration ---');

  const user = db.prepare('SELECT * FROM users LIMIT 1').get();
  if (!user) {
    console.error('No user found');
    process.exit(1);
  }

  const sessionId = 'test_session_usd_' + Date.now();
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24;
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, user.id, expiresAt);

  const defaultHeaders = {
    Cookie: `streakgrid_session=${sessionId}`,
    Origin: 'http://localhost:4321',
    'Content-Type': 'application/json'
  };

  // 1. Verify GET /app/challenges/new contains currency data & legal modal
  const newPageRes = await fetch('http://localhost:4321/app/challenges/new', {
    headers: { Cookie: `streakgrid_session=${sessionId}` }
  });
  const newPageHtml = await newPageRes.text();
  const hasCurrencyData = newPageHtml.includes('currency-configs-data');
  const hasLegalModal = newPageHtml.includes('stake-legal-modal');
  const hasLegalBox = newPageHtml.includes('stake-legal-box');
  console.log('1. /app/challenges/new renders:', newPageRes.status);
  console.log('   - Has currency-configs-data:', hasCurrencyData);
  console.log('   - Has stake-legal-modal:', hasLegalModal);
  console.log('   - Has stake-legal-box:', hasLegalBox);
  if (!hasCurrencyData || !hasLegalModal || !hasLegalBox) {
    throw new Error('New challenge page missing expected currency or legal modal elements');
  }

  // 2. Create a USD Stake Challenge with $50 natural threshold
  const createRes = await fetch('http://localhost:4321/api/challenges', {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({
      name: '100 Days Global Founder in USD',
      duration: 100,
      activities: [{ name: 'Build Product', icon: 'code' }, { name: 'Post Daily Update', icon: 'share' }],
      challenge_type: 'stake',
      stake_amount: 50,
      stake_currency: 'USD'
    })
  });

  const createData = await createRes.json();
  console.log('2. Created USD Stake Challenge:', createRes.status, 'ID:', createData.challenge?.id);
  console.log('   - Checkout URL:', createData.checkoutUrl);
  if (createRes.status !== 201 || !createData.checkoutUrl) {
    throw new Error(`Failed to create USD stake challenge: ${JSON.stringify(createData)}`);
  }

  const challengeId = createData.challenge.id;

  // 3. Verify Stake Commitment in SQLite
  const commitment = db.prepare('SELECT * FROM stake_commitments WHERE challenge_id = ?').get(challengeId);
  console.log('3. Stored Commitment:', commitment.currency, commitment.amount, 'Status:', commitment.status);
  if (commitment.currency !== 'USD' || commitment.amount !== 50) {
    throw new Error(`Expected USD 50, got ${commitment.currency} ${commitment.amount}`);
  }

  // 4. Confirm Payment
  const confirmRes = await fetch('http://localhost:4321/api/payments/confirm', {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({
      challengeId,
      providerPaymentId: commitment.provider_payment_id
    })
  });
  const confirmData = await confirmRes.json();
  console.log('4. Payment Confirmation:', confirmRes.status, 'Success:', confirmData.success);
  if (!confirmData.success) {
    throw new Error(`Payment confirmation failed: ${JSON.stringify(confirmData)}`);
  }

  // 5. Verify In-App Notification was generated
  const notif = db.prepare('SELECT * FROM notifications WHERE user_id = ? AND challenge_id = ?').get(user.id, challengeId);
  console.log('5. Verified In-App Notification in DB:', notif?.title);
  console.log('   - Message:', notif?.message);
  if (!notif || !notif.message.includes('$50')) {
    throw new Error('Notification not found or stake amount not formatted correctly');
  }

  // 6. Test GET /api/notifications
  const notifsApiRes = await fetch('http://localhost:4321/api/notifications', {
    headers: { Cookie: `streakgrid_session=${sessionId}` }
  });
  const notifsData = await notifsApiRes.json();
  console.log('6. GET /api/notifications status:', notifsApiRes.status, 'Count:', notifsData.notifications?.length);

  // 7. Test POST /api/notifications/mark-read
  const markReadRes = await fetch('http://localhost:4321/api/notifications/mark-read', {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({ notificationId: notif.id })
  });
  const markReadData = await markReadRes.json();
  console.log('7. Mark Read status:', markReadRes.status, 'Success:', markReadData.success);

  // 8. Test Challenge Page with ?staked=true
  const stakedPageRes = await fetch(`http://localhost:4321/app/challenges/${challengeId}?staked=true`, {
    headers: { Cookie: `streakgrid_session=${sessionId}` }
  });
  const stakedPageHtml = await stakedPageRes.text();
  const hasStakedModal = stakedPageHtml.includes('staked-confirmation-modal');
  const hasGoldenRule = stakedPageHtml.includes('The Golden Rule');
  const hasEscrowTag = stakedPageHtml.includes('Ring-Fenced');
  console.log('8. /app/challenges/[id]?staked=true status:', stakedPageRes.status);
  console.log('   - Has staked-confirmation-modal:', hasStakedModal);
  console.log('   - Has The Golden Rule text:', hasGoldenRule);
  console.log('   - Has Ring-Fenced Escrow tag:', hasEscrowTag);
  if (!hasStakedModal || !hasGoldenRule) {
    throw new Error('Challenge view missing post-payment confirmation modal or golden rule');
  }

  console.log('--- ALL INTEGRATION TESTS PASSED! ---');
}

testUsdStakeAndNotifications().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
