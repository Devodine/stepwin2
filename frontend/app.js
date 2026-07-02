const API_BASE = 'https://stepwin-api.onrender.com/api';

let token = null;
let currentUser = null;
let currentChallengeId = null;

// ---------- api helper ----------

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// ---------- odometer ----------

function animateOdometer(target) {
  const el = document.getElementById('odometer');
  const digits = [...el.querySelectorAll('span')];
  const str = String(target).padStart(digits.length, '0').slice(-digits.length);
  digits.forEach((d, i) => { d.textContent = str[i]; });
}

// ---------- auth UI ----------

function renderAuthArea() {
  const area = document.getElementById('auth-area');
  const authPanel = document.getElementById('auth-panel');
  if (currentUser) {
    area.innerHTML = `<span>Hi, ${currentUser.name}</span> &nbsp; <button id="logout-btn">Log out</button>`;
    document.getElementById('logout-btn').onclick = () => {
      token = null; currentUser = null;
      renderAuthArea();
    };
    authPanel.classList.add('hidden');
  } else {
    area.innerHTML = '';
    authPanel.classList.remove('hidden');
  }
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const isLogin = tab.dataset.tab === 'login';
    document.getElementById('login-form').classList.toggle('hidden', !isLogin);
    document.getElementById('signup-form').classList.toggle('hidden', isLogin);
  });
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('login-msg');
  const form = new FormData(e.target);
  try {
    const data = await api('/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    });
    token = data.token; currentUser = data.user;
    msg.textContent = '';
    renderAuthArea();
  } catch (err) {
    msg.textContent = err.message;
  }
});

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('signup-msg');
  const form = new FormData(e.target);
  try {
    const data = await api('/signup', {
      method: 'POST',
      body: JSON.stringify({
        name: form.get('name'), email: form.get('email'), password: form.get('password'),
      }),
    });
    token = data.token; currentUser = data.user;
    msg.textContent = '';
    renderAuthArea();
  } catch (err) {
    msg.textContent = err.message;
  }
});

// ---------- challenge list ----------

async function loadChallenges() {
  const challenges = await api('/challenges');
  const list = document.getElementById('challenge-list');
  list.innerHTML = challenges.map((c) => `
    <div class="challenge-card" data-id="${c.id}">
      <h3>${c.title}</h3>
      <p>${c.description}</p>
      <div class="card-meta">
        <span>₹${c.entryFee} entry</span>
        <span>₹${c.prizePool} pool</span>
        <span>${c.participantCount} challengers</span>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.challenge-card').forEach((card) => {
    card.addEventListener('click', () => openChallenge(card.dataset.id));
  });

  const totalSteps = challenges.reduce((sum, c) => sum + (c.prizePool / c.entryFee > 0 ? 0 : 0), 0);
  // Odometer shows total steps once we have detail data; seed with 0 for now.
  animateOdometer(totalSteps);
}

// ---------- challenge detail ----------

async function openChallenge(id) {
  currentChallengeId = id;
  const c = await api(`/challenges/${id}`);
  document.getElementById('challenges-panel').classList.add('hidden');
  document.getElementById('detail-panel').classList.remove('hidden');
  document.getElementById('detail-title').textContent = c.title;
  document.getElementById('detail-desc').textContent = c.description;
  document.getElementById('detail-fee').textContent = c.entryFee;
  document.getElementById('detail-pool').textContent = c.prizePool;
  document.getElementById('detail-count').textContent = c.participantCount;
  renderLeaderboard(c.leaderboard);

  const totalSteps = c.leaderboard.reduce((sum, row) => sum + row.totalSteps, 0);
  animateOdometer(totalSteps);

  const alreadyJoined = currentUser && c.leaderboard.some((row) => row.userId === currentUser.id);
  renderJoinArea(c, alreadyJoined);
  document.getElementById('steps-area').classList.toggle('hidden', !alreadyJoined);
}

function renderJoinArea(c, alreadyJoined) {
  const area = document.getElementById('join-area');
  if (!currentUser) {
    area.innerHTML = `<p class="muted">Log in or sign up above to join this challenge.</p>`;
    return;
  }
  if (alreadyJoined) {
    area.innerHTML = `<p class="muted">You're in this challenge — good luck!</p>`;
    return;
  }
  area.innerHTML = `<button class="join-btn" id="join-btn">Pay ₹${c.entryFee} & join</button><p class="form-msg" id="join-msg"></p>`;
  document.getElementById('join-btn').addEventListener('click', () => joinChallenge(c.id));
}

async function joinChallenge(id) {
  const msg = document.getElementById('join-msg');
  try {
    // 1. Create a real Razorpay order on the backend.
    const order = await api(`/challenges/${id}/join/create-order`, { method: 'POST' });

    // 2. Open Razorpay's Checkout widget with that order. The user pays
    //    with real money here (UPI/card/etc via Razorpay's UI).
    const rzp = new Razorpay({
      key: order.razorpayKeyId,
      order_id: order.orderId,
      amount: order.amount * 100,
      currency: order.currency,
      name: 'StepWin',
      description: 'Challenge entry fee',
      handler: async function (response) {
        // 3. Send Razorpay's signed response to the backend for verification.
        //    The backend checks the signature before crediting the join —
        //    the join is never trusted on the frontend's say-so alone.
        try {
          await api(`/challenges/${id}/join/verify`, {
            method: 'POST',
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          msg.textContent = "Payment verified — you're in! Log your steps below.";
          openChallenge(id);
        } catch (err) {
          msg.textContent = `Payment succeeded but verification failed: ${err.message}. Contact support.`;
        }
      },
      modal: {
        ondismiss: function () {
          msg.textContent = 'Payment cancelled.';
        },
      },
      theme: { color: '#FF7A33' },
    });
    rzp.open();
  } catch (err) {
    msg.textContent = err.message;
  }
}

function renderLeaderboard(rows) {
  const tbody = document.querySelector('#leaderboard-table tbody');
  tbody.innerHTML = rows.length
    ? rows.map((r) => `<tr><td>${r.rank}</td><td>${r.name}</td><td>${r.totalSteps.toLocaleString()}</td></tr>`).join('')
    : `<tr><td colspan="3" class="muted">No steps logged yet — be the first.</td></tr>`;
}

document.getElementById('back-to-list').addEventListener('click', () => {
  document.getElementById('detail-panel').classList.add('hidden');
  document.getElementById('challenges-panel').classList.remove('hidden');
  loadChallenges();
});

document.getElementById('steps-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('steps-msg');
  const form = new FormData(e.target);
  try {
    const data = await api(`/challenges/${currentChallengeId}/steps`, {
      method: 'POST',
      body: JSON.stringify({ date: form.get('date'), count: Number(form.get('count')) }),
    });
    msg.textContent = `Logged! Your total: ${data.totalSteps.toLocaleString()} steps.`;
    renderLeaderboard(data.leaderboard);
    animateOdometer(data.leaderboard.reduce((sum, row) => sum + row.totalSteps, 0));
  } catch (err) {
    msg.textContent = err.message;
  }
});

// ---------- init ----------

renderAuthArea();
loadChallenges();
