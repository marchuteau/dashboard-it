// Server-side verification of the Okta id_token sent by the SPA as "Authorization: Bearer <token>".
// Without this, every /api/* route was reachable by anyone (auth was UI-only, trivially bypassed with curl).
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const ISSUER = process.env.OKTA_ISSUER;
const AUDIENCE = process.env.OKTA_CLIENT_ID;
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || 'recommerce.com,circularx.com')
    .split(',').map(d => d.trim()).filter(Boolean);
const ADMIN_GROUPS = (process.env.ADMIN_GROUPS || '')
    .split(',').map(g => g.trim()).filter(Boolean);

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

// Verifies the Okta id_token: signature, issuer, audience, expiry, then checks the email domain.
function requireAuth(req, res, next) {
    if (!ISSUER || !AUDIENCE) {
        console.error('[Auth] OKTA_ISSUER / OKTA_CLIENT_ID manquants dans .env');
        return res.status(500).json({ error: 'Authentification non configurée côté serveur' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return res.status(401).json({ error: 'Authentification requise' });
    }

    jwt.verify(token, getSigningKey, { issuer: ISSUER, audience: AUDIENCE, algorithms: ['RS256'] }, (err, payload) => {
        if (err) {
            console.warn('[Auth] Token rejeté:', err.message);
            return res.status(401).json({ error: 'Session invalide ou expirée' });
        }

        const emailDomain = (payload.email || '').split('@')[1];
        if (!emailDomain || !ALLOWED_DOMAINS.includes(emailDomain)) {
            return res.status(403).json({ error: 'Domaine non autorisé' });
        }

        req.user = { email: payload.email, name: payload.name, groups: payload.groups || [] };
        next();
    });
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

module.exports = { requireAuth, requireAdmin };
