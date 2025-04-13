// src/models/News.js
const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  summary: {
    type: String,
    required: [true, 'Summary is required'],
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Content is required']
  },
  author: {
    type: String,
    required: [true, 'Author is required']
  },
  date: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'review'],
    default: 'draft'
  },
  category: {
    type: String,
    enum: ['growth', 'investment', 'trade', 'policy', 'other'],
    required: [true, 'Category is required']
  },
  featured: {
    type: Boolean,
    default: false
  },
  image: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

newsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const News = mongoose.model('News', newsSchema);

module.exports = News;