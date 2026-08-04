// routes/adminRoutes.js
const express = require('express');
const router  = express.Router();
const {
  getAllUsers,
  getUserDetail,
  getAllConversations,
  getNewsHistory,
  getMarketHistory,
  clearData,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);
router.get('/users',            getAllUsers);
router.get('/users/:userId',    getUserDetail);
router.get('/conversations',    getAllConversations);
router.get('/news-history',     getNewsHistory);
router.get('/market-history',   getMarketHistory);
router.post('/clear-data',      clearData);

module.exports = router;