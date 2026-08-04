// routes/bulkImportRoutes.js
const express = require('express');
const router  = express.Router();
const { bulkImport } = require('../controllers/bulkImportController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);
router.post('/', bulkImport);

module.exports = router;
