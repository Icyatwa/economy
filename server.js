// server.js
const dotenv = require('dotenv');
dotenv.config(); // ← must be first, before any other requires

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userAuthRoutes = require('./routes/userAuthRoutes');
const newsRoutes = require('./routes/newsRoutes');
const marketDataRoutes = require('./routes/marketDataRoutes');
const commentRoutes = require('./routes/commentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const bulkImportRoutes = require('./routes/bulkImportRoutes');
const errorHandler = require('./middleware/errorHandler');
const { warmCache } = require('./controllers/newsController');
 
const app = express();

app.use(compression());

const corsOptions = {
  origin: (origin, callback) => {
    const allowed = [
      'https://palanomic.com',
      'palanomic.com', 
      'https://www.palanomic.com',
      'www.palanomic.com',
      'https://admin.palanomic.com',
      'https://addnfjdnfkdjnjkvdnjkvndfkj.palanomic.com',
      'www.addnfjdnfkdjnjkvdnjkvndfkj.palanomic.com',
      'addnfjdnfkdjnjkvdnjkvndfkj.palanomic.com',
      'https://addnfjdnfkdjnjkvdnjkvndfkj.palanomic.com/',
      'https://zemu-admin-panel.vercel.app/',
      'https://zemu-admin-panel.vercel.app',
      'https://www.zemu-admin-panel.vercel.app',
      'https://palanomic-frontend.vercel.app/',
      'https://palanomic-frontend.vercel.app',
      'https://www.palanomic-frontend.vercel.app',
      'http://localhost:3000',
    ];
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: new Date() }));

// Routes
app.use('/api/auth',        authRoutes);
app.use('/api/users/auth',  userAuthRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/news',        newsRoutes);
app.use('/api/market',      marketDataRoutes);
app.use('/api/comments',    commentRoutes);
app.use('/api/upload',      uploadRoutes);
app.use('/api/bulk',        bulkImportRoutes);

// ── Open Graph / Twitter Card route ──────────────────────────────────────────
// When X (Twitter) or any crawler visits /article/:id, this returns a full HTML
// page with proper og: and twitter: meta tags so the card preview works.
// Regular users are redirected to the React frontend immediately.
const News = require('./models/News');

app.get('/article/:id', async (req, res) => {
  try {
    const news = await News.findOne({ _id: req.params.id, status: 'published' });

    if (!news) {
      return res.redirect('https://palanomic.com');
    }

    const title       = news.title || 'Palanomic';
    const description = news.summary || 'Finance and economy news from Rwanda and East Africa.';
    const image       = news.image  || 'https://palanomic.com/og-default.jpg';
    const url         = `https://palanomic.com/article/${news._id}`;

    // Detect bots/crawlers by User-Agent
    const ua = req.headers['user-agent'] || '';
    const isCrawler = /twitterbot|facebookexternalhit|linkedinbot|whatsapp|telegrambot|slackbot|discordbot|googlebot|bingbot/i.test(ua);

    if (!isCrawler) {
      // Real user → send them straight to the React frontend
      return res.redirect(`https://palanomic.com/article/${news._id}`);
    }

    // Crawler → return HTML with full meta tags
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>

  <!-- Open Graph -->
  <meta property="og:type"        content="article" />
  <meta property="og:site_name"   content="Palanomic" />
  <meta property="og:title"       content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image"       content="${image}" />
  <meta property="og:url"         content="${url}" />

  <!-- Twitter / X Card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:site"        content="@PalanoMic" />
  <meta name="twitter:title"       content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image"       content="${image}" />

  <meta http-equiv="refresh" content="0;url=${url}" />
</head>
<body>
  <p>Loading article... <a href="${url}">Click here if not redirected</a></p>
</body>
</html>`);

  } catch (err) {
    console.error('OG route error:', err);
    return res.redirect('https://palanomic.com');
  }
});
// ─────────────────────────────────────────────────────────────────────────────

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
warmCache();
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});