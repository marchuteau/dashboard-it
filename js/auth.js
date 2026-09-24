/**
 * Onboarding submissions - thin wrapper around the server API (server/server.js).
 * No client-side storage: if the API call fails, callers surface an error instead
 * of silently falling back to a stale local copy of personal data.
 */

// Gestion des soumissions
const Submissions = (() => {
    async function getAll() {
        const res = await apiFetch('/api/submissions/onboarding');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    }

    async function remove(id) {
        await apiFetch(`/api/submissions/onboarding/${id}`, { method: 'DELETE' });
    }

    async function getById(id) {
        const res = await apiFetch(`/api/submissions/onboarding/${id}`);
        if (!res.ok) return null;
        return await res.json();
    }

    return { getAll, remove, getById };
})();
