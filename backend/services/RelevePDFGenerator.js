const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class RelevePDFGenerator {
    constructor(pool) {
        this.pool = pool;
        this.refSymbol = 'F XAF'; // repli ; écrasé par la devise de référence réelle dans fetchReleveData
    }

    async generatePDF(params) {
        const { clientId, dateDebut, dateFin, typeFacture, etatFacture, structur_id, is_provider, isEtatFactures } = params;

        // 1. Fetch data
        const data = await this.fetchReleveData(clientId, dateDebut, dateFin, typeFacture, etatFacture, structur_id, is_provider);
        if (!data.client) throw new Error('Client not found');

        // 2. Create PDF
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 30, bottom: 50, left: 40, right: 40 },
            bufferPages: true
        });

        // 3. Setup output file
        const clientNameSafe = (data.client.NomRS || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
        const dynamicOutputDir = path.join(__dirname, '..', 'uploads', 'clients', `${clientId}_${clientNameSafe}`, 'etats');
        
        if (!fs.existsSync(dynamicOutputDir)) {
            fs.mkdirSync(dynamicOutputDir, { recursive: true });
        }

        let typeExt = isEtatFactures ? 'EtatFactures' : 'ReleveCompte';
        if (typeFacture === 'D') typeExt += 'Douane';
        if (typeFacture === 'P') typeExt += 'GlobalesPrestations';

        const filename = `${typeExt}-${Date.now()}.pdf`;
        const outputPath = path.join(dynamicOutputDir, filename);
        const writeStream = fs.createWriteStream(outputPath);
        doc.pipe(writeStream);

        // 4. Build PDF content
        await this.renderTemplate(doc, data, params);

        // 5. Finalize
        doc.end();

        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve(outputPath));
            writeStream.on('error', reject);
        });
    }

    async fetchReleveData(clientId, dateDebut, dateFin, typeFacture, etatFacture, structur_id, is_provider) {
        const connection = await this.pool.getConnection();
        try {
            const { getReferenceCurrency } = require('./deviseService');
            this.refSymbol = (await getReferenceCurrency()).Symbole;
            // Fetch Client
            let clientQuery = 'SELECT * FROM clients WHERE IDCLIENTS = ?';
            let clientParams = [clientId];
            if (!is_provider) {
                 clientQuery += ' AND structur_id = ?';
                 clientParams.push(structur_id);
            }
            const [clientRows] = await connection.query(clientQuery, clientParams);
            if (clientRows.length === 0) return { client: null };
            const client = clientRows[0];

            // Fetch Factures
            let query = `
                SELECT 
                    f.IDFactures,
                    f.NumeroFacture,
                    f.Datefacture,
                    f.MontantTTCFacture,
                    f.MontantRegleFacture,
                    f.ReliquatFacture,
                    f.DateEcheance,
                    d.CodeDossier
                FROM factures f
                JOIN dossiers d ON f.IDDossiers = d.IDDossiers
                WHERE d.IDCLIENTS = ?
                  AND f.Datefacture BETWEEN ? AND ?
            `;
            const params = [clientId, dateDebut, dateFin];

            if (typeFacture === 'D') {
                query += " AND f.NumeroFacture LIKE 'FD%'";
            } else if (typeFacture === 'P') {
                query += " AND f.NumeroFacture NOT LIKE 'FD%'";
            }

            if (etatFacture === 'N') {
                query += " AND f.ReliquatFacture > 0";
            } else if (etatFacture === 'S') {
                query += " AND f.ReliquatFacture <= 0";
            }

            if (!is_provider) {
                query += ' AND f.structur_id = ?';
                params.push(structur_id);
            }

            query += ' ORDER BY f.Datefacture ASC, f.NumeroFacture ASC';

            const [factures] = await connection.query(query, params);

            // Fetch Structure
            let structurQuery = 'SELECT * FROM structur LIMIT 1';
            let structurParams = [];
            if (!is_provider) {
                 structurQuery = 'SELECT * FROM structur WHERE param_id = ? LIMIT 1';
                 structurParams.push(structur_id);
            }
            const [structures] = await connection.query(structurQuery, structurParams);
            const structure = structures.length > 0 ? structures[0] : null;

            // Fetch Devise Euro
            const [devises] = await connection.query("SELECT TauxChangeDeviseCFA FROM devises WHERE libelle LIKE '%Euro%' LIMIT 1");
            const tauxEUR = devises.length > 0 ? parseFloat(devises[0].TauxChangeDeviseCFA) : null;

            return { client, factures, structure, tauxEUR };
        } finally {
            connection.release();
        }
    }

    async renderTemplate(doc, data, params) {
        const { client, factures, structure, tauxEUR } = data;
        const { isEtatFactures, dateDebut, dateFin, typeFacture } = params;
        
        const pageWidth = doc.page.width;
        const marginX = 40;
        const usableWidth = pageWidth - (marginX * 2);

        // --- HEADER (logo depuis R2) ---
        if (structure && structure.cheminlogo) {
            try {
                const { downloadFile } = require('../utils/storage');
                let key = structure.cheminlogo;
                if (key.startsWith('uploads/')) key = key.slice(8);
                const imgBuf = await downloadFile(key);
                doc.image(imgBuf, marginX, 30, { height: 50 });
            } catch (e) { }
        }

        let gStitrereleve = isEtatFactures ? "Etat toutes factures" : "Relevé compte toutes factures";
        
        let introTextBody = isEtatFactures 
            ? "se présente comme entre le " + this.formatDateStr(dateDebut) + " et le " + this.formatDateStr(dateFin) + ":"
            : "se présente comme suit au " + this.formatDateStr(dateFin) + ":";

        let gSintro = `Madame, Monsieur,\nVeuillez trouver ci-après le relevé de toutes les factures de votre compte dans nos livres qui, sauf erreur de notre part, ${introTextBody}`;

        if (typeFacture === 'D') {
            gStitrereleve = isEtatFactures ? "Etat factures douane" : "Relevé compte factures douane";
            gSintro = `Madame, Monsieur,\nVeuillez trouver ci-après le relevé des factures douane de votre compte dans nos livres qui, sauf erreur de notre part, ${introTextBody}`;
        } else if (typeFacture === 'P') {
            gStitrereleve = isEtatFactures ? "Etat factures globales/prestations" : "Relevé compte factures globales/prestations";
            gSintro = `Madame, Monsieur,\nVeuillez trouver ci-après le relevé des factures prestations/globales de votre compte dans nos livres qui, sauf erreur de notre part, ${introTextBody}`;
        }

        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1e3a8a');
        doc.text(gStitrereleve.toUpperCase(), marginX, 40, { align: 'right' });

        doc.fontSize(10).font('Helvetica').fillColor('black');
        const nowStr = `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`;
        doc.text(`Édité le: ${nowStr}`, marginX, 60, { align: 'right' });

        // Company Details (Left)
        doc.moveDown(2);
        const startY = 100;
        doc.fontSize(10).font('Helvetica-Bold').text(structure?.NomSociete || 'SOCIÉTÉ DE TRANSIT', marginX, startY);
        doc.font('Helvetica').fontSize(8).fillColor('#4b5563');
        doc.text(structure?.adrSociete || '', marginX, startY + 15, { width: 250 });
        doc.text(`Tél : ${structure?.telSociete || ''}`, marginX, startY + 25, { width: 250 });
        doc.text(`NINEA: ${structure?.NINEASociete || ''}`, marginX, startY + 35);

        // Client Details (Right Box - Table_EnteteClient replica)
        const clientBoxX = pageWidth - marginX - 250;
        doc.rect(clientBoxX, startY, 250, 75).fill('#f9fafb').stroke('#e5e7eb');
        doc.fillColor('black').fontSize(9).font('Helvetica-Bold').text('CLIENT :', clientBoxX + 10, startY + 10);
        doc.fontSize(10).text(client.NomRS || '', clientBoxX + 10, startY + 25);
        doc.fontSize(8).font('Helvetica');
        doc.text(client.adresseClient || '', clientBoxX + 10, startY + 40, { width: 230 });
        doc.text(`Tél : ${client.TelClient || ''}    Email : ${client.EmailClient || ''}`, clientBoxX + 10, startY + 50, { width: 230 });
        doc.text(`Encours Autorisé : ${this.formatCurrency(client.EncoursAutorise || 0)}`, clientBoxX + 10, startY + 60, { width: 230 });

        // Intro paragraph
        doc.moveDown(4);
        let introY = doc.y;
        if (introY < startY + 85) introY = startY + 85;

        doc.fontSize(9).font('Helvetica-Oblique').fillColor('#374151');
        doc.text(gSintro, marginX, introY, { width: usableWidth, align: 'justify' });

        // --- TABLE ---
        doc.moveDown(2);
        const tableTop = doc.y;

        // Table Header
        doc.rect(marginX, tableTop, usableWidth, 20).fill('#1e3a8a').stroke('#1e3a8a');
        doc.fillColor('white').font('Helvetica-Bold').fontSize(8);

        const cols = {
            date: 60,
            facture: 70,
            dossier: 80,
            entree: (usableWidth - 60 - 70 - 80 - 70) / 2, // Sortie (Montant TTC)
            sortie: (usableWidth - 60 - 70 - 80 - 70) / 2, // Entrée (Montant Réglé)
            reliquat: 70
        };

        let curX = marginX;
        doc.text('Date', curX + 5, tableTop + 6); curX += cols.date;
        doc.text('N° Facture', curX + 5, tableTop + 6); curX += cols.facture;
        doc.text('Code Dossier', curX + 5, tableTop + 6); curX += cols.dossier;
        doc.text('Sortie (TTC)', curX, tableTop + 6, { width: cols.sortie, align: 'right' }); curX += cols.sortie;
        doc.text('Entrée (Règlement)', curX, tableTop + 6, { width: cols.entree, align: 'right' }); curX += cols.entree;
        doc.text('Reste à payer', curX, tableTop + 6, { width: cols.reliquat, align: 'right' });

        // Table Rows
        let rowY = tableTop + 20;
        doc.fillColor('black').font('Helvetica').fontSize(8);

        let gmoTotalEntreeCompte = 0;
        let gmoTotalSortieCompte = 0;

        factures.forEach((f, i) => {
            const rowHeight = 18;
            if (rowY + rowHeight > doc.page.height - 150) {
                this.addGlobalPageFooter(doc, structure);
                doc.addPage();
                rowY = 50;
            }

            if (i % 2 === 1) doc.rect(marginX, rowY, usableWidth, rowHeight).fill('#f1f5f9');

            const montantTTC = parseFloat(f.MontantTTCFacture) || 0;
            const montantRegle = parseFloat(f.MontantRegleFacture) || 0;
            const reliquat = parseFloat(f.ReliquatFacture) || 0;
            
            gmoTotalSortieCompte += montantTTC;
            gmoTotalEntreeCompte += montantRegle;

            doc.fillColor('black');
            let cx = marginX;
            doc.text(this.formatDateStr(f.Datefacture), cx + 5, rowY + 5); cx += cols.date;
            doc.font('Helvetica-Bold').text(f.NumeroFacture || '', cx + 5, rowY + 5); doc.font('Helvetica'); cx += cols.facture;
            doc.fillColor('#4b5563').text(f.CodeDossier || '', cx + 5, rowY + 5, { width: cols.dossier }); doc.fillColor('black'); cx += cols.dossier;
            doc.fillColor('#dc2626').text(this.formatCurrencyShort(montantTTC), cx, rowY + 5, { width: cols.sortie, align: 'right' }); cx += cols.sortie;
            doc.fillColor('#059669').text(this.formatCurrencyShort(montantRegle), cx, rowY + 5, { width: cols.entree, align: 'right' }); cx += cols.entree;
            doc.fillColor('#1e293b').font('Helvetica-Bold').text(this.formatCurrencyShort(reliquat), cx, rowY + 5, { width: cols.reliquat, align: 'right' }); doc.font('Helvetica');

            rowY += rowHeight;
        });

        const gmoMomontantreliquattotal = gmoTotalSortieCompte - gmoTotalEntreeCompte;
        const gmoMontantreliquatEuros = tauxEUR ? gmoMomontantreliquattotal / tauxEUR : null;

        // Totals Box
        doc.moveDown(2);
        rowY += 10;
        
        if (rowY + 80 > doc.page.height - 100) {
            this.addGlobalPageFooter(doc, structure);
            doc.addPage();
            rowY = 50;
        }

        const totalBoxW = 220;
        const totalX = pageWidth - marginX - totalBoxW;
        
        doc.rect(totalX, rowY, totalBoxW, 70).fill('#f8fafc').stroke('#cbd5e1');
        doc.fillColor('#dc2626').font('Helvetica').fontSize(9);
        doc.text('Total Sorties (TTC) :', totalX + 10, rowY + 10); doc.text(this.formatCurrency(gmoTotalSortieCompte), totalX + 100, rowY + 10, { width: 110, align: 'right' });
        doc.fillColor('#059669').text('Total Entrées :', totalX + 10, rowY + 25); doc.text(this.formatCurrency(gmoTotalEntreeCompte), totalX + 100, rowY + 25, { width: 110, align: 'right' });
        
        doc.moveTo(totalX + 10, rowY + 40).lineTo(totalX + totalBoxW - 10, rowY + 40).stroke('#cbd5e1');
        
        doc.fillColor('#1e3a8a').font('Helvetica-Bold').fontSize(10);
        doc.text('RELIQUAT GLOBAL :', totalX + 10, rowY + 50); doc.text(this.formatCurrency(gmoMomontantreliquattotal), totalX + 100, rowY + 50, { width: 110, align: 'right' });

        // Information devises (Le montant en Euros est calculé...) — seulement si un taux Euro est configuré
        if (tauxEUR) {
            doc.moveDown(4);
            let infoY = rowY + 80;
            doc.rect(marginX, infoY, usableWidth, 25).fill('#fffbeb').stroke('#fde68a');
            doc.fillColor('#b45309').font('Helvetica-Oblique').fontSize(8);
            const gsinfo = `Information : Le reliquat global s'élève à ${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(gmoMontantreliquatEuros).replace(/\s/g, ' ')} EUR. (Taux: 1 Euro = ${tauxEUR} ${this.refSymbol}).`;
            doc.text(gsinfo, marginX + 10, infoY + 8);
        }

        this.addGlobalPageFooter(doc, structure);
    }

    addGlobalPageFooter(doc, structure) {
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            const footerY = doc.page.height - 30;
            doc.fontSize(7).font('Helvetica').fillColor('#9ca3af');
            const footerText = `${structure?.NomSociete} - ${structure?.adrSociete} - Tel: ${structure?.telSociete} - NINEA: ${structure?.NINEASociete}`;
            doc.text(footerText, 0, footerY, { align: 'center', width: doc.page.width });
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount).replace(/\s/g, ' ') + ' ' + this.refSymbol;
    }

    formatCurrencyShort(amount) {
        return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount).replace(/\s/g, ' ');
    }

    formatDateStr(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
}

module.exports = RelevePDFGenerator;
