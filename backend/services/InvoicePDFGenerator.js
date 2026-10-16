const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class InvoicePDFGenerator {
    constructor(pool) {
        this.pool = pool;
        this.refSymbol = 'FC'; // repli ; écrasé par la devise de référence réelle dans fetchInvoiceData
    }

    async generatePDF(invoiceId) {
        // 1. Fetch all required data
        const data = await this.fetchInvoiceData(invoiceId);
        if (!data.invoice) throw new Error('Invoice not found');

        // 2. Create PDF (A4 Portrait)
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 30, bottom: 30, left: 40, right: 40 },
            bufferPages: true
        });

        // 3. Setup output file dynamically based on client
        const clientId = data.invoice.IDCLIENTS || 'misc';
        const clientNameSafe = (data.invoice.ClientName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
        const dynamicOutputDir = path.join(__dirname, '..', 'uploads', 'clients', `${clientId}_${clientNameSafe}`, 'factures');

        if (!fs.existsSync(dynamicOutputDir)) {
            fs.mkdirSync(dynamicOutputDir, { recursive: true });
        }

        const filename = `facture_${data.invoice.NumeroFacture.replace(/\//g, '-')}.pdf`;
        const outputPath = path.join(dynamicOutputDir, filename);
        const writeStream = fs.createWriteStream(outputPath);
        doc.pipe(writeStream);

        // 4. Build PDF content
        await this.renderTemplate(doc, data);

        // 5. Finalize
        doc.end();

        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve(outputPath));
            writeStream.on('error', reject);
        });
    }

    async fetchInvoiceData(invoiceId) {
        const connection = await this.pool.getConnection();
        try {
            const { getReferenceCurrency } = require('./deviseService');
            this.refSymbol = (await getReferenceCurrency()).Symbole;
            // Invoice & Dossier & Client
            const [invoices] = await connection.query(
                `SELECT f.*, d.CodeDossier, d.Libelle as DossierLibelle, d.NatureDossier, d.IDCLIENTS,
                        c.NomRS as ClientName, c.adresseClient as ClientAddress, c.NINEA as ClientNINEA, c.EmailClient as EmailClient,
                        bl.NumeroTitreTransport as bl_number,
                        ot.PROVENANCE as provenance,
                        a.NomAgent as AgentName, a.Tel as AgentTel, a.Cel as AgentCel
                 FROM factures f
                 LEFT JOIN dossiers d ON f.IDDossiers = d.IDDossiers
                 LEFT JOIN clients c ON d.IDCLIENTS = c.IDCLIENTS
                 LEFT JOIN billoflading bl ON d.IDDossiers = bl.idbl
                 LEFT JOIN ordrestransit ot ON d.IDDossiers = ot.IDDossiers
                 LEFT JOIN agents a ON f.IDAgents = a.IDAgents
                 WHERE f.IDFactures = ?`,
                [invoiceId]
            );

            if (invoices.length === 0) return { invoice: null };
            const invoice = invoices[0];

            // Rubriques
            const [rubriques] = await connection.query(
                'SELECT * FROM liaisonfacturesrubriques WHERE IDFactures = ?',
                [invoiceId]
            );

            // Structure
            const [structures] = await connection.query('SELECT * FROM structur LIMIT 1');
            const structure = structures.length > 0 ? structures[0] : null;

            // Exchange rate EUR
            const [devises] = await connection.query("SELECT TauxChangeDeviseCFA FROM devises WHERE Symbole = '€' LIMIT 1");
            const tauxEUR = devises.length > 0 ? parseFloat(devises[0].TauxChangeDeviseCFA) : null;

            return { invoice, rubriques, structure, tauxEUR };
        } finally {
            connection.release();
        }
    }

    async renderTemplate(doc, data) {
        const { invoice, rubriques, structure, tauxEUR } = data;
        const pageWidth = doc.page.width;
        const marginX = 40;
        const usableWidth = pageWidth - (marginX * 2);

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

        doc.fontSize(20).font('Helvetica-Bold').fillColor('#1e3a8a');
        doc.text('FACTURE', marginX, 30, { align: 'right' });
        doc.fontSize(12).text(invoice.NumeroFacture, marginX, 55, { align: 'right' });

        doc.fontSize(10).font('Helvetica').fillColor('black');
        const dateFacture = invoice.DateFacture ? new Date(invoice.DateFacture) : new Date();
        const dateStr = `${String(dateFacture.getDate()).padStart(2, '0')}/${String(dateFacture.getMonth() + 1).padStart(2, '0')}/${dateFacture.getFullYear()}`;
        doc.text(`Date: ${dateStr}`, marginX, 75, { align: 'right' });

        // Échéance — stockée en DB ou calculée en fallback
        let dateEch;
        if (invoice.DateEcheance) {
            dateEch = new Date(invoice.DateEcheance);
        } else {
            const isDouane = String(invoice.NumeroFacture || '').startsWith('FD');
            const delai = isDouane ? 15 : 30;
            dateEch = new Date(dateFacture);
            dateEch.setDate(dateEch.getDate() + delai);
        }
        const dateEchStr = `${String(dateEch.getDate()).padStart(2, '0')}/${String(dateEch.getMonth() + 1).padStart(2, '0')}/${dateEch.getFullYear()}`;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#b91c1c');
        doc.text(`Échéance : ${dateEchStr}`, marginX, 92, { align: 'right' });

        // Company Details (Left)
        doc.fillColor('black');
        const startY = 115;
        doc.fontSize(10).font('Helvetica-Bold').text(structure?.NomSociete || '', marginX, startY);
        doc.font('Helvetica').fontSize(8).fillColor('#4b5563');
        doc.text(structure?.adrSociete || '', marginX, startY + 15, { width: 250 });
        doc.text(`NINEA: ${structure?.NINEASociete || ''}`, marginX, startY + 35);

        // Client Details (Right Box)
        const clientBoxX = pageWidth - marginX - 250;
        doc.rect(clientBoxX, startY, 250, 60).stroke('#e5e7eb');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('black').text('FACTURÉ À :', clientBoxX + 10, startY + 10);
        doc.fontSize(10).text(invoice.ClientName || '', clientBoxX + 10, startY + 25);
        doc.fontSize(8).font('Helvetica').text(invoice.ClientAddress || '', clientBoxX + 10, startY + 40, { width: 230 });

        // Dossier Info Bar
        doc.moveDown(4);
        const infoY = doc.y;
        doc.rect(marginX, infoY, usableWidth, 25).fill('#f9fafb').stroke('#e5e7eb');
        doc.fillColor('black').font('Helvetica-Bold').fontSize(9);
        doc.text(`Dossier: ${invoice.CodeDossier}`, marginX + 10, infoY + 8);
        doc.text(`BL: ${invoice.bl_number || 'N/A'}`, marginX + 150, infoY + 8);
        doc.text(`Provenance: ${invoice.provenance || 'N/A'}`, marginX + usableWidth - 150, infoY + 8, { align: 'right', width: 140 });

        // --- TABLE ---
        doc.moveDown(2);
        const tableTop = doc.y;

        // Table Header
        doc.rect(marginX, tableTop, usableWidth, 20).fill('#1e3a8a').stroke('#1e3a8a');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(9);

        const cols = {
            ref:     60,
            libelle: usableWidth - 60 - 100,   // absorbe l'ancienne colonne complément
            montant: 100,
        };

        let curX = marginX;
        doc.text('Code', curX + 5, tableTop + 6); curX += cols.ref;
        doc.text('Libellé Rubrique', curX + 5, tableTop + 6); curX += cols.libelle;
        doc.text('Montant HT', curX, tableTop + 6, { width: cols.montant, align: 'right' });

        // Table Rows
        let rowY = tableTop + 20;
        doc.fillColor('black').font('Helvetica').fontSize(9);

        rubriques.forEach((r, i) => {
            // Complément concaténé au libellé
            const complement = (r.Complement || '').trim();
            const libelle = complement
                ? `${r.libelleRubrique || ''} — ${complement}`
                : (r.libelleRubrique || '');

            // Hauteur dynamique si le libellé dépasse une ligne
            const libelleHeight = doc.heightOfString(libelle, { width: cols.libelle - 10 });
            const rowHeight = Math.max(20, libelleHeight + 8);

            if (rowY + rowHeight > doc.page.height - 150) {
                doc.addPage();
                rowY = 50;
            }

            if (i % 2 === 1) doc.rect(marginX, rowY, usableWidth, rowHeight).fill('#f3f4f6');

            doc.fillColor('black');
            let cx = marginX;
            doc.text(r.CodeRubrique || '', cx + 5, rowY + 6, { width: cols.ref - 10 }); cx += cols.ref;
            doc.text(libelle, cx + 5, rowY + 6, { width: cols.libelle - 10 }); cx += cols.libelle;
            doc.text(this.formatCurrency(r.MontantHTFactures || 0), cx, rowY + 6, { width: cols.montant, align: 'right' });

            rowY += rowHeight;
        });

        // Totals
        doc.moveDown(1);
        const totalX = pageWidth - marginX - 180;
        const drawTotalRow = (label, value, y, isBold = false) => {
            doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
            doc.text(label, totalX, y);
            doc.text(value, totalX + 80, y, { width: 100, align: 'right' });
        };

        let ty = doc.y + 10;
        drawTotalRow('Total HT:', this.formatCurrency(invoice.MontantHTFacture), ty); ty += 20;
        drawTotalRow('Total TVA:', this.formatCurrency(invoice.MontantTVAFacture), ty); ty += 20;
        doc.rect(totalX, ty - 5, 180, 25).fill('#fef3c7');
        doc.fillColor('#92400e');
        drawTotalRow('TOTAL TTC:', this.formatCurrency(invoice.MontantTTCFacture), ty + 5, true);

        // EUR equivalent — seulement si un taux Euro est configuré dans les devises
        if (tauxEUR) {
            ty += 30;
            const montantEUR = (invoice.MontantTTCFacture / tauxEUR).toFixed(2);
            doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(10);
            doc.text(`Soit : ${new Intl.NumberFormat('fr-FR').format(montantEUR).replace(/\s/g, ' ')} EUR`, totalX, ty, { width: 180, align: 'right' });
        }

        // Amount in words
        doc.moveDown(3);
        doc.fillColor('black').font('Helvetica-Oblique').fontSize(9);
        const amountWords = `Arrêté la présente facture à la somme de : ${this.numberToFrench(invoice.MontantTTCFacture)} ${this.refSymbol}.`;
        doc.text(amountWords, marginX, doc.y, { width: usableWidth });

        // --- AGENT INFO ---
        doc.moveDown(2);
        const agentY = doc.y;
        doc.fillColor('black').font('Helvetica-Bold').fontSize(9);
        doc.text('Facture établie par :', marginX, agentY);
        doc.font('Helvetica').fontSize(9);
        doc.text(invoice.AgentName || 'N/A', marginX, agentY + 14);
        const agentPhone = invoice.AgentTel || invoice.AgentCel || 'N/A';
        doc.text(`Tél : ${agentPhone}`, marginX, agentY + 28);

        // --- STAMP (Cloudflare R2) ---
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
        //   = narrow no-break space (used by fr-FR locale),   = non-breaking space
        return new Intl.NumberFormat('fr-FR').format(Math.round(amount))
            .replace(/[  \s]/g, ' ') + ' ' + this.refSymbol;
    }

    numberToFrench(n) {
        // Very basic implementation, should ideally use a library like 'n2words'
        // For now, simple placeholder or basic logic
        return n.toString(); // TODO: improve if possible
    }
}

module.exports = InvoicePDFGenerator;
