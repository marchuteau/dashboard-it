require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sgMail = require('@sendgrid/mail');
const path = require('path');
const { initDb, getDb, saveDb, getMailingLists, addMailingList } = require('./db');
const { requireAuth, requireAdmin } = require('./auth-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// SendGrid config
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Security headers (CSP left disabled for now: the app relies on inline style attributes
// and external font/icon stylesheets; a tightened CSP is a follow-up hardening task)
app.use(helmet({ contentSecurityPolicy: false }));

// Basic abuse protection on the endpoints that send emails / mutate shared data
const submitLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });

// Middleware
app.use(express.json());
app.use('/api', apiLimiter);

// Block access to /server/ directory from the web
app.use('/server', (req, res) => {
    res.status(403).send('Forbidden');
});

app.use(express.static(path.join(__dirname, '..')));

// ===== Mailing lists (SQLite) =====
app.get('/api/mailing-lists', requireAuth, (req, res) => {
    res.json({ groups: getMailingLists() });
});

app.post('/api/mailing-lists', requireAuth, (req, res) => {
    const address = (req.body.address || '').trim();
    if (!address) return res.status(400).json({ error: 'Adresse manquante' });
    addMailingList(address);
    saveDb();
    res.json({ success: true, groups: getMailingLists() });
});

// ===== Submissions API (SQLite) - admin/RH only =====

// Onboarding
app.get('/api/submissions/onboarding', requireAuth, requireAdmin, (req, res) => {
    const db = getDb();
    const rows = db.exec('SELECT * FROM onboarding_submissions ORDER BY submitted_at DESC');
    if (!rows.length) return res.json([]);
    const submissions = rows[0].values.map(([id, data, submitted_at]) => ({
        id, data: JSON.parse(data), submittedAt: submitted_at
    }));
    res.json(submissions);
});

app.get('/api/submissions/onboarding/:id', requireAuth, requireAdmin, (req, res) => {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM onboarding_submissions WHERE id = ?');
    stmt.bind([req.params.id]);
    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return res.json({ id: row.id, data: JSON.parse(row.data), submittedAt: row.submitted_at });
    }
    stmt.free();
    res.status(404).json({ error: 'Not found' });
});

app.delete('/api/submissions/onboarding/:id', requireAuth, requireAdmin, (req, res) => {
    const db = getDb();
    db.run('DELETE FROM onboarding_submissions WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
});

// Material
app.get('/api/submissions/material', requireAuth, requireAdmin, (req, res) => {
    const db = getDb();
    const rows = db.exec('SELECT * FROM material_submissions ORDER BY submitted_at DESC');
    if (!rows.length) return res.json([]);
    const submissions = rows[0].values.map(([id, data, submitted_at]) => ({
        id, ...JSON.parse(data), submittedAt: submitted_at
    }));
    res.json(submissions);
});

app.get('/api/submissions/material/:id', requireAuth, requireAdmin, (req, res) => {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM material_submissions WHERE id = ?');
    stmt.bind([req.params.id]);
    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return res.json({ id: row.id, ...JSON.parse(row.data), submittedAt: row.submitted_at });
    }
    stmt.free();
    res.status(404).json({ error: 'Not found' });
});

app.delete('/api/submissions/material/:id', requireAuth, requireAdmin, (req, res) => {
    const db = getDb();
    db.run('DELETE FROM material_submissions WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
});

// Email endpoint - Onboarding
app.post('/api/send-onboarding', requireAuth, submitLimiter, async (req, res) => {
    console.log('[EMAIL] Requête reçue pour:', req.body.firstname, req.body.lastname);
    try {
        const data = req.body;

        // Save to database
        const db = getDb();
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const submittedAt = new Date().toISOString();
        db.run('INSERT INTO onboarding_submissions (id, data, submitted_at) VALUES (?, ?, ?)', [id, JSON.stringify(data), submittedAt]);

        // Auto-learn any mailing list address the user typed that isn't known yet
        (data.mailingLists || []).forEach(addMailingList);
        saveDb();

        const htmlContent = buildEmailHtml(data);

        const msg = {
            to: process.env.RECIPIENT_EMAIL,
            from: process.env.SENDER_EMAIL,
            subject: `[Onboarding] ${data.firstname} ${data.lastname} — ${data.contractType} — ${data.jobTitle}`,
            html: htmlContent,
        };

        await sgMail.send(msg);
        res.json({ success: true, message: 'Email envoyé avec succès' });
    } catch (error) {
        console.error('SendGrid error:', error.response?.body || error.message);
        res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi de l\'email' });
    }
});

// Email endpoint - Material request
app.post('/api/send-material', requireAuth, submitLimiter, async (req, res) => {
    console.log('[EMAIL] Demande matériel de:', req.body.firstname, req.body.lastname);
    try {
        const data = req.body;

        // Save to database
        const db = getDb();
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const submittedAt = new Date().toISOString();
        db.run('INSERT INTO material_submissions (id, data, submitted_at) VALUES (?, ?, ?)', [id, JSON.stringify(data), submittedAt]);
        saveDb();

        const htmlContent = buildMaterialEmailHtml(data);

        // Send to IT team
        const msgToIT = {
            to: process.env.RECIPIENT_EMAIL,
            from: process.env.SENDER_EMAIL,
            subject: `[Matériel] ${data.firstname} ${data.lastname} — ${data.reason} — ${data.type}`,
            html: htmlContent,
        };

        // Send confirmation to requester
        const msgToRequester = {
            to: data.email,
            from: process.env.SENDER_EMAIL,
            subject: `Votre demande de matériel a été enregistrée`,
            html: htmlContent,
        };

        await sgMail.send(msgToIT);
        await sgMail.send(msgToRequester);
        res.json({ success: true, message: 'Emails envoyés avec succès' });
    } catch (error) {
        console.error('SendGrid error:', error.response?.body || error.message);
        res.status(500).json({ success: false, message: 'Erreur lors de l\'envoi de l\'email' });
    }
});

function buildEmailHtml(data) {
    const escapeHtml = (str) => {
        if (!str) return '-';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Non définie';
        const d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatList = (arr) => {
        if (!arr || arr.length === 0) return 'Aucun';
        return arr.map(item => escapeHtml(item)).join(', ');
    };

    return `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: #1a1a2e; color: white; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 22px;">🚀 Nouvelle demande d'onboarding</h1>
            <p style="margin: 8px 0 0; opacity: 0.8; font-size: 14px;">
                ${escapeHtml(data.firstname)} ${escapeHtml(data.lastname)} — ${escapeHtml(data.contractType)}
            </p>
        </div>

        <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            
            <!-- Informations personnelles -->
            <h2 style="color: #1a1a2e; border-bottom: 2px solid #e8e8ef; padding-bottom: 8px; font-size: 16px;">
                👤 Informations personnelles
            </h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr><td style="padding: 8px 12px; color: #666; width: 200px;">Prénom</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.firstname)}</td></tr>
                <tr style="background: #f8f9fa;"><td style="padding: 8px 12px; color: #666;">Nom</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.lastname)}</td></tr>
                <tr><td style="padding: 8px 12px; color: #666;">Email personnel</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.personalEmail)}</td></tr>
                <tr style="background: #f8f9fa;"><td style="padding: 8px 12px; color: #666;">Email professionnel</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.proEmail)}</td></tr>
                <tr><td style="padding: 8px 12px; color: #666;">Date d'arrivée</td><td style="padding: 8px 12px; font-weight: 500;">${formatDate(data.startDate)}</td></tr>
                <tr style="background: #f8f9fa;"><td style="padding: 8px 12px; color: #666;">Date de fin</td><td style="padding: 8px 12px; font-weight: 500;">${formatDate(data.endDate)}</td></tr>
            </table>

            <!-- Contrat & Poste -->
            <h2 style="color: #1a1a2e; border-bottom: 2px solid #e8e8ef; padding-bottom: 8px; font-size: 16px;">
                📋 Contrat & Poste
            </h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr><td style="padding: 8px 12px; color: #666; width: 200px;">Type de contrat</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.contractType)}</td></tr>
                <tr style="background: #f8f9fa;"><td style="padding: 8px 12px; color: #666;">Métier</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.jobTitle)}</td></tr>
                <tr><td style="padding: 8px 12px; color: #666;">Lieu de travail</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.workplace)}</td></tr>
            </table>

            <!-- Matériel -->
            <h2 style="color: #1a1a2e; border-bottom: 2px solid #e8e8ef; padding-bottom: 8px; font-size: 16px;">
                💻 Matériel
            </h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr><td style="padding: 8px 12px; color: #666; width: 200px;">Laptop</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.laptopNeeded)}</td></tr>
                ${data.laptopNeeded === 'Oui' ? `
                <tr style="background: #f8f9fa;"><td style="padding: 8px 12px; color: #666;">Profil laptop</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.laptopProfile)}</td></tr>
                <tr><td style="padding: 8px 12px; color: #666;">OS</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.laptopOs)}</td></tr>
                ` : ''}
                <tr style="background: #f8f9fa;"><td style="padding: 8px 12px; color: #666;">Casque</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.headsetNeeded)}</td></tr>
                <tr><td style="padding: 8px 12px; color: #666;">Matériel bureau</td><td style="padding: 8px 12px; font-weight: 500;">${formatList(data.deskMaterial)}</td></tr>
            </table>

            <!-- Applications -->
            <h2 style="color: #1a1a2e; border-bottom: 2px solid #e8e8ef; padding-bottom: 8px; font-size: 16px;">
                📱 Applications
            </h2>
            <div style="margin-bottom: 24px; padding: 12px;">
                ${[
                    { label: 'Finance', apps: data.appsFinance },
                    { label: 'Achats', apps: data.appsAchats },
                    { label: 'Ventes', apps: data.appsVentes },
                    { label: 'Pricing', apps: data.appsPricing },
                    { label: 'DSI', apps: data.appsDsi },
                    { label: 'Transverses', apps: data.appsTransverses },
                ].filter(g => g.apps && g.apps.length > 0)
                 .map(g => `<p style="margin: 4px 0;"><strong>${escapeHtml(g.label)} :</strong> ${formatList(g.apps)}</p>`)
                 .join('') || '<p style="color: #999;">Aucune application sélectionnée</p>'}
                ${data.tableauEmail ? `<p style="margin: 4px 0;"><strong>Email Tableau :</strong> ${escapeHtml(data.tableauEmail)}</p>` : ''}
            </div>

            <!-- Backoffice & Mailing -->
            <h2 style="color: #1a1a2e; border-bottom: 2px solid #e8e8ef; padding-bottom: 8px; font-size: 16px;">
                🔧 Backoffice & Mailing
            </h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr><td style="padding: 8px 12px; color: #666; width: 200px;">Accès Backoffice</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.backofficeNeeded)}</td></tr>
                ${data.backofficeNeeded === 'Oui' ? `
                <tr style="background: #f8f9fa;"><td style="padding: 8px 12px; color: #666;">Profil référent</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.backofficeProfile)}</td></tr>
                ` : ''}
                <tr><td style="padding: 8px 12px; color: #666;">Mailing list</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.mailingNeeded)}</td></tr>
                ${data.mailingNeeded === 'Oui' ? `
                <tr style="background: #f8f9fa;"><td style="padding: 8px 12px; color: #666;">Adresses</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.mailingLists)}</td></tr>
                ` : ''}
            </table>

            <div style="margin-top: 24px; padding: 16px; background: #e8f5e9; border-radius: 8px; text-align: center; color: #2e7d32; font-size: 14px;">
                ✅ Ce formulaire a été soumis via l'application Onboarding RS
            </div>
        </div>
    </div>
    `;
}

function buildMaterialEmailHtml(data) {
    const escapeHtml = (str) => {
        if (!str) return '-';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };

    const formatList = (arr) => {
        if (!arr || arr.length === 0) return 'Aucun';
        return arr.map(item => escapeHtml(item)).join(', ');
    };

    return `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
        <div style="background: #1a1a2e; color: white; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="margin: 0; font-size: 22px;">🖥️ Demande de matériel</h1>
            <p style="margin: 8px 0 0; opacity: 0.8; font-size: 14px;">
                ${escapeHtml(data.firstname)} ${escapeHtml(data.lastname)} — ${escapeHtml(data.type)}
            </p>
        </div>

        <div style="background: white; padding: 32px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

            <h2 style="color: #1a1a2e; border-bottom: 2px solid #e8e8ef; padding-bottom: 8px; font-size: 16px;">
                👤 Demandeur
            </h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr><td style="padding: 8px 12px; color: #666; width: 200px;">Prénom</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.firstname)}</td></tr>
                <tr style="background: #f8f9fa;"><td style="padding: 8px 12px; color: #666;">Nom</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.lastname)}</td></tr>
                <tr><td style="padding: 8px 12px; color: #666;">Email</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.email)}</td></tr>
            </table>

            <h2 style="color: #1a1a2e; border-bottom: 2px solid #e8e8ef; padding-bottom: 8px; font-size: 16px;">
                📋 Détails de la demande
            </h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <tr><td style="padding: 8px 12px; color: #666; width: 200px;">Lieu d'utilisation</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.type)}</td></tr>
                <tr style="background: #f8f9fa;"><td style="padding: 8px 12px; color: #666;">Raison</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.reason)}</td></tr>
                <tr><td style="padding: 8px 12px; color: #666;">Matériel demandé</td><td style="padding: 8px 12px; font-weight: 500;">${formatList(data.items)}</td></tr>
                ${data.comment ? `<tr style="background: #f8f9fa;"><td style="padding: 8px 12px; color: #666;">Commentaire</td><td style="padding: 8px 12px; font-weight: 500;">${escapeHtml(data.comment)}</td></tr>` : ''}
            </table>

            <div style="margin-top: 24px; padding: 16px; background: #e8f5e9; border-radius: 8px; text-align: center; color: #2e7d32; font-size: 14px;">
                ✅ Cette demande a été soumise via l'application Onboarding RS
            </div>
        </div>
    </div>
    `;
}

app.listen(PORT, async () => {
    await initDb();
    console.log(`✅ Serveur onboarding démarré sur http://localhost:${PORT}`);
    console.log(`📁 Base de données: server/data/onboarding.db`);
});
