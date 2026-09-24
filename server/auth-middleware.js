// The raw Okta id_token is verified ONCE here (server-side, via JWKS) and never handed back to
// the browser. The browser only gets an httpOnly session cookie afterwards (see server.js:/auth/session),
// so client-side JS (and any XSS) has no way to read or exfiltrate the token.
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const ISSUER = process.env.OKTA_ISSUER;
const AUDIENCE = process.env.OKTA_CLIENT_ID;
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || 'recommerce.com,circularx.com')
    .split(',').map(d => d.trim()).filter(Boolean);
const ADMIN_GROUPS = (process.env.ADMIN_GROUPS || '')
    .split(',').map(g => g.trim()).filter(Boolean);
const IT_ADMIN_GROUP = process.env.IT_ADMIN_GROUP || 'Dashboard IT Admin';

const jwks = ISSUER ? jwksClient({
    jwksUri: `${ISSUER}/v1/keys`,
    cache: true,
    cacheMaxAge: 10 * 60 * 1000,
    rateLimit: true,
}) : null;

function getSigningKey(header, callback) {
    jwks.getSigningKey(header.kid, (err, key) => {
        if (err) return callback(err);
        callback(null, key.getPublicKey());
    });
}

// One-time verification of the raw id_token (signature, issuer, audience, expiry, email domain).
// Returns the safe-to-store user info, or throws.
function verifyOktaToken(token) {
    return new Promise((resolve, reject) => {
        if (!ISSUER || !AUDIENCE) {
            return reject(new Error('OKTA_ISSUER / OKTA_CLIENT_ID manquants dans .env'));
        }
        jwt.verify(token, getSigningKey, { issuer: ISSUER, audience: AUDIENCE, algorithms: ['RS256'] }, (err, payload) => {
            if (err) return reject(err);

            const emailDomain = (payload.email || '').split('@')[1];
            if (!emailDomain || !ALLOWED_DOMAINS.includes(emailDomain)) {
                return reject(new Error('Domaine non autorisé'));
            }

            resolve({
                email: payload.email,
                name: payload.name || payload.preferred_username || payload.email,
                groups: Array.isArray(payload.groups) ? payload.groups : [],
                expiresAt: payload.exp * 1000,
            });
        });
    });
}

// Reads the server-side session (set once at /auth/session). No token parsing on every request.
function requireAuth(req, res, next) {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: 'Authentification requise' });
    }
    if (user.expiresAt && Date.now() > user.expiresAt) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: 'Session expirée' });
    }
    req.user = user;
    next();
}

// Must run after requireAuth. Restricts to members of ADMIN_GROUPS (e.g. IT/RH groups).
function requireAdmin(req, res, next) {
    const groups = req.user?.groups || [];
    const isAdmin = ADMIN_GROUPS.length > 0 && groups.some(g => ADMIN_GROUPS.includes(g));
    if (!isAdmin) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
    }
    next();
}

// Must run after requireAuth. Restricts to the IT Admin group only (e.g. licence management).
function requireITAdmin(req, res, next) {
    const groups = req.user?.groups || [];
    if (!groups.includes(IT_ADMIN_GROUP)) {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs IT' });
    }
    next();
}

module.exports = { verifyOktaToken, requireAuth, requireAdmin, requireITAdmin };
