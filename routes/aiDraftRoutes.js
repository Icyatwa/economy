// routes/aiDraftRoutes.js
const express = require('express');
const router  = express.Router();
const { generateDraft } = require('../controllers/aiDraftController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);
router.post('/generate', generateDraft);

module.exports = router;
