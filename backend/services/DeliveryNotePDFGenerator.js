const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class DeliveryNotePDFGenerator {
    constructor(pool) {
        this.pool = pool;
    }

    /**
     * Generate PDF from an existing Transport Order (OTR)
     */
    async generateFromOTR(otrId) {
        // 1. Fetch data
        const data = await this.fetchDetailedData(otrId);
        if (!data.order) {
            throw new Error('Transport order not found');
        }

        // 2. Create PDF (A4 Portrait)
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 40, bottom: 60, left: 40, right: 40 },
            bufferPages: true
        });

        // 3. Setup output file dynamically based on client
        const clientId = data.order.IDCLIENTS || 'misc';
        const clientNameSafe = (data.order.client_name || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
        const dynamicOutputDir = path.join(__dirname, '..', 'uploads', 'clients', `${clientId}_${clientNameSafe}`, 'bordereaux');

        if (!fs.existsSync(dynamicOutputDir)) {
            fs.mkdirSync(dynamicOutputDir, { recursive: true });
        }

        const filename = `BL_${String(otrId).replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const outputPath = path.join(dynamicOutputDir, filename);
        const writeStream = fs.createWriteStream(outputPath);
        doc.pipe(writeStream);

        // 4. Build content
        await this.renderTemplate(doc, data);

        // 5. Finalize
        doc.end();

        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve(outputPath));
            writeStream.on('error', reject);
        });
    }

    async fetchDetailedData(otrId) {
        const connection = await this.pool.getConnection();
        try {
            // Fetch Order
            const [orders] = await connection.query(
                `SELECT o.*, d.CodeDossier as dossier_code, d.Libelle as dossier_label, d.IDCLIENTS,
                        d.ModeExpedition as dossier_mode, d.TypeDossier as dossier_type,
                        c.NomRS as client_name, c.adresseClient as client_address,
                        bl.NumeroTitreTransport as bl_number,
                        ot.PROVENANCE as provenance
                 FROM ordresdetransport o
                 LEFT JOIN dossiers d ON o.IDDossiers = d.IDDossiers
                 LEFT JOIN clients c ON d.IDCLIENTS = c.IDCLIENTS
                 LEFT JOIN billoflading bl ON d.IDDossiers = bl.idbl
                 LEFT JOIN ordrestransit ot ON d.IDDossiers = ot.IDDossiers
                 WHERE o.IDOrdresDeTransport = ?`,
                [otrId]
            );

            if (orders.length === 0) return { order: null };
            const order = orders[0];

            // Fetch Contents
            const [contents] = await connection.query(
                'SELECT * FROM contenuconteneurordretrbordereauliv WHERE CodeOrdreTransport = ?',
                [order.CodeOrdreTransport]
            );

            // Fetch Structure
            const [structures] = await connection.query('SELECT * FROM structur LIMIT 1');
            const structure = structures.length > 0 ? structures[0] : null;

            return { order, contents, structure };
        } finally {
            connection.release();
        }
    }

    async renderTemplate(doc, data) {
        const { order, contents, structure } = data;
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

        // Company Box
        doc.lineWidth(1).strokeColor('#4b5563');
        doc.rect(150, 30, usableWidth - 110, 45).stroke();
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e3a8a');
        doc.text(structure?.NomSociete || '', 155, 38, { width: usableWidth - 120, align: 'center' });
        doc.fontSize(8).font('Helvetica-Oblique').fillColor('#4b5563');
        doc.text(structure?.ActivitesPrincipales || '', 155, 55, { width: usableWidth - 120, align: 'center' });

        doc.fillColor('black');
        doc.moveDown(3);

        // Title Row
        const titleY = 100;
        doc.lineWidth(0.5).strokeColor('#9ca3af');

        // Bordereau de livraison n°
        doc.rect(marginX, titleY, 150, 25).stroke();
        doc.font('Helvetica-Bold').fontSize(11).text('Bordereau de livraison n°', marginX + 5, titleY + 7);

        // Code (Generate a BL- prefix code using the ID if no specific code exists)
        const blCode = `BL-${String(order.IDOrdresDeTransport).padStart(5, '0')}`;
        doc.rect(marginX + 155, titleY, 200, 25).stroke();
        doc.text(blCode, marginX + 160, titleY + 7);

        // Info Grid
        doc.moveDown(1);
        const gridY = doc.y + 10;
        const col1Width = 180; // Increased from 140 to avoid overflow
        const col2Width = usableWidth - col1Width - 10;

        const drawField = (label, value, x, y, width, labelWidth = 65) => {
            doc.rect(x, y, width, 20).stroke();
            doc.font('Helvetica-Bold').fontSize(8).text(label, x + 5, y + 6);
            doc.font('Helvetica').fontSize(9).text(value || '', x + labelWidth, y + 6);
        };

        drawField('Code dossier', order.dossier_code, marginX, gridY, col1Width);

        // Client Detail Box on right
        doc.rect(marginX + col1Width + 10, gridY, col2Width, 45).stroke();
        doc.font('Helvetica-Bold').fontSize(9).text(order.client_name || '', marginX + col1Width + 15, gridY + 10);
        doc.font('Helvetica').fontSize(8).text(order.client_address || '', marginX + col1Width + 15, gridY + 22, { width: col2Width - 10 });

        drawField('OTR n°', order.CodeOrdreTransport, marginX, gridY + 25, col1Width);

        const gridY2 = gridY + 55;
        drawField('N° BL', order.bl_number, marginX, gridY2, col1Width);
        drawField('Prov.', order.provenance, marginX + col1Width + 10, gridY2, col2Width);

        const gridY3 = gridY2 + 25;
        doc.rect(marginX, gridY3, usableWidth, 20).stroke();
        doc.font('Helvetica-Bold').fontSize(8).text('Exp.', marginX + 5, gridY3 + 6);
        doc.font('Helvetica').fontSize(9).text(order.TransporteuretAdresse || '', marginX + 60, gridY3 + 6);

        const gridY4 = gridY3 + 25;
        const modeLabel = order.dossier_mode === 'MA' ? 'Maritime' : order.dossier_mode === 'AE' ? 'Aérien' : 'Terrestre';
        const typeLabel = order.dossier_type === 'TC' ? 'Conteneur' : order.dossier_type === 'GR' ? 'Groupage' : 'Conv.';
        drawField('Mode/Type', `${modeLabel} / ${typeLabel}`, marginX, gridY4, col1Width + 100);
        drawField('Du', '__/__/____', marginX + col1Width + 110, gridY4, usableWidth - (col1Width + 110));

        const gridY5 = gridY4 + 25;
        drawField('Date enlèv.', '__/__/____', marginX, gridY5, 120);
        drawField('N° camion', '', marginX + 130, gridY5, 150);
        drawField('N° dec.', order.NumDeclaration, marginX + 290, gridY5, usableWidth - 290);

        const gridY6 = gridY5 + 25;
        drawField('Magasinage à :', '__/__/____', marginX, gridY6, 150);
        drawField('Payé jusqu\'à :', '__/__/____', marginX + 160, gridY6, 200);

        // --- TABLE ---
        doc.moveDown(3);
        const tableTop = doc.y;

        // Table Header
        doc.rect(marginX, tableTop, usableWidth, 20).fill('#9ca3af').stroke('#4b5563');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(10);
        doc.text('Conteneurs', marginX, tableTop + 5, { width: usableWidth, align: 'center' });

        const subHeaderY = tableTop + 20;
        doc.rect(marginX, subHeaderY, usableWidth, 20).fill('#e5e7eb').stroke('#4b5563');
        doc.fillColor('black').font('Helvetica-Bold').fontSize(9);

        const colWidths = {
            numero: 150,
            type: 80,
            objet: 120,
            qte: 50,
            poids: 60,
            unite: 35
        };

        let currentX = marginX;
        doc.text('Numéro TC', currentX + 5, subHeaderY + 6, { width: colWidths.numero });
        currentX += colWidths.numero;
        doc.text('Type', currentX + 5, subHeaderY + 6, { width: colWidths.type, align: 'center' });
        currentX += colWidths.type;
        doc.text('Objet', currentX + 5, subHeaderY + 6, { width: colWidths.objet, align: 'center' });
        currentX += colWidths.objet;
        doc.text('Quantité', currentX + 5, subHeaderY + 6, { width: colWidths.qte, align: 'center' });
        currentX += colWidths.qte;
        doc.text('Poids net', currentX + 5, subHeaderY + 6, { width: colWidths.poids, align: 'center' });
        currentX += colWidths.poids;
        doc.text('Unité', currentX + 5, subHeaderY + 6, { width: colWidths.unite, align: 'center' });

        // Table Rows
        let rowY = subHeaderY + 20;
        doc.font('Helvetica').fontSize(8);

        contents.forEach((item, idx) => {
            const rowHeight = 20;
            if (rowY + rowHeight > 550) { // Reduced to 550 to ensure large signature block and warning fit
                doc.addPage();
                rowY = 50;
            }

            // Draw verticals
            let vX = marginX;
            doc.lineJoin('miter').rect(marginX, rowY, usableWidth, rowHeight).stroke();

            doc.text(item.NumeroTC || '', marginX + 5, rowY + 6);
            vX += colWidths.numero; doc.moveTo(vX, rowY).lineTo(vX, rowY + rowHeight).stroke();
            doc.text(item.TypeTC || '', vX, rowY + 6, { width: colWidths.type, align: 'center' });
            vX += colWidths.type; doc.moveTo(vX, rowY).lineTo(vX, rowY + rowHeight).stroke();
            doc.text(item.ObjetTC || '', vX + 5, rowY + 6, { width: colWidths.objet });
            vX += colWidths.objet; doc.moveTo(vX, rowY).lineTo(vX, rowY + rowHeight).stroke();
            doc.text(String(item.Quantite || '0,00'), vX, rowY + 6, { width: colWidths.qte, align: 'center' });
            vX += colWidths.qte; doc.moveTo(vX, rowY).lineTo(vX, rowY + rowHeight).stroke();
            doc.text(String(item.PoidsNet || '0,00'), vX, rowY + 6, { width: colWidths.poids, align: 'center' });
            vX += colWidths.poids; doc.moveTo(vX, rowY).lineTo(vX, rowY + rowHeight).stroke();
            doc.text(item.Unite || '', vX, rowY + 6, { width: colWidths.unite, align: 'center' });

            rowY += rowHeight;
        });

        // --- FOOTER ---
        const footerStartY = rowY + 30;
        doc.y = footerStartY;

        const signatureY = doc.y;
        doc.font('Helvetica-Bold').fontSize(11);
        doc.text('Pour le Client', marginX + 10, signatureY);
        doc.text(`Pour ${structure?.NomSociete || 'la société'}`, 350, signatureY);

        // Cachet de la société (même logique que TransportOrderPDFGenerator)
        if (structure?.chemin_cachet_livraison) {
            try {
                const { downloadFile } = require('../utils/storage');
                let key = structure.chemin_cachet_livraison;
                if (key.startsWith('uploads/')) key = key.slice(8);
                const imgBuffer = await downloadFile(key);
                doc.image(imgBuffer, 380, signatureY + 25, { width: 100 });
            } catch (err) {
                console.error('Error adding delivery stamp:', err);
            }
        }

        // Warning text - Increase gap for stamp and signature
        const finalY = signatureY + 120;
        doc.y = finalY;
        doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#374151');
        doc.text('En cas de manquants et/ou d’avaries, veuillez confirmer dans les 24 heures. Passé ce délai, votre déclaration ne pourra pas être prise en considération.', marginX, doc.y, { width: usableWidth, align: 'left' });

        this.addGlobalPageFooter(doc, data);
    }

    addGlobalPageFooter(doc, data) {
        const { structure } = data;
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            this.renderBottomInfo(doc, structure);
        }
    }

    renderBottomInfo(doc, structure) {
        if (!structure) return;
        const footerY = doc.page.height - 80;
        doc.moveTo(40, footerY - 5).lineTo(doc.page.width - 40, footerY - 5).lineWidth(0.5).strokeColor('#ccc').stroke();
        doc.fontSize(7).font('Helvetica').fillColor('#666');

        // Put everything on one line to avoid line break splitting across pages
        const text = `${structure.NomSociete} - ${structure.adrSociete || ''} - Tel: ${structure.telSociete || ''} - Email: ${structure.Emailstructur || ''} - NINEA: ${structure.NINEASociete || ''} - RC: ${structure.RegistreCommerce || ''}`;
        doc.text(text, 40, footerY, { align: 'center', width: doc.page.width - 80 });
    }
}

module.exports = DeliveryNotePDFGenerator;
