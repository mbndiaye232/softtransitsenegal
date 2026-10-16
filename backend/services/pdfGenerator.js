/**
 * PDF Generator Service for Note de Détail
 * Generates A3 landscape PDF with company logo, articles matrix, and liquidation
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// A3 dimensions in points (1 point = 1/72 inch)
// A3: 297mm x 420mm = 841.89 x 1190.55 points
const A3_WIDTH = 1190.55;
const A3_HEIGHT = 841.89;

class NoteDetailPDFGenerator {
    constructor(pool) {
        this.pool = pool;
        this.refSymbol = 'FC'; // repli ; écrasé par la devise de référence réelle dans fetchNoteData
    }

    /**
     * Generate PDF for a note de détail
     * @param {number} noteId - ID of the note
     * @returns {Promise<string>} - Path to generated PDF
     */
    async generatePDF(noteId) {
        // 1. Fetch all required data
        const data = await this.fetchNoteData(noteId);

        if (!data.note) {
            throw new Error('Note de détail not found');
        }

        // 2. Determine sequence number for filename
        const sequence = await this.getNoteSequence(data.note.IDDossiers, noteId);

        // 3. Create PDF document (A3 landscape)
        const doc = new PDFDocument({
            size: 'A3',
            layout: 'landscape',
            margins: { top: 20, bottom: 20, left: 30, right: 30 }
        });

        // 4. Setup output file dynamically based on client
        const clientId = data.note.IDCLIENTS || 'misc';
        const clientNameSafe = (data.note.NomClient || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
        const dynamicOutputDir = path.join(__dirname, '..', 'uploads', 'clients', `${clientId}_${clientNameSafe}`, 'notes_detail');

        if (!fs.existsSync(dynamicOutputDir)) {
            fs.mkdirSync(dynamicOutputDir, { recursive: true });
        }

        // Sanitize code dossier to be safe for filenames
        const safeCode = (data.note.CodeDossier || 'ND').replace(/[^a-zA-Z0-9-_]/g, '-');
        const filename = `note_de_detail_${safeCode}_${sequence}.pdf`;
        const outputPath = path.join(dynamicOutputDir, filename);
        const writeStream = fs.createWriteStream(outputPath);
        doc.pipe(writeStream);

        // 5. Build PDF content
        await this.addHeader(doc, data);
        this.addInfoSection(doc, data);
        this.addArticlesMatrix(doc, data);
        this.addLiquidationSection(doc, data);

        // 6. Finalize
        doc.end();

        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve(outputPath));
            writeStream.on('error', reject);
        });
    }

    /**
     * Get the sequence number of this note within its dossier
     */
    async getNoteSequence(dossierId, noteId) {
        const connection = await this.pool.getConnection();
        try {
            // Count notes for this dossier that have a lower or equal ID (or CreatedDate)
            const [rows] = await connection.query(
                'SELECT COUNT(*) as count FROM notesdedetails WHERE IDDossiers = ? AND IDNotesDeDetails <= ?',
                [dossierId, noteId]
            );
            return rows[0].count;
        } finally {
            connection.release();
        }
    }

    /**
     * Fetch all data for the PDF
     */
    async fetchNoteData(noteId) {
        const connection = await this.pool.getConnection();
        try {
            const { getReferenceCurrency } = require('./deviseService');
            this.refSymbol = (await getReferenceCurrency()).Symbole;
            // Note de détail
            const [notes] = await connection.query(
                `SELECT nd.*, d.CodeDossier, d.Libelle, d.NatureDossier, d.ModeExpedition, d.IDCLIENTS,
                        c.NomRS as NomClient, c.NINEA as ClientNINEA,
                        bl.NumeroTitreTransport as NumeroBL
                 FROM notesdedetails nd
                 LEFT JOIN dossiers d ON nd.IDDossiers = d.IDDossiers
                 LEFT JOIN clients c ON d.IDCLIENTS = c.IDCLIENTS
                 LEFT JOIN billoflading bl ON d.IDDossiers = bl.idbl
                 WHERE nd.IDNotesDeDetails = ?`,
                [noteId]
            );

            if (notes.length === 0) {
                return { note: null };
            }

            const note = notes[0];

            // Get structure (company logo)
            const [structures] = await connection.query(
                'SELECT * FROM structur LIMIT 1'
            );
            const structure = structures.length > 0 ? structures[0] : null;

            // Get declarant (agent who processed the dossier)
            const [declarants] = await connection.query(
                `SELECT a.NomAgent 
                 FROM agents a
                 JOIN liaisondossiersdeclarants ld ON a.IDAgents = ld.idDeclarants
                 WHERE ld.IDDossiers = ?`,
                [note.IDDossiers]
            );
            const declarantName = declarants.length > 0 ? declarants.map(d => d.NomAgent).join(', ') : 'ND';

            // Get articles
            const [articles] = await connection.query(
                `SELECT a.*, 
                        dfob.Symbole as SymboleFOB, dfob.libelle as DeviseFOB,
                        dfret.Symbole as SymboleFret, dfret.libelle as DeviseFret,
                        dass.Symbole as SymboleAss, dass.libelle as DeviseAss
                 FROM articles a
                 LEFT JOIN devises dfob ON a.IDDEVISEFOB = dfob.IDDevises
                 LEFT JOIN devises dfret ON a.IDDEVISEFRET = dfret.IDDevises
                 LEFT JOIN devises dass ON a.IDDEVISEASS = dass.IDDevises
                 WHERE a.IDNotesDeDetails = ?
                 ORDER BY a.NumeroArticle`,
                [noteId]
            );

            // Get taxes codes for liquidation rows
            const [taxes] = await connection.query(
                `SELECT DISTINCT la.CodeTaxe, la.LibelleTaxe
                 FROM liquidations_articles la
                 JOIN articles a ON la.IDArticles = a.IDArticles
                 WHERE a.IDNotesDeDetails = ?
                 ORDER BY la.CodeTaxe`,
                [noteId]
            );

            // Get liquidations per article
            const liquidations = {};
            for (const article of articles) {
                const [liq] = await connection.query(
                    `SELECT CodeTaxe, Montant FROM liquidations_articles WHERE IDArticles = ?`,
                    [article.IDArticles]
                );
                liquidations[article.IDArticles] = {};
                liq.forEach(l => {
                    liquidations[article.IDArticles][l.CodeTaxe] = parseFloat(l.Montant || 0);
                });
            }

            // Get order transit info
            const [ordresTransit] = await connection.query(
                `SELECT NatureProduits, Nbredecolis, PoidsNet, ValeurMarchandise
                 FROM ordrestransit WHERE IDDossiers = ?`,
                [note.IDDossiers]
            );
            const ordreTransit = ordresTransit.length > 0 ? ordresTransit[0] : null;

            return {
                note,
                structure,
                declarantName,
                articles,
                taxes,
                liquidations,
                ordreTransit
            };

        } finally {
            connection.release();
        }
    }

    /**
     * Add header with logo and dossier info
     */
    async addHeader(doc, data) {
        const { note, structure, declarantName } = data;

        let logoX = 40;
        let logoHeight = 50;

        // Add logo if available
        if (structure) {
            if (structure.cheminlogo) {
                try {
                    const { downloadFile } = require('../utils/storage');
                    let key = structure.cheminlogo;
                    if (key.startsWith('uploads/')) key = key.slice(8);
                    const imgBuf = await downloadFile(key);
                    doc.image(imgBuf, 20, 20, { height: 50 });
                } catch (e) {
                    console.error('Error loading logo from R2:', e);
                }
            } else if (structure.logoSociete) {
                try {
                    const logoBuffer = Buffer.from(structure.logoSociete);
                    doc.image(logoBuffer, 20, 20, { height: 50 });
                } catch (err) {
                    console.error('Error adding logo BLOB:', err);
                }
            }
        }

        // Date on the right
        const today = new Date().toLocaleDateString('fr-FR');
        doc.fontSize(10).font('Helvetica').fillColor('black');
        // Give enough width to avoid wrapping
        doc.text(today, A3_WIDTH - 200, 25, { width: 170, align: 'right' });

        // Title Bar (Grey Background)
        const titleY = 70;
        doc.rect(0, titleY, A3_WIDTH, 30).fill('#cfd8dc'); // Light blue-grey
        doc.fontSize(18).font('Helvetica-Bold').fillColor('#1c4e80');
        doc.text('Note de détail', 0, titleY + 7, { align: 'center', width: A3_WIDTH });

        // Subheader (Dossier info)
        const subTitleY = titleY + 35;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('black');
        doc.text(
            `Dossier n° ${note.CodeDossier || 'ND'} client : ${note.NomClient || 'ND'} traité par ${declarantName}`,
            0, subTitleY,
            { align: 'center', width: A3_WIDTH }
        );
    }

    /**
     * Add info section (FOB, Fret, provenance, etc.)
     */
    addInfoSection(doc, data) {
        const { note, articles, ordreTransit } = data;

        // Calculate totals from articles
        let totalFOB = 0, totalFret = 0, totalAssDevise = 0, totalAssCFA = 0, totalColis = 0;
        let totalPoidsBrut = 0, totalPoidsNet = 0;
        let symboleFOB = '', symboleFret = '', symboleAss = '';

        articles.forEach((a, i) => {
            totalFOB += parseFloat(a.FOB || 0);
            totalFret += parseFloat(a.FRET || 0);
            totalAssDevise += parseFloat(a.ASSURANCES || 0);
            totalAssCFA += parseFloat(a.ASSURANCESCFA || 0);
            totalColis += parseInt(a.NBCOLIS || 0);
            totalPoidsBrut += parseFloat(a.BRUT || 0);
            totalPoidsNet += parseFloat(a.NET || 0);
            if (i === 0) {
                symboleFOB = a.SymboleFOB || '';
                symboleFret = a.SymboleFret || '';
                symboleAss = a.SymboleAss || '';
            }
        });

        // The header label "Assurances: X FC" must show the FC-converted total,
        // not the devise total. We prefer the sum of ASSURANCESCFA across articles
        // (which is what's displayed in the matrix as "Assurances"). Fall back to
        // MontantAssurancesTotalDevise only if no per-article converted values exist.
        const assuranceCFA = totalAssCFA || note.MontantAssurancesTotalDevise || totalAssDevise;

        const startY = 135;
        doc.fontSize(9).font('Helvetica');
        doc.fillColor('black');

        // Column X positions
        const col1 = 60, col2 = 350, col3 = 600, col4 = 850;
        const rowHeight = 15;

        // Row 1
        let y = startY;
        doc.font('Helvetica-Bold').text('FOB en devises:', col1, y);
        doc.font('Helvetica').text(`${this.formatNumber(totalFOB)} ${symboleFOB}`, col1 + 100, y);

        doc.font('Helvetica-Bold').text('Fret en devises:', col2, y);
        doc.font('Helvetica').text(`${this.formatNumber(totalFret)} ${symboleFret}`, col2 + 100, y);

        doc.font('Helvetica-Bold').text('Valeur march:', col3, y); // Using Data from OrdreTransit if available
        doc.font('Helvetica').text(ordreTransit?.ValeurMarchandise || 'ND', col3 + 80, y);

        doc.font('Helvetica-Bold').text('Assurances:', col4, y);
        doc.font('Helvetica').text(`${this.formatNumber(assuranceCFA)} ${this.refSymbol}`, col4 + 70, y);

        // Row 2
        y += rowHeight;
        doc.font('Helvetica-Bold').text('Provenance:', col1, y);
        doc.font('Helvetica').text(note.CodeProvenance || 'ND', col1 + 100, y);

        doc.font('Helvetica-Bold').text('Nbre de colis:', col2, y);
        doc.font('Helvetica').text(`${totalColis}`, col2 + 100, y);

        doc.font('Helvetica-Bold').text('Poids brut:', col3, y);
        doc.font('Helvetica').text(`${this.formatNumber(totalPoidsBrut)}`, col3 + 80, y);

        doc.font('Helvetica-Bold').text('NINEA:', col4, y);
        doc.font('Helvetica').text(note.NINEA || note.ClientNINEA || 'ND', col4 + 100, y);

        // Row 3
        y += rowHeight;
        doc.font('Helvetica-Bold').text('Type manifeste:', col1, y);
        const modeLabel = note.ModeExpedition === 'MA' ? 'Maritime' : note.ModeExpedition === 'AE' ? 'Aérien' : 'Terrestre';
        doc.font('Helvetica').text(modeLabel, col1 + 100, y);

        doc.font('Helvetica-Bold').text('Répertoire:', col2, y);
        doc.font('Helvetica').text(note.REPERTOIRE || 'ND', col2 + 100, y);

        doc.font('Helvetica-Bold').text('Poids net:', col3, y);
        doc.font('Helvetica').text(`${this.formatNumber(totalPoidsNet)}`, col3 + 80, y);

        doc.font('Helvetica-Bold').text('N° BL:', col4, y);
        doc.font('Helvetica').text(note.NumeroBL || 'ND', col4 + 100, y);

        // Add a line below info
        doc.moveTo(30, y + 20).lineTo(A3_WIDTH - 30, y + 20).stroke('black');
    }

    /**
     * Add articles matrix table
     * Grid style similar to Excel (borders)
     * Always renders 11 article columns + Labels
     */
    addArticlesMatrix(doc, data) {
        const { articles } = data;

        const startX = 30;
        const startY = 200;
        // Total width available approx 1190 - 60 = 1130
        const labelColWidth = 140;
        const articleColWidth = 85;
        const rowHeight = 15;

        // Define fields to display
        const fields = [
            { key: 'NTS', label: 'Position tarifaire' },
            { key: 'CodeRegimeDeclaration', label: 'Régime' },
            { key: 'DPI', label: 'DPI' },
            { key: 'TitreExo', label: 'Titre Exo' },
            { key: 'Origine', label: 'Origine' },
            { key: 'Provenance', label: 'Provenance' },
            { key: 'FOB', label: 'Valeur FOB devises', format: 'number' },
            { key: 'DeviseFOB', label: 'Devise FOB', fromSymbol: 'SymboleFOB' },
            { key: 'FOBCFA', label: 'Valeur FOB en UM', format: 'number' }, // UM = Unité Monétaire = Franc Congolais
            { key: 'FRETCFA', label: 'Valeur Fret en UM', format: 'number' },
            { key: 'ASSURANCESCFA', label: 'Assurances', format: 'number' },
            { key: 'CommissionFournisseur', label: 'Commission en UM', format: 'number' },
            { key: 'CAF', label: 'Valeur CAF en UM', format: 'number' },
            { key: 'NBCOLIS', label: 'Nbre colis' },
            { key: 'BRUT', label: 'Poids brut', format: 'number' },
            { key: 'NET', label: 'Poids net', format: 'number' },
            { key: 'QC', label: 'Quantité complémentaire', format: 'number' },
            { key: 'QM', label: 'Quantité mercuriale', format: 'number' }
        ];

        // Header row
        let x = startX;
        let y = startY;

        // Function to draw cell
        const drawCell = (x, y, w, h, text, isHeader = false, align = 'left', bold = false) => {
            doc.rect(x, y, w, h).stroke('black'); // Black border
            if (bold || isHeader) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
            doc.fontSize(8);
            doc.fillColor('black');
            doc.text(text || '', x + 2, y + 4, { width: w - 4, align: align });
        };

        // Header: Article Columns
        // Empty top-left cell
        drawCell(x, y, labelColWidth, rowHeight, '', true);
        x += labelColWidth;

        // Always 11 columns
        for (let i = 0; i < 11; i++) {
            drawCell(x, y, articleColWidth, rowHeight, `Article ${i + 1}`, true, 'center');
            x += articleColWidth;
        }

        y += rowHeight;

        // Data Rows
        fields.forEach((field, rowIndex) => {
            x = startX;
            // Label
            drawCell(x, y, labelColWidth, rowHeight, field.label, true);
            x += labelColWidth;

            // Values
            for (let i = 0; i < 11; i++) {
                const article = articles[i]; // May be undefined if i >= articles.length
                let value = '';

                if (article) {
                    if (field.fromSymbol) {
                        value = article[field.fromSymbol] || '';
                    } else {
                        value = article[field.key];
                    }

                    if (field.format === 'number' && value !== null && value !== undefined) {
                        value = this.formatNumber(parseFloat(value || 0));
                    }
                }

                // Align numbers right, others left
                const align = (article && field.format === 'number') ? 'right' : 'left';
                drawCell(x, y, articleColWidth, rowHeight, String(value || ''), false, align);
                x += articleColWidth;
            }
            y += rowHeight;
        });

        // Store Y position for liquidation section
        this.articlesEndY = y;
    }

    /**
     * Add liquidation section with taxes
     */
    addLiquidationSection(doc, data) {
        const { articles, taxes, liquidations } = data;

        const startX = 30;
        let y = this.articlesEndY + 15; // Small gap
        const labelColWidth = 140;
        const articleColWidth = 85;
        const rowHeight = 15;

        // Section header
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1c4e80');
        doc.text('LIQUIDATION', startX, y - 12);

        // Function to draw cell
        const drawCell = (x, y, w, h, text, align = 'left', bold = false, bgColor = null, textColor = 'black', borderColor = 'black') => {
            if (bgColor) {
                doc.rect(x, y, w, h).fillAndStroke(bgColor, borderColor);
            } else {
                doc.rect(x, y, w, h).stroke(borderColor);
            }
            if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
            doc.fontSize(8);
            doc.fillColor(textColor);
            doc.text(text || '', x + 2, y + 4, { width: w - 4, align: align });
        };

        // Header Row
        let x = startX;
        drawCell(x, y, labelColWidth, rowHeight, 'Taxes', 'left', true, '#1c4e80', 'white');
        x += labelColWidth;

        for (let i = 0; i < 11; i++) {
            drawCell(x, y, articleColWidth, rowHeight, `Art. ${i + 1}`, 'center', true, '#1c4e80', 'white');
            x += articleColWidth;
        }

        // Cumul Header
        drawCell(x, y, articleColWidth, rowHeight, 'Cumul', 'center', true, '#2e7d32', 'white');

        y += rowHeight;

        // Tax rows
        let grandTotal = 0;
        const articleTotals = {};

        taxes.forEach((tax, rowIndex) => {
            x = startX;
            const bgColor = rowIndex % 2 === 0 ? '#f8f8f8' : '#ffffff';

            // Tax label
            drawCell(x, y, labelColWidth, rowHeight, `${tax.CodeTaxe} - ${tax.LibelleTaxe}`, 'left', true, '#e8e8e8');
            x += labelColWidth;

            // Tax amounts per article
            let rowTotal = 0;
            for (let i = 0; i < 11; i++) {
                const article = articles[i];
                let amount = 0;

                if (article) {
                    amount = liquidations[article.IDArticles]?.[tax.CodeTaxe] || 0;
                    if (!articleTotals[article.IDArticles]) articleTotals[article.IDArticles] = 0;
                    articleTotals[article.IDArticles] += amount;
                }

                rowTotal += amount;

                const text = amount !== 0 ? this.formatNumber(amount) : '';
                drawCell(x, y, articleColWidth, rowHeight, text, 'right', false, bgColor);
                x += articleColWidth;
            }

            // Row Total (Cumul) - RESTORED!
            grandTotal += rowTotal;
            drawCell(x, y, articleColWidth, rowHeight, this.formatNumber(rowTotal), 'right', true, '#e8f5e9', '#2e7d32', '#2e7d32');

            y += rowHeight;
        });

        // Total Row
        x = startX;
        drawCell(x, y, labelColWidth, rowHeight, 'TOTAL', 'left', true, '#1c4e80', 'white');
        x += labelColWidth;

        for (let i = 0; i < 11; i++) {
            const article = articles[i];
            const total = article ? (articleTotals[article.IDArticles] || 0) : 0;
            const text = total !== 0 ? this.formatNumber(total) : '';

            drawCell(x, y, articleColWidth, rowHeight, text, 'right', true, '#e3f2fd', '#1c4e80');
            x += articleColWidth;
        }

        // Grand Total Cell
        drawCell(x, y, articleColWidth, rowHeight, this.formatNumber(grandTotal), 'right', true, '#2e7d32', 'white');
    }

    /**
     * Format number with thousand separators
     */
    formatNumber(num) {
        if (num === null || num === undefined || isNaN(num)) return '';
        return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }
}

module.exports = NoteDetailPDFGenerator;
