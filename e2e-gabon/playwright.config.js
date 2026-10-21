const { defineConfig, devices } = require('@playwright/test')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const API_PORT = 3101
const WEB_PORT = 5174 // dans l'allowlist CORS du backend
const WEB_URL = `http://localhost:${WEB_PORT}`
const API_URL = `http://localhost:${API_PORT}/api`

module.exports = defineConfig({
    testDir: './tests',
    timeout: 45_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'report' }]],
    outputDir: 'test-results',
    use: {
        baseURL: WEB_URL,
        locale: 'fr-FR',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    metadata: { apiUrl: API_URL },
    projects: [
        { name: 'setup', testMatch: /auth\.setup\.js/ },
        { name: 'chromium', testIgnore: /auth\.setup\.js/, dependencies: ['setup'], use: { ...devices['Desktop Chrome'] } },
    ],
    // Backend et frontend de test, branchés sur la base softtransit_senegal_e2e (jamais la base de développement).
    webServer: [
        {
            command: 'node server.js',
            cwd: path.join(__dirname, '..', 'backend'),
            url: `http://localhost:${API_PORT}/api/health`,
            reuseExistingServer: false,
            timeout: 60_000,
            env: {
                PORT: String(API_PORT),
                PG_DATABASE: 'softtransit_senegal_e2e',
                FRONTEND_URL: WEB_URL,
                NODE_ENV: 'test',
                PORTAIL_CLIENT_ENABLED: 'true', // option testée par tests/13-portail-client.spec.js
                DISABLE_RATE_LIMIT: 'true', // les limites (5 inscriptions ou réinitialisations par heure) sont partagées par toute la suite
                // aucun envoi d'e-mail réel pendant les tests
                SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', BREVO_API_KEY: '',
            },
        },
        {
            command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
            cwd: path.join(__dirname, '..', 'frontend'),
            url: WEB_URL,
            reuseExistingServer: false,
            timeout: 120_000,
            env: { VITE_API_URL: API_URL, VITE_PORTAIL_CLIENT: 'true' }, // portail client (option) testé par 13 et 14
        },
    ],
})
