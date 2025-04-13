// src/routes/newsRoutes.js
const express = require('express');
const router = express.Router();
const { 
  getAllNews, 
  getNewsById, 
  createNews, 
  updateNews, 
  deleteNews,
  getDashboardStats,
  getPublishedNews,
  getPublishedNewsById
} = require('../controllers/newsController');
const { protect, adminOnly } = require('../middleware/auth');

// Public routes
router.get('/published', getPublishedNews);
router.get('/published/:id', getPublishedNewsById); // Using the new function

// Protected routes (for admins)
router.get('/', protect, adminOnly, getAllNews);
router.post('/', protect, adminOnly, createNews);
router.get('/dashboard/stats', protect, adminOnly, getDashboardStats);
router.get('/:id', protect, getNewsById); // Admin can access any article
router.put('/:id', protect, adminOnly, updateNews);
router.delete('/:id', protect, adminOnly, deleteNews);
module.exports = router;