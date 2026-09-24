// Shared helper: attaches the Okta id_token (stored at login) to API calls so the
// server can verify the caller's identity/groups (see server/auth-middleware.js).
function getAuthHeaders() {
    try {
        const raw = localStorage.getItem('onboarding_okta_session');
        if (!raw) return {};
        const session = JSON.parse(raw);
        return session.idToken ? { Authorization: 'Bearer ' + session.idToken } : {};
    } catch (e) {
        return {};
    }
}
