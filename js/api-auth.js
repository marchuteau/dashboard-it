// Shared fetch helper for /api/* calls. Auth is carried by an httpOnly session cookie set by
// the server after Okta login (see server/server.js:/auth/session) - the browser attaches it
// automatically on same-origin requests, no token handling needed here. On 401 (missing/expired
// session) we reload so okta-sso.js re-checks /auth/me and shows the login gate again.
async function apiFetch(url, options = {}) {
    const res = await fetch(url, { ...options, credentials: 'same-origin' });
    if (res.status === 401) {
        window.location.reload();
    }
    return res;
}
