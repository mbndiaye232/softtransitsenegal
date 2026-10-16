const multer = require('multer');

// Memory storage — le fichier est ensuite écrit par utils/storage.js
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|zip|txt)$/i)) {
            return cb(new Error('Type de fichier non autorisé'), false);
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

module.exports = upload;
