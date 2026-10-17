// backend/services/DevisPDFGenerator.js
// Générateur PDF pour les devis (cotations) client - adapté de InvoicePDFGenerator.js
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class DevisPDFGenerator {
    constructor(pool) {
        this.pool = pool;
        this.refSymbol = 'F XAF'; // repli ; écrasé par la devise de référence réelle dans fetchDevisData
    }

    async generatePDF(cotationId) {
        const data = await this.fetchDevisData(cotationId);
        if (!data.devis) throw new Error('Devis introuvable');

        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 30, bottom: 30, left: 40, right: 40 },
            bufferPages: true
        });

        const clientId = data.devis.IDCLIENTS || 'misc';
        const clientNameSafe = (data.devis.ClientName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
        const outputDir = path.join(__dirname, '..', 'uploads', 'clients', `${clientId}_${clientNameSafe}`, 'devis');

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const filename = `devis_${(data.devis.NumeroCotation || 'DRAFT').replace(/\//g, '-')}.pdf`;
        const outputPath = path.join(outputDir, filename);
        const writeStream = fs.createWriteStream(outputPath);
        doc.pipe(writeStream);

        await this.renderTemplate(doc, data);

        doc.end();

        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve(outputPath));
            writeStream.on('error', reject);
        });
    }

    async fetchDevisData(cotationId) {
        const connection = await this.pool.getConnection();
        try {
            const { getReferenceCurrency } = require('./deviseService');
            this.refSymbol = (await getReferenceCurrency()).Symbole;
            const [rows] = await connection.query(
                `SELECT c.*, 
                        d.CodeDossier, d.Libelle as DossierLibelle, d.IDCLIENTS,
                        cl.NomRS as ClientName, cl.adresseClient as ClientAddress, cl.NINEA as ClientNINEA,
                        a.NomAgent as AgentName, a.Tel as AgentTel, a.Cel as AgentCel
                 FROM cotations c
                 LEFT JOIN dossiers d ON c.IDDossiers = d.IDDossiers
                 LEFT JOIN clients cl ON d.IDCLIENTS = cl.IDCLIENTS
                 LEFT JOIN agents a ON c.IdagentSaisie = a.IDAgents
                 WHERE c.IDCotations = ?`,
                [cotationId]
            );

            if (rows.length === 0) return { devis: null };
            const devis = rows[0];

            const [rubriques] = await connection.query(
                'SELECT * FROM liaisoncotationsrubriques WHERE IDCotation = ?',
                [cotationId]
            );

            const [structures] = await connection.query('SELECT * FROM structur LIMIT 1');
            const structure = structures.length > 0 ? structures[0] : null;

            const [devises] = await connection.query("SELECT TauxChangeDeviseCFA FROM devises WHERE Symbole = '€' LIMIT 1");
            const tauxEUR = devises.length > 0 ? parseFloat(devises[0].TauxChangeDeviseCFA) : null;

            return { devis, rubriques, structure, tauxEUR };
        } finally {
            connection.release();
        }
    }

    async renderTemplate(doc, data) {
        const { devis, rubriques, structure, tauxEUR } = data;
        const pageWidth = doc.page.width;
        const marginX = 40;
        const usableWidth = pageWidth - marginX * 2;

        // --- HEADER (logo depuis R2) ---
        if (structure?.cheminlogo) {
            try {
                const { downloadFile } = require('../utils/storage');
                let key = structure.cheminlogo;
                if (key.startsWith('uploads/')) key = key.slice(8);
                const imgBuf = await downloadFile(key);
                doc.image(imgBuf, marginX, 30, { height: 50 });
            } catch (e) { }
        }

        // Titre DEVIS (au lieu de FACTURE)
        doc.fontSize(20).font('Helvetica-Bold').fillColor('#0f4c81');
        doc.text('DEVIS', marginX, 30, { align: 'right' });
        doc.fontSize(12).text(devis.NumeroCotation || 'BROUILLON', marginX, 55, { align: 'right' });

        doc.fontSize(10).font('Helvetica').fillColor('black');
        const dateCot = devis.DateCotation ? new Date(devis.DateCotation) : new Date();
        const dateStr = `${String(dateCot.getDate()).padStart(2, '0')}/${String(dateCot.getMonth() + 1).padStart(2, '0')}/${dateCot.getFullYear()}`;
        doc.text(`Date : ${dateStr}`, marginX, 75, { align: 'right' });

        // Validité du devis
        const dateLimite = new Date(dateCot);
        dateLimite.setDate(dateLimite.getDate() + 30);
        const dateLimStr = `${String(dateLimite.getDate()).padStart(2, '0')}/${String(dateLimite.getMonth() + 1).padStart(2, '0')}/${dateLimite.getFullYear()}`;
        doc.fontSize(8).fillColor('#6b7280').text(`Valable jusqu'au : ${dateLimStr}`, marginX, 85, { align: 'right' });

        // Infos société (gauche)
        doc.moveDown(2);
        const startY = 110;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('black').text(structure?.NomSociete || '', marginX, startY);
        doc.font('Helvetica').fontSize(8).fillColor('#4b5563');
        doc.text(structure?.adrSociete || '', marginX, startY + 15, { width: 250 });
        doc.text(`NINEA : ${structure?.NINEASociete || ''}`, marginX, startY + 35);

        // Zone client (droite)
        const clientBoxX = pageWidth - marginX - 250;
        doc.rect(clientBoxX, startY, 250, 60).stroke('#e5e7eb');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('black').text('DEVIS ÉTABLI POUR :', clientBoxX + 10, startY + 10);
        doc.fontSize(10).text(devis.ClientName || '', clientBoxX + 10, startY + 25);
        doc.fontSize(8).font('Helvetica').text(devis.ClientAddress || '', clientBoxX + 10, startY + 40, { width: 230 });

        // Barre dossier
        doc.moveDown(4);
        const infoY = doc.y;
        doc.rect(marginX, infoY, usableWidth, 25).fill('#f0f9ff').stroke('#bfdbfe');
        doc.fillColor('#1e40af').font('Helvetica-Bold').fontSize(9);
        if (devis.CodeDossier) {
            doc.text(`Dossier : ${devis.CodeDossier}`, marginX + 10, infoY + 8);
        }

        // --- TABLE ---
        doc.moveDown(2);
        const tableTop = doc.y;

        doc.rect(marginX, tableTop, usableWidth, 20).fill('#0f4c81').stroke('#0f4c81');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(9);

        const cols = {
            ref: 60,
            libelle: 250,
            complement: 100,
            montant: usableWidth - 60 - 250 - 100
        };

        let curX = marginX;
        doc.text('Code', curX + 5, tableTop + 6); curX += cols.ref;
        doc.text('Libellé Rubrique', curX + 5, tableTop + 6); curX += cols.libelle;
        doc.text('Complément', curX + 5, tableTop + 6); curX += cols.complement;
        doc.text('Montant HT', curX, tableTop + 6, { width: cols.montant, align: 'right' });

        let rowY = tableTop + 20;
        doc.fillColor('black').font('Helvetica').fontSize(9);

        rubriques.forEach((r, i) => {
            const rowHeight = 20;
            if (rowY + rowHeight > doc.page.height - 150) {
                doc.addPage();
                rowY = 50;
            }
            if (i % 2 === 1) doc.rect(marginX, rowY, usableWidth, rowHeight).fill('#f0f9ff');

            doc.fillColor('black');
            let cx = marginX;
            doc.text(r.CodeRubrique || '', cx + 5, rowY + 6); cx += cols.ref;
            doc.text(r.libelleRubrique || '', cx + 5, rowY + 6); cx += cols.libelle;
            doc.text(r.Complement || '', cx + 5, rowY + 6, { width: cols.complement }); cx += cols.complement;
            doc.text(this.formatCurrency(r.MontantHTCotation || 0), cx, rowY + 6, { width: cols.montant, align: 'right' });

            rowY += rowHeight;
        });

        // Totaux
        doc.moveDown(1);
        const totalX = pageWidth - marginX - 180;

        const drawTotalRow = (label, value, y, isBold = false) => {
            doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
            doc.fillColor('#1e293b');
            doc.text(label, totalX, y);
            doc.text(value, totalX + 80, y, { width: 100, align: 'right' });
        };

        let ty = rowY + 15;
        drawTotalRow('Total HT :', this.formatCurrency(devis.MontantHTCotation), ty); ty += 20;
        drawTotalRow('Total TVA :', this.formatCurrency(devis.MontantTVACotation), ty); ty += 20;
        doc.rect(totalX, ty - 5, 180, 25).fill('#dbeafe');
        doc.fillColor('#1e40af');
        drawTotalRow('TOTAL TTC :', this.formatCurrency(devis.MontantTTCCotation), ty + 5, true);

        // Équivalent EUR — seulement si un taux Euro est configuré dans les devises
        if (tauxEUR) {
            ty += 30;
            const montantEUR = (parseFloat(devis.MontantTTCCotation || 0) / tauxEUR).toFixed(2);
            doc.fillColor('#0f4c81').font('Helvetica-Bold').fontSize(10);
            doc.text(`Soit : ${new Intl.NumberFormat('fr-FR').format(montantEUR)} EUR`, totalX, ty, { width: 180, align: 'right' });
        }

        // Mention légale
        doc.moveDown(3);
        doc.fillColor('black').font('Helvetica-Oblique').fontSize(9);
        doc.text(
            `Arrêté le présent devis à la somme de : ${this.formatCurrency(parseFloat(devis.MontantTTCCotation || 0))} (TTC).`,
            marginX,
            doc.y,
            { width: usableWidth }
        );

        // Conditions
        doc.moveDown(1.5);
        doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
        doc.text('Ce devis est valable 30 jours à compter de sa date d\'émission. Pour acceptation, veuillez retourner ce document signé et revêtu de votre cachet.', marginX, doc.y, { width: usableWidth });

        // Infos agent
        doc.moveDown(2);
        const agentY = doc.y;
        doc.fillColor('black').font('Helvetica-Bold').fontSize(9);
        doc.text('Devis établi par :', marginX, agentY);
        doc.font('Helvetica').fontSize(9);
        doc.text(devis.AgentName || 'N/A', marginX, agentY + 14);
        const agentPhone = devis.AgentTel || devis.AgentCel || 'N/A';
        doc.text(`Tél : ${agentPhone}`, marginX, agentY + 28);

        // Cachet/tampon de la société (Cloudflare R2)
        if (structure?.chemin_cachet_facture) {
            try {
                const { downloadFile } = require('../utils/storage');
                let key = structure.chemin_cachet_facture;
                if (key.startsWith('uploads/')) key = key.slice(8);
                const imgBuffer = await downloadFile(key);
                doc.image(imgBuffer, usableWidth - 100, agentY, { height: 80 });
            } catch (e) { /* cachet absent ou R2 non configuré */ }
        }

        this.addGlobalPageFooter(doc, structure);
    }

    addGlobalPageFooter(doc, structure) {
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            const footerY = doc.page.height - 40;
            doc.fontSize(7).font('Helvetica').fillColor('#9ca3af');
            const footerText = `${structure?.NomSociete} - ${structure?.adrSociete} - Tel: ${structure?.telSociete} - NINEA: ${structure?.NINEASociete}`;
            doc.text(footerText, 0, footerY, { align: 'center', width: doc.page.width });
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('fr-FR').format(parseFloat(amount) || 0).replace(/\s/g, ' ') + ' ' + this.refSymbol;
    }
}

module.exports = DevisPDFGenerator;
