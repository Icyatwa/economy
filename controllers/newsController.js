// src/controllers/newsController.js
const News = require('../models/News');

// Redis client setup
let redisClient = null;

// Cache configuration (kept for future use)
const CACHE_EXPIRY = {
  PUBLISHED_NEWS: 300, // 5 minutes
  DASHBOARD_STATS: 180, // 3 minutes
  SEARCH_RESULTS: 120,  // 2 minutes
};

// Helper function for cache operations
const cacheGet = async (key) => {
  return null; // Always return null when Redis is disabled
};

const cacheSet = async (key, data, expiry = 300) => {
  return; // No-op when Redis is disabled
};


const cacheDelete = async (pattern) => {
  if (!redisClient) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.warn('Cache delete error:', error);
  }
};

// Optimized database queries with proper indexing hints
const optimizeQuery = (query) => {
  // Add hints for MongoDB to use proper indexes
  return query.hint({ status: 1, createdAt: -1 });
};

exports.getAllNews = async (req, res) => {
  try {
    const { category, status, search, page = 1, limit = 10 } = req.query;
    const query = {};

    if (category && category !== 'all') query.category = category;
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await News.countDocuments(query);
    const news = await News.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      news,
      pagination: {
        current: Number(page),
        total: Math.ceil(total / limit),
        count: total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getNewsById = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }
    res.status(200).json(news);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.createNews = async (req, res) => {
  try {
    const newsData = {
      ...req.body,
      createdBy: req.user._id
    };

    const news = await News.create(newsData);
    res.status(201).json(news);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.updateNews = async (req, res) => {
  try {
    const news = await News.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    res.status(200).json(news);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.deleteNews = async (req, res) => {
  try {
    const news = await News.findByIdAndDelete(req.params.id);
    
    if (!news) {
      return res.status(404).json({ message: 'News not found' });
    }

    res.status(200).json({ message: 'News deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const totalArticles = await News.countDocuments();
    const publishedArticles = await News.countDocuments({ status: 'published' });
    const draftArticles = await News.countDocuments({ status: 'draft' });
    
    const categories = {
      growth: await News.countDocuments({ category: 'growth' }),
      investment: await News.countDocuments({ category: 'investment' }),
      trade: await News.countDocuments({ category: 'trade' }),
      policy: await News.countDocuments({ category: 'policy' })
    };

    const recentActivity = await News.find()
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('title status updatedAt createdBy');

    res.status(200).json({
      totalArticles,
      publishedArticles,
      draftArticles,
      categories,
      recentActivity
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getPublishedNews = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 10 } = req.query;
    const query = { status: 'published' }; // Only fetch published news

    if (category && category !== 'all') query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await News.countDocuments(query);
    const news = await News.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({
      news,
      pagination: {
        current: Number(page),
        total: Math.ceil(total / limit),
        count: total
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getPublishedNewsById = async (req, res) => {
  try {
    const news = await News.findOne({ 
      _id: req.params.id,
      status: 'published' // Only return published articles
    });
    
    if (!news) {
      return res.status(404).json({ message: 'News article not found' });
    }
    
    res.status(200).json(news);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// New endpoint for prefetching
exports.prefetchNews = async (req, res) => {
  try {
    res.status(200).json({ message: 'Prefetch not available without Redis' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Cache warming function (no-op without Redis)
exports.warmCache = async () => {
  console.log('Cache warming skipped - Redis not available');
  return;
};