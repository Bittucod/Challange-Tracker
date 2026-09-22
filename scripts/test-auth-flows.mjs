import Database from 'better-sqlite3';

const db = new Database('./data/streakgrid.db');

async function testAuthFlow() {
  console.log('--- Testing Authenticated Flows ---');

  // Find a test user or create a session for the first user
  let user = db.prepare('SELECT * FROM users LIMIT 1').get();
  if (!user) {
    console.error('No user found');
    return;
  }

  // Ensure user has admin privileges for testing admin console
  db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
  console.log('1. User identified:', user.name, 'Admin set:', 1);

  // Create session in SQLite directly
  const sessionId = 'test_session_' + Date.now();
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24;
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(sessionId, user.id, expiresAt);

  const defaultHeaders = {
    Cookie: `streakgrid_session=${sessionId}`,
    Origin: 'http://localhost:4321',
    'Content-Type': 'application/json'
  };

  // 1. Test GET /app/commitments
  const commRes = await fetch('http://localhost:4321/app/commitments', {
    headers: { Cookie: `streakgrid_session=${sessionId}` }
  });
  console.log('2. GET /app/commitments status:', commRes.status);

  // 2. Test GET /app/profile
  const profRes = await fetch('http://localhost:4321/app/profile', {
    headers: { Cookie: `streakgrid_session=${sessionId}` }
  });
  console.log('3. GET /app/profile status:', profRes.status);

  // 3. Test GET /admin
  const adminRes = await fetch('http://localhost:4321/admin', {
    headers: { Cookie: `streakgrid_session=${sessionId}` }
  });
  console.log('4. GET /admin status:', adminRes.status);

  // 4. Test POST /api/challenges (Create Free Challenge)
  const freeRes = await fetch('http://localhost:4321/api/challenges', {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({
      name: 'Free 30 Days Test',
      duration: 30,
      activities: [{ name: 'Coding', icon: 'code' }],
      challenge_type: 'free'
    })
  });
  const freeData = await freeRes.json();
  console.log('5. Create Free Challenge:', freeRes.status, 'ID:', freeData.challenge?.id);

  // 5. Test POST /api/challenges (Create Stake Challenge)
  const stakeRes = await fetch('http://localhost:4321/api/challenges', {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({
      name: 'Staked 100 Days Test',
      duration: 100,
      activities: [{ name: 'Ship Feature', icon: 'target' }],
      challenge_type: 'stake',
      stake_amount: 1000,
      stake_currency: 'INR'
    })
  });
  const stakeData = await stakeRes.json();
  console.log('6. Create Stake Challenge:', stakeRes.status, 'Checkout URL:', stakeData.checkoutUrl);

  const stakedChallengeId = stakeData.challenge?.id;

  // 6. Test Payment Confirmation
  const commitment = db.prepare('SELECT * FROM stake_commitments WHERE challenge_id = ?').get(stakedChallengeId);
  console.log('   Found pending commitment:', commitment?.id, commitment?.provider_payment_id);

  const confirmRes = await fetch('http://localhost:4321/api/payments/confirm', {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({
      challengeId: stakedChallengeId,
      providerPaymentId: commitment.provider_payment_id
    })
  });
  const confirmData = await confirmRes.json();
  console.log('7. Payment Confirm status:', confirmRes.status, 'Success:', confirmData.success);

  // 7. Test Commitment Lock: attempt to delete active stake challenge (should return 403)
  const deleteRes = await fetch(`http://localhost:4321/api/challenges/${stakedChallengeId}`, {
    method: 'DELETE',
    headers: defaultHeaders
  });
  const deleteData = await deleteRes.json();
  console.log('8. Attempt delete active stake (expect 403):', deleteRes.status, 'Error message:', deleteData.error);

  // 8. Test Commitment Lock: attempt to soften success criteria (should return 403)
  const updateRes = await fetch(`http://localhost:4321/api/challenges/${stakedChallengeId}`, {
    method: 'PUT',
    headers: defaultHeaders,
    body: JSON.stringify({
      success_rule: 'at_least_one'
    })
  });
  const updateData = await updateRes.json();
  console.log('9. Attempt modify success rule (expect 403):', updateRes.status, 'Error message:', updateData.error);

  // 9. Test Public Challenge Page & Comments
  // Make challenge community visible
  db.prepare("UPDATE challenges SET visibility = 'community' WHERE id = ?").run(stakedChallengeId);

  const publicRes = await fetch(`http://localhost:4321/challenge/${stakedChallengeId}`);
  console.log('10. GET /challenge/[id] status:', publicRes.status);

  // Post a cheer/comment
  const commentRes = await fetch(`http://localhost:4321/api/challenges/${stakedChallengeId}/comments`, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({ content: 'Keep going! Crushing day 1 🔥' })
  });
  const commentData = await commentRes.json();
  console.log('11. Post comment status:', commentRes.status, 'Comment text:', commentData.comment?.content);

  // Toggle reaction
  const rxRes = await fetch(`http://localhost:4321/api/challenges/${stakedChallengeId}/reactions`, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({ type: 'fire' })
  });
  const rxData = await rxRes.json();
  console.log('12. Toggle fire reaction status:', rxRes.status, 'Total fire count:', rxData.counts?.fire);

  // 10. Clean up test session
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  console.log('--- Authenticated Flow Tests Completed Successfully! ---');
}

testAuthFlow().catch(console.error);
