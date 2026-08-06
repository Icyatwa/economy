// controllers/adminController.js
const UserAccount = require('../models/UserAccount');
const Comment     = require('../models/Comment');
const News        = require('../models/News');
const { Stock, Forex, Good } = require('../models/MarketData');

// ─── GET all regular users ────────────────────────────────────────────────────
exports.getAllUsers = async (req, res) => {
  try { 
    const { search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name:  { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await UserAccount.countDocuments(query);
    const users = await UserAccount.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    // For each user, attach a quick comment count
    const userIds = users.map(u => u._id);
    const commentCounts = await Comment.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(commentCounts.map(c => [c._id.toString(), c.count]));

    const usersWithStats = users.map(u => ({
      ...u.toObject(),
      commentCount: countMap[u._id.toString()] || 0,
    }));

    res.status(200).json({
      users: usersWithStats,
      pagination: {
        current: Number(page),
        total: Math.ceil(total / limit),
        count: total,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ─── GET one user + their full comment/reply history ─────────────────────────
exports.getUserDetail = async (req, res) => {
  try {
    const user = await UserAccount.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const comments = await Comment.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Threads where they replied (but didn't start)
    const repliedThreads = await Comment.find({
      'replies.user': user._id,
      user: { $ne: user._id }, // exclude their own root comments
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.status(200).json({
      user,
      comments,
      repliedThreads,
      stats: {
        totalComments: comments.length,
        repliedInThreads: repliedThreads.length,
        newsComments:   comments.filter(c => c.sourceType === 'news').length,
        marketComments: comments.filter(c => c.sourceType === 'market').length,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ─── GET all conversations (comments) with what they are discussing ───────────
// Returns paginated comment threads enriched with source context
exports.getAllConversations = async (req, res) => {
  try {
    const { sourceType, page = 1, limit = 30, search } = req.query;

    const match = {};
    if (sourceType && sourceType !== 'all') match.sourceType = sourceType;
    if (search) match.text = { $regex: search, $options: 'i' };

    const total  = await Comment.countDocuments(match);
    const comments = await Comment.find(match)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    // Resolve news titles for news comments
    const newsIds = [...new Set(
      comments.filter(c => c.sourceType === 'news' && c.newsId).map(c => c.newsId.toString())
    )];
    const newsMap = {};
    if (newsIds.length) {
      const articles = await News.find({ _id: { $in: newsIds } })
        .select('title category status')
        .lean();
      articles.forEach(a => { newsMap[a._id.toString()] = a; });
    }

    // Resolve market items for market comments (live docs only; archived fall back gracefully)
    const marketLookups = [
      ...new Set(
        comments
          .filter(c => c.sourceType === 'market' && c.sym && c.marketType)
          .map(c => `${c.marketType}:${c.sym}`)
      ),
    ];
    const ModelMap = { stocks: Stock, forex: Forex, goods: Good };
    const marketMap = {};
    await Promise.all(
      marketLookups.map(async key => {
        const [type, sym] = key.split(':');
        const Model = ModelMap[type];
        if (!Model) return;
        const item = await Model.findOne({ sym, archived: { $ne: true } })
          .select('sym name price change chgDir')
          .lean();
        marketMap[key] = item || { sym, name: sym };
      })
    );

    const enriched = comments.map(c => {
      if (c.sourceType === 'news') {
        const article = newsMap[c.newsId?.toString()] || null;
        return {
          ...c,
          sourceContext: {
            type: 'news',
            title: article?.title || c.newsTitle || 'Unknown Article',
            category: article?.category || null,
            status:   article?.status  || null,
            newsId:   c.newsId,
          },
        };
      }
      const key = `${c.marketType}:${c.sym}`;
      const item = marketMap[key] || null;
      return {
        ...c,
        sourceContext: {
          type:       'market',
          marketType: c.marketType,
          sym:        c.sym,
          name:       item?.name  || c.sym,
          price:      item?.price || null,
          chgDir:     item?.chgDir || null,
        },
      };
    });

    res.status(200).json({
      comments: enriched,
      pagination: {
        current: Number(page),
        total:   Math.ceil(total / limit),
        count:   total,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ─── GET news article history (all statuses, all time) ───────────────────────
exports.getNewsHistory = async (req, res) => {
  try {
    const { category, status, search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (category && category !== 'all') query.category = category;
    if (status   && status   !== 'all') query.status   = status;
    if (search) {
      query.$or = [
        { title:   { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } },
        { author:  { $regex: search, $options: 'i' } },
      ];
    }

    const total = await News.countDocuments(query);
    const articles = await News.find(query)
      .select('title summary author date status category featured wasEdited editedAt createdAt updatedAt image')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    // Attach comment count per article
    const articleIds = articles.map(a => a._id);
    const commentCounts = await Comment.aggregate([
      { $match: { sourceType: 'news', newsId: { $in: articleIds } } },
      { $group: { _id: '$newsId', count: { $sum: 1 } } },
    ]);
    const ccMap = Object.fromEntries(commentCounts.map(c => [c._id.toString(), c.count]));

    const enriched = articles.map(a => ({
      ...a,
      commentCount: ccMap[a._id.toString()] || 0,
    }));

    // Aggregate totals for summary bar
    const [totals] = await News.aggregate([
      {
        $facet: {
          byStatus:   [{ $group: { _id: '$status',   n: { $sum: 1 } } }],
          byCategory: [{ $group: { _id: '$category', n: { $sum: 1 } } }],
          total:      [{ $count: 'n' }],
        },
      },
    ]);
    const byStatus   = Object.fromEntries((totals.byStatus   || []).map(x => [x._id, x.n]));
    const byCategory = Object.fromEntries((totals.byCategory || []).map(x => [x._id, x.n]));

    res.status(200).json({
      articles: enriched,
      pagination: {
        current: Number(page),
        total:   Math.ceil(total / limit),
        count:   total,
      },
      summary: {
        total:      totals.total[0]?.n || 0,
        byStatus,
        byCategory,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ─── GET market data history (live + archived) ───────────────────────────────
exports.getMarketHistory = async (req, res) => {
  try {
    const { type, search, includeArchived = 'true', page = 1, limit = 30 } = req.query;

    const ModelMap = { stocks: Stock, forex: Forex, goods: Good };
    const types = type && type !== 'all' ? [type] : ['stocks', 'forex', 'goods'];

    const showArchived = includeArchived !== 'false';

    const results = await Promise.all(
      types.map(async t => {
        const Model = ModelMap[t];
        if (!Model) return [];
        const match = {};
        if (!showArchived) match.archived = { $ne: true };
        if (search) {
          match.$or = [
            { sym:  { $regex: search, $options: 'i' } },
            { name: { $regex: search, $options: 'i' } },
          ];
        }
        const items = await Model.find(match)
          .sort({ archived: 1, sym: 1, updatedAt: -1 })
          .lean();
        return items.map(i => ({ ...i, _type: t }));
      })
    );

    const allItems = results.flat();

    // Pagination on the merged set
    const total    = allItems.length;
    const start    = (page - 1) * limit;
    const pageItems = allItems.slice(start, start + Number(limit));

    // Attach comment counts per sym
    const syms = [...new Set(pageItems.map(i => i.sym))];
    const commentCounts = await Comment.aggregate([
      { $match: { sourceType: 'market', sym: { $in: syms } } },
      { $group: { _id: { sym: '$sym', marketType: '$marketType' }, count: { $sum: 1 } } },
    ]);
    const ccMap = {};
    commentCounts.forEach(c => {
      ccMap[`${c._id.marketType}:${c._id.sym}`] = c.count;
    });

    const enriched = pageItems.map(i => ({
      ...i,
      commentCount: ccMap[`${i._type}:${i.sym}`] || 0,
    }));

    // Summary counts
    const summary = {};
    for (const t of ['stocks', 'forex', 'goods']) {
      const Model = ModelMap[t];
      if (!Model) continue;
      const [live, archived] = await Promise.all([
        Model.countDocuments({ archived: { $ne: true } }),
        Model.countDocuments({ archived: true }),
      ]);
      summary[t] = { live, archived, total: live + archived };
    }

    res.status(200).json({
      items: enriched,
      pagination: {
        current: Number(page),
        total:   Math.ceil(total / limit),
        count:   total,
      },
      summary,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ─── Clear content data (and optionally public user accounts) ────────────────
// Admin (User) accounts are never touched by this — there is no recovery path
// in the UI if the logged-in admin's own account got wiped mid-session.
exports.clearData = async (req, res) => {
  try {
    const { includeUserAccounts, confirm } = req.body || {};
    if (confirm !== 'CLEAR DATA') {
      return res.status(400).json({ message: 'Confirmation phrase does not match. Send confirm: "CLEAR DATA" to proceed.' });
    }

    const [newsResult, commentResult, stockResult, forexResult, goodResult] = await Promise.all([
      News.deleteMany({}),
      Comment.deleteMany({}),
      Stock.deleteMany({}),
      Forex.deleteMany({}),
      Good.deleteMany({}),
    ]);

    let userAccountResult = { deletedCount: 0 };
    if (includeUserAccounts) {
      userAccountResult = await UserAccount.deleteMany({});
    }

    res.status(200).json({
      message: 'Data cleared',
      deleted: {
        news:         newsResult.deletedCount,
        comments:     commentResult.deletedCount,
        stocks:       stockResult.deletedCount,
        forex:        forexResult.deletedCount,
        goods:        goodResult.deletedCount,
        userAccounts: userAccountResult.deletedCount,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
// ─── One-time cleanup: normalize old-format article content ──────────────────
// Early drafts wrote "Headline: ... / Description: ... / What happened: ..."
// as literal labels inside the content body, duplicating the title/summary
// fields. This finds any article still in that shape, drops the duplicate
// headline/description paragraphs, and turns the section labels into real
// "## Sub-header" markers. Only touches docs that start with "Headline:" —
// anything already reformatted (or never in that shape) is left untouched.
const LEGACY_LABEL_RE = /(Headline|Description|What happened|Why it['’]s happening|What it means for Rwanda|Sources):\s*/gi;

exports.normalizeArticleContent = async (req, res) => {
  try {
    const candidates = await News.find({ content: /^\s*Headline:/i });
    const updated = [];

    for (const doc of candidates) {
      const matches = [...doc.content.matchAll(LEGACY_LABEL_RE)];
      if (!matches.length) continue;

      const sections = {};
      matches.forEach((m, i) => {
        const key = m[1].toLowerCase().replace(/[’]/g, "'");
        const start = m.index + m[0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index : doc.content.length;
        sections[key] = doc.content.slice(start, end).trim();
      });

      const parts = [];
      if (sections['what happened'])              parts.push(`## What happened\n\n${sections['what happened']}`);
      if (sections["why it's happening"])          parts.push(`## Why it's happening\n\n${sections["why it's happening"]}`);
      if (sections['what it means for rwanda'])    parts.push(`## What it means for Rwanda\n\n${sections['what it means for rwanda']}`);
      if (sections['sources'])                     parts.push(`Sources: ${sections['sources']}`);

      if (!parts.length) continue; // couldn't confidently parse — leave it alone

      doc.content = parts.join('\n\n');
      await doc.save();
      updated.push({ id: doc._id, title: doc.title });
    }

    res.status(200).json({
      message: `Normalized ${updated.length} of ${candidates.length} matching article(s)`,
      updated,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
