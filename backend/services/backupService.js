const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const archiver = require('archiver');
const cron = require('node-cron');

const pool = require('../config/database');

// Emplacement de pg_dump : PG_DUMP_PATH (.env), sinon la version la plus récente installée
// dans C:\Program Files\PostgreSQL (Windows), sinon « pg_dump » du PATH.
function pgDumpExecutable() {
    if (process.env.PG_DUMP_PATH) return process.env.PG_DUMP_PATH;
    if (process.platform === 'win32') {
        const base = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL');
        try {
            const versions = fs.readdirSync(base).filter(v => /^\d+$/.test(v)).sort((a, b) => b - a);
            for (const v of versions) {
                const exe = path.join(base, v, 'bin', 'pg_dump.exe');
                if (fs.existsSync(exe)) return exe;
            }
        } catch (e) { /* PostgreSQL non installé à l'emplacement habituel */ }
    }
    return 'pg_dump';
}

function pgDump(targetFile) {
    return new Promise((resolve, reject) => {
        execFile(pgDumpExecutable(), [
            '--host', process.env.PG_HOST || 'localhost',
            '--port', process.env.PG_PORT || '5433',
            '--username', process.env.PG_USER,
            '--format', 'plain',
            '--no-owner',
            '--file', targetFile,
            process.env.PG_DATABASE || 'softtransit',
        ], { env: { ...process.env, PGPASSWORD: process.env.PG_PASSWORD } }, (err, stdout, stderr) => {
            if (err) return reject(new Error(`pg_dump a échoué : ${stderr || err.message}`));
            resolve();
        });
    });
}

// Le planificateur se réveille toutes les 5 minutes et lance une sauvegarde si la dernière date de plus
// que la fréquence choisie : une sauvegarde manquée parce que le serveur était éteint est rattrapée
// au redémarrage, et toute fréquence (1 à 168 h) est respectée.
const VERIFICATION_CRON = '*/5 * * * *';

class BackupService {
    constructor() {
        this.cronJob = null;
        this.running = false;
        this.lastError = null; // dernier échec (message + date), vidé par une sauvegarde réussie
        this.init();
    }

    async init() {
        try {
            // Check if default config exists
            const [rows] = await pool.query('SELECT * FROM backup_config WHERE id = 1');
            if (rows.length === 0) {
                // Determine a safe fallback directory
                const defaultDir = path.join(__dirname, '../../backups');
                if (!fs.existsSync(defaultDir)) {
                    fs.mkdirSync(defaultDir, { recursive: true });
                }
                await pool.query(
                    'INSERT INTO backup_config (id, backup_directory, auto_backup_enabled, frequency_hours, retain_count) VALUES (?, ?, ?, ?, ?)',
                    [1, defaultDir, false, 6, 10]
                );
            }

            // Schedule job based on config
            await this.reschedule();
        } catch (error) {
            console.error('Error initializing BackupService:', error);
        }
    }

    async getConfig() {
        const [rows] = await pool.query('SELECT * FROM backup_config WHERE id = 1');
        return rows[0];
    }

    async setConfig(data) {
        const { backup_directory, auto_backup_enabled, frequency_hours, retain_count } = data;

        if (!backup_directory || !String(backup_directory).trim()) {
            throw new Error('Le répertoire de sauvegarde est obligatoire.');
        }
        if (!Number.isInteger(frequency_hours) || frequency_hours < 1 || frequency_hours > 168) {
            throw new Error("La fréquence doit être un nombre entier d'heures entre 1 et 168.");
        }
        if (!Number.isInteger(retain_count) || retain_count < 1) {
            throw new Error('Le nombre de sauvegardes à conserver doit être au moins 1.');
        }

        // Validate directory exists or create if possible
        if (backup_directory && !fs.existsSync(backup_directory)) {
            try {
                fs.mkdirSync(backup_directory, { recursive: true });
            } catch(e) {
                throw new Error("Impossible de créer ou d'accéder au répertoire de sauvegarde spécifié.");
            }
        }

        await pool.query(
            'UPDATE backup_config SET backup_directory = ?, auto_backup_enabled = ?, frequency_hours = ?, retain_count = ? WHERE id = 1',
            [backup_directory, auto_backup_enabled ? 1 : 0, frequency_hours, retain_count]
        );

        await this.reschedule();
        return this.getConfig();
    }

    async reschedule() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }

        const config = await this.getConfig();
        if (config && config.auto_backup_enabled && config.frequency_hours > 0) {
            console.log(`[BackupService] Sauvegarde automatique active : toutes les ${config.frequency_hours} h`);
            this.cronJob = cron.schedule(VERIFICATION_CRON, () => this.checkDue());
            this.checkDue(); // rattrapage immédiat (démarrage du serveur, activation, changement de réglage)
        } else {
            console.log('[BackupService] Automatic backups are disabled.');
        }
    }

    /** Lance une sauvegarde si la dernière est plus ancienne que la fréquence configurée. */
    async checkDue() {
        if (this.running) return;
        try {
            const config = await this.getConfig();
            if (!config || !config.auto_backup_enabled) return;
            const history = await this.getBackupHistory();
            const last = history.length ? new Date(history[0].createdAt).getTime() : 0;
            const dueMs = config.frequency_hours * 3600 * 1000;
            if (Date.now() - last >= dueMs - 60 * 1000) {
                console.log('[BackupService] Sauvegarde automatique à effectuer...');
                await this.runBackup();
            }
        } catch (e) {
            console.error('[BackupService] Sauvegarde automatique échouée :', e.message);
        }
    }

    async runBackup() {
        if (this.running) throw new Error('Une sauvegarde est déjà en cours.');
        this.running = true;
        try {
            const result = await this.doBackup();
            this.lastError = null;
            return result;
        } catch (error) {
            this.lastError = { message: error.message, at: new Date().toISOString() };
            throw error;
        } finally {
            this.running = false;
        }
    }

    async doBackup() {
        const config = await this.getConfig();
        const targetDir = config.backup_directory;

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const tempSqlFile = path.join(targetDir, `temp_dump_${timestamp}.sql`);
        const finalZipFile = path.join(targetDir, `softtransit_backup_${timestamp}.zip`);

        try {
            // 1. Dump database
            console.log('[BackupService] Dumping database...');
            await pgDump(tempSqlFile);

            // 2. Create ZIP containing the SQL dump and the uploads folder
            console.log('[BackupService] Archiving files...');
            await new Promise((resolve, reject) => {
                const output = fs.createWriteStream(finalZipFile);
                const archive = archiver('zip', { zlib: { level: 9 } });

                output.on('close', () => resolve());
                archive.on('error', (err) => reject(err));

                archive.pipe(output);

                // Add SQL Dump
                archive.file(tempSqlFile, { name: 'database_dump.sql' });

                // Add Uploads directory (fichiers stockés par utils/storage.js)
                const uploadsPath = path.join(__dirname, '../uploads');
                if (fs.existsSync(uploadsPath)) {
                    archive.directory(uploadsPath, 'uploads');
                }

                archive.finalize();
            });

            console.log('[BackupService] Backup completed:', finalZipFile);

            // 3. Clean up the temp SQL file
            if (fs.existsSync(tempSqlFile)) {
                fs.unlinkSync(tempSqlFile);
            }

            // 4. Enforce retain count Policy
            this.cleanupOldBackups(targetDir, config.retain_count);

            return {
                success: true,
                file: finalZipFile,
                timestamp
            };

        } catch (error) {
            console.error('[BackupService] Backup failed:', error);
            // Cleanup temp file on failure just in case
            if (fs.existsSync(tempSqlFile)) fs.unlinkSync(tempSqlFile);
            throw error;
        }
    }

    cleanupOldBackups(directory, retainCount) {
        if (!retainCount || retainCount <= 0) return;

        try {
            const files = fs.readdirSync(directory);
            const backupFiles = files
                .filter(f => f.startsWith('softtransit_backup_') && f.endsWith('.zip'))
                .map(f => ({
                    name: f,
                    path: path.join(directory, f),
                    time: fs.statSync(path.join(directory, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time); // newest first

            if (backupFiles.length > retainCount) {
                const filesToDelete = backupFiles.slice(retainCount);
                filesToDelete.forEach(file => {
                    console.log(`[BackupService] Deleting old backup: ${file.name}`);
                    fs.unlinkSync(file.path);
                });
            }
        } catch(e) {
            console.error("[BackupService] Cleanup failed:", e);
        }
    }

    getBackupHistory() {
        return new Promise(async (resolve) => {
            try {
                const config = await this.getConfig();
                const directory = config.backup_directory;
                if (!fs.existsSync(directory)) {
                   return resolve([]);
                }
                const files = fs.readdirSync(directory);
                const backupFiles = files
                    .filter(f => f.startsWith('softtransit_backup_') && f.endsWith('.zip'))
                    .map(f => {
                        const stat = fs.statSync(path.join(directory, f));
                        return {
                            filename: f,
                            size: stat.size,
                            createdAt: stat.mtime
                        }
                    })
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                resolve(backupFiles);
            } catch (e) {
                console.error("Erreur read history", e);
                resolve([]);
            }
        });
    }
}

// Export a singleton instance
module.exports = new BackupService();
