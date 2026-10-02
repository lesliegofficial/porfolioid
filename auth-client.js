// The legacy profile cache is display data only. API authorization uses Auth tokens.
window.PorfolioAuth = (() => {
  const rawFetch = window.fetch.bind(window);
  const key = 'porfolioid_auth';
  let refreshing;
  function read() { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
  function store(session) {
    localStorage.setItem(key, JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token,
      expires_at: session.expires_at || Math.floor(Date.now() / 1000) + session.expires_in }));
  }
  function clear() { localStorage.removeItem(key); localStorage.removeItem('porfolioid_session'); }
  async function token() {
    let session = read();
    if (!session?.access_token) throw new Error('Sign in required');
    if (session.expires_at <= Date.now() / 1000 + 60) {
      if (!refreshing) refreshing = (async () => {
        const response = await rawFetch('/api/epk', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'refreshSession', refreshToken: session.refresh_token }) });
        const result = await response.json();
        if (!response.ok || !result.session) { clear(); throw new Error('Sign in required'); }
        store(result.session);
      })().finally(() => { refreshing = null; });
      await refreshing;
      session = read();
    }
    return session.access_token;
  }
  async function authenticatedFetch(input, init = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
    // Never send Auth tokens to presigned uploads, CDNs, or third parties.
    if (url.origin !== location.origin || !/^\/(api\/|\.netlify\/functions\/)/.test(url.pathname)) return rawFetch(input, init);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    headers.set('Authorization', `Bearer ${await token()}`);
    const response = await rawFetch(input, { ...init, headers });
    if (response.status === 401) { clear(); location.replace('/login.html'); throw new Error('Sign in required'); }
    return response;
  }
  async function requireSession() {
    try {
      const response = await authenticatedFetch('/api/epk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'session' }) });
      const result = await response.json();
      if (!response.ok || !result.user) throw new Error('Unable to verify account');
      const user = result.user;
      const display = { slug: user.slug, email: user.email, name: `${user.firstName} ${user.lastName}`.trim(), ts: Date.now() };
      localStorage.setItem('porfolioid_session', JSON.stringify(display));
      document.documentElement.removeAttribute('data-auth-pending');
      return display;
    } catch { location.replace('/login.html'); return null; }
  }
  async function signOut() {
    try {
      const response = await authenticatedFetch('/api/epk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
      if (!response.ok) throw new Error('Sign out failed');
    } finally { clear(); location.replace('/login.html'); }
  }
  return { store, requireSession, fetch: authenticatedFetch, signOut };
})();
