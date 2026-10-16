const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class TransportOrderPDFGenerator {
    constructor(pool) {
        this.pool = pool;
    }

    /**
     * Generate PDF for a transport order
     */
    async generatePDF(orderCode) {
        // 1. Fetch data
        const data = await this.fetchOrderData(orderCode);
        if (!data.order) {
            throw new Error('Transport order not found');
        }

        // 2. Create PDF (A4 Portrait)
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 80, left: 50, right: 50 },
            bufferPages: true
        });

        // 3. Setup output file dynamically based on client
        const clientId = data.order.IDCLIENTS || 'misc';
        const clientNameSafe = (data.order.client_name || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
        const dynamicOutputDir = path.join(__dirname, '..', 'uploads', 'clients', `${clientId}_${clientNameSafe}`, 'ordres_transport');

        if (!fs.existsSync(dynamicOutputDir)) {
            fs.mkdirSync(dynamicOutputDir, { recursive: true });
        }

        const filename = `OTR_${orderCode.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const outputPath = path.join(dynamicOutputDir, filename);
        const writeStream = fs.createWriteStream(outputPath);
        doc.pipe(writeStream);

        // 4. Build content
        await this.addHeader(doc, data);
        this.addMainContent(doc, data);
        await this.addFooter(doc, data);

        // 5. Add footer to all pages (Buffered approach to avoid infinite recursion)
        this.renderGlobalFooter(doc, data);

        // 6. Finalize
        doc.end();

        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve(outputPath));
            writeStream.on('error', reject);
        });
    }

    async fetchOrderData(orderCode) {
        const connection = await this.pool.getConnection();
        try {
            const [orders] = await connection.query(
                `SELECT o.*, d.CodeDossier as code_dossier_real, d.Libelle as dossier_label, d.IDCLIENTS, c.NomRS as client_name
                 FROM ordresdetransport o
                 JOIN dossiers d ON o.IDDossiers = d.IDDossiers
                 LEFT JOIN clients c ON d.IDCLIENTS = c.IDCLIENTS
                 WHERE o.CodeOrdreTransport = ?`,
                [orderCode]
            );

            if (orders.length === 0) return { order: null };
            const order = orders[0];

            const [contents] = await connection.query(
                'SELECT * FROM contenuconteneurordretrbordereauliv WHERE CodeOrdreTransport = ?',
                [orderCode]
            );

            const [structures] = await connection.query('SELECT * FROM structur LIMIT 1');
            const structure = structures.length > 0 ? structures[0] : null;

            return { order, contents, structure };
        } finally {
            connection.release();
        }
    }

    async addHeader(doc, data) {
        const { structure } = data;
        const pageWidth = doc.page.width;
        const marginLeft = 50;
        const marginRight = 50;

        // --- Logo on the top-left (depuis R2) ---
        if (structure && structure.cheminlogo) {
            try {
                const { downloadFile } = require('../utils/storage');
                let key = structure.cheminlogo;
                if (key.startsWith('uploads/')) key = key.slice(8);
                const imgBuf = await downloadFile(key);
                doc.image(imgBuf, 30, 30, { height: 60 });
            } catch (err) {
                // Fallback to BLOB if R2 fails
                if (structure.logoSociete) {
                    try {
                        const logoBuffer = Buffer.from(structure.logoSociete);
                        doc.image(logoBuffer, 30, 30, { height: 60 });
                    } catch (e) { }
                }
            }
        }

        // --- Company name and info centered in the middle part (shifted right to account for logo) ---
        const centerAreaX = 120;
        const centerAreaWidth = pageWidth - marginRight - centerAreaX;

        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1a3c6e');
        doc.text(structure?.NomSociete || '', centerAreaX, 35, {
            width: centerAreaWidth,
            align: 'center'
        });

        // --- Activities below ---
        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#333333');
        doc.text(structure?.ActivitesPrincipales || '', centerAreaX, 55, {
            width: centerAreaWidth,
            align: 'center'
        });

        doc.fillColor('black');

        // --- Move cursor down past the header ---
        doc.y = 110;

        // Date and Title
        const today = new Date(data.order.DateOrdreTransport).toLocaleDateString('fr-FR');
        doc.fontSize(10).font('Helvetica').text(`Fait à Dakar, le ${today}`, 0, doc.y, { align: 'right', width: pageWidth - marginRight });

        doc.moveDown(2);
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e40af');
        doc.text('ORDRE DE TRANSPORT', { align: 'center', underline: true });
        doc.fontSize(12).text(`N° ${data.order.CodeOrdreTransport}`, { align: 'center' });
        doc.fillColor('black');
    }

    addMainContent(doc, data) {
        const { order, contents } = data;

        doc.moveDown(2);
        doc.fontSize(11).font('Helvetica-Bold').text('Destinataire :');
        doc.fontSize(11).font('Helvetica').text(order.TransporteuretAdresse, 150, doc.y - 12);

        doc.moveDown(2);
        doc.font('Helvetica').text(order.Introduction || 'Messieurs,');

        doc.moveDown(1.5);
        // Table for contents
        const tableTop = doc.y;
        const startX = 50;

        // Headers
        doc.font('Helvetica-Bold').fontSize(10);
        doc.rect(startX, tableTop, 495, 20).fill('#f1f5f9');
        doc.fillColor('black').text('N° Conteneur / Article', startX + 5, tableTop + 5);
        doc.text('Type', startX + 155, tableTop + 5);
        doc.text('Quantité', startX + 255, tableTop + 5);
        doc.text('Poids/Unité', startX + 355, tableTop + 5);

        let currentY = tableTop + 20;
        doc.font('Helvetica').fontSize(9);

        contents.forEach((item, index) => {
            // Check for page break (considering footer)
            if (currentY > 650) {
                doc.addPage();
                currentY = 50;
            }
            const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
            doc.rect(startX, currentY, 495, 20).fill(bgColor);
            doc.fillColor('black');

            doc.text(item.NumeroTC || '', startX + 5, currentY + 6);
            doc.text(item.TypeTC || '', startX + 155, currentY + 6);
            doc.text(String(item.Quantite || ''), startX + 255, currentY + 6);
            doc.text(`${item.PoidsNet || ''} ${item.Unite || ''}`, startX + 355, currentY + 6);

            currentY += 20;
        });

        doc.moveDown(2);

        // Final text block with page break check
        if (currentY > 600) {
            doc.addPage();
            currentY = 50;
            doc.y = currentY;
        } else {
            doc.y = currentY + 20;
        }

        doc.fontSize(10).font('Helvetica-Bold').text('Adresse de livraison : ', { continued: true });
        doc.font('Helvetica').text(order.AdresseDeLivraison || 'Voir dossier');

        doc.moveDown(1);
        doc.font('Helvetica-Bold').text('Dossier N° : ', { continued: true });
        doc.font('Helvetica').text(order.CodeDossier || order.code_dossier_real);

        doc.moveDown(1);
        doc.font('Helvetica-Bold').text('Déclaration N° : ', { continued: true });
        doc.font('Helvetica').text(order.NumDeclaration || 'En cours');

        doc.moveDown(2);
        doc.fontSize(10).font('Helvetica').text(order.forùulepolitesse || 'Veuillez agréer, messieurs, l\'expression de nos salutations distinguées.', 50, doc.y, { width: 495 });
    }

    async addFooter(doc, data) {
        const { structure, order } = data;
        doc.moveDown(4);
        const y = doc.y;

        // Carrier info on the left
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text('Le Transporteur', 50, y, { width: 250, align: 'center' });
        doc.fontSize(9).font('Helvetica').text(order.TransporteuretAdresse || '', 50, y + 15, { width: 250, align: 'center' });
        // No "Cachet et Signature" label here as per user request to remove it (or did they mean only the company one?)
        // Actually they said "pour lui permettre de mettre son cachet et sa signature", so maybe a label helps.
        // But "IL faut anlever le libellé 'Cachet et signature'" is quite general.
        // I'll put it in small italics for the carrier only if it helps, otherwise I'll just leave space.

        // Logistic Manager on the right
        doc.fontSize(11).font('Helvetica-Bold');
        doc.text('Le Responsable Logistique', 350, y, { align: 'center' });

        // Add Cachet de Livraison (Cloudflare R2)
        if (structure && structure.chemin_cachet_livraison) {
            try {
                const { downloadFile } = require('../utils/storage');
                let key = structure.chemin_cachet_livraison;
                if (key.startsWith('uploads/')) key = key.slice(8);
                const imgBuffer = await downloadFile(key);
                doc.image(imgBuffer, 380, y + 25, { width: 100 });
            } catch (err) {
                console.error('Error adding delivery stamp:', err);
            }
        }
    }

    /**
     * Page footer with legal information - rendered at the bottom of each page
     */
    addPageFooter(doc, data) {
        const { structure } = data;
        if (!structure) return;

        const pageWidth = doc.page.width;
        const marginLeft = 50;
        const marginRight = 50;
        const contentWidth = pageWidth - marginLeft - marginRight;
        const footerY = doc.page.height - 75;

        // Save current position and margins
        const savedY = doc.y;
        const oldBottomMargin = doc.page.margins.bottom;

        // Temporarily remove bottom margin to avoid writing in the footer area without triggering a new page
        doc.page.margins.bottom = 0;

        // Separator line
        doc.moveTo(marginLeft, footerY - 5)
            .lineTo(pageWidth - marginRight, footerY - 5)
            .lineWidth(0.5)
            .strokeColor('#999999')
            .stroke();

        doc.fontSize(7).font('Helvetica').fillColor('#555555');

        // Line 1: FormeJuridique au capital de XXXX
        const line1Parts = [];
        if (structure.FormeJuridique) line1Parts.push(structure.FormeJuridique);
        if (structure.Capital) line1Parts.push(`au capital de ${structure.Capital}`);
        const line1 = line1Parts.join(' ');

        // Line 2: Address
        const line2 = structure.adrSociete || '';

        // Line 3: Phones + Email
        const line3Parts = [];
        if (structure.telSociete) line3Parts.push(`Tel : ${structure.telSociete}`);
        if (structure.celSociete) line3Parts.push(`Tel : ${structure.celSociete}`);
        if (structure.Emailstructur) line3Parts.push(`Email : ${structure.Emailstructur}`);
        const line3 = line3Parts.join(' - ');

        // Line 4: NINEA + RC
        const line4Parts = [];
        if (structure.NINEASociete) line4Parts.push(`NINEA : ${structure.NINEASociete}`);
        if (structure.RegistreCommerce) line4Parts.push(`RC : ${structure.RegistreCommerce}`);
        const line4 = line4Parts.join(' - ');

        doc.text(line1, marginLeft, footerY, { width: contentWidth, align: 'center' });
        doc.text(line2, marginLeft, footerY + 10, { width: contentWidth, align: 'center' });
        doc.text(line3, marginLeft, footerY + 20, { width: contentWidth, align: 'center' });
        doc.text(line4, marginLeft, footerY + 30, { width: contentWidth, align: 'center' });

        doc.fillColor('black');

        // Restore position and margins
        doc.y = savedY;
        doc.page.margins.bottom = oldBottomMargin;
    }

    renderGlobalFooter(doc, data) {
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            this.addPageFooter(doc, data);
        }
    }
}

module.exports = TransportOrderPDFGenerator;
