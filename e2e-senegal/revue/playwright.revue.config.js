// Revue visuelle de l'interface (captures d'écran) — dev uniquement. Prérequis : backend de TEST sur 3104, agent « testsn ».
const { defineConfig, devices } = require('@playwright/test')
const path = require('path')
const WEB = 'http://localhost:5176'
module.exports = defineConfig({
    testDir: __dirname, testMatch: /.*\.revue\.js$/, timeout: 240_000, workers: 1, reporter: [['list']],
    outputDir: path.join(__dirname, 'resultats'),
    use: { baseURL: WEB, locale: 'fr-FR', actionTimeout: 15_000, ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    webServer: { command: 'npm run dev -- --port 5176 --strictPort', cwd: path.join(__dirname, '..', '..', 'frontend'), url: WEB, reuseExistingServer: true, timeout: 120_000,
        env: { VITE_API_URL: 'http://localhost:3104/api', VITE_PORTAIL_CLIENT: 'true' } },
})
