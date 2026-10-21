// Vérifications UI du Sénégal. Prérequis : backend de TEST sur 3104 (base softtransit_senegal_test), agent « testsn ».
// Lancement (depuis un dossier où @playwright/test est installé, ex. e2e-gabon) :
//   NODE_PATH=../e2e-gabon/node_modules npx playwright test -c ../e2e-senegal/playwright.config.js
const { defineConfig, devices } = require('@playwright/test')
const path = require('path')
const WEB = 'http://localhost:5176'
module.exports = defineConfig({
    testDir: path.join(__dirname, 'tests'),
    timeout: 120_000,
    workers: 1,
    reporter: [['list']],
    outputDir: path.join(__dirname, 'resultats'),
    use: { baseURL: WEB, locale: 'fr-FR', actionTimeout: 15_000, ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } },
    webServer: {
        command: 'npm run dev -- --port 5176 --strictPort', cwd: path.join(__dirname, '..', 'frontend'),
        url: WEB, reuseExistingServer: false, timeout: 120_000, env: { VITE_API_URL: 'http://localhost:3104/api' },
    },
})
