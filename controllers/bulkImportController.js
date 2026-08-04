// controllers/bulkImportController.js
const News = require('../models/News');
const { Stock, Forex, Good } = require('../models/MarketData');

const getModel = (type) => {
  if (type === 'stocks') return Stock;
  if (type === 'forex')  return Forex;
  if (type === 'goods')  return Good;
  return null;
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function runBatch(items, fn) {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const item of items) {
    try {
      const result = await fn(item);
      out.push({ ok: true, ...result });
    } catch (err) {
      out.push({ ok: false, error: err.message, input: item });
    }
  }
  return out;
}

async function processArticle(item, userId) {
  const title = (item.title || '').trim();
  if (!title) throw new Error('title is required');

  const created = await News.create({
    title,
    summary: (item.summary || '').trim(),
    content: item.content || '',
    author: (item.author || '').trim(),
    category: item.category,
    featured: !!item.featured,
    image: item.image || '',
    status: 'draft', // bulk-imported articles always land as drafts for review
    createdBy: userId,
  });

  return { title: created.title, id: created._id, action: 'created' };
}

// Mirrors marketDataController's Edit / New Data / Create rules for one item.
async function processMarketItem(Model, item) {
  const sym = (item.sym || '').trim().toUpperCase();
  if (!sym) throw new Error('sym is required');
  const name = (item.name || '').trim();
  if (!name) throw new Error('name is required');

  const live = await Model.findOne({ sym, archived: { $ne: true } });

  if (item.metadataOnly) {
    if (!live) throw new Error(`metadataOnly item "${sym}" has no existing live record to edit`);
    const update = { ...item, sym, name, updatedAt: new Date() };
    delete update.metadataOnly;
    const updated = await Model.findByIdAndUpdate(live._id, update, { new: true, runValidators: true });
    return { sym, id: updated._id, action: 'edit' };
  }

  if (live) {
    // New Data: archive the current doc, publish a fresh one with the same identity
    await Model.findByIdAndUpdate(live._id, { archived: true, archivedAt: new Date() });

    const { price, raw, change, chgNum, chgDir, explain, eli5 } = item;
    const freshDoc = {
      sym: live.sym,
      name: live.name,
      price, raw, change, chgNum, chgDir,
      explain: explain || '',
      eli5: eli5 || '',
      archived: false,
      updatedAt: new Date(),
    };
    if (live.sector) freshDoc.sector = item.sector || live.sector;
    if (live.flag)   freshDoc.flag   = item.flag   || live.flag;

    const created = await Model.create(freshDoc);
    return { sym, id: created._id, action: 'new-data' };
  }

  // No live doc — creating a brand-new listing. Block symbols retired via New Data.
  const anyExisting = await Model.findOne({ sym });
  if (anyExisting) {
    throw new Error(`sym "${sym}" was previously retired (archived) — cannot recreate it`);
  }
  const nameDup = await Model.findOne({
    name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' },
    archived: { $ne: true },
  });
  if (nameDup) throw new Error(`name "${name}" already exists as ${nameDup.sym}`);

  const create = { ...item, sym, name, updatedAt: new Date() };
  delete create.metadataOnly;
  const created = await Model.create(create);
  return { sym, id: created._id, action: 'created' };
}

exports.bulkImport = async (req, res) => {
  try {
    const { articles = [], stocks = [], forex = [], goods = [] } = req.body || {};

    const results = {
      articles: await runBatch(articles, (item) => processArticle(item, req.user._id)),
      stocks:   await runBatch(stocks,   (item) => processMarketItem(getModel('stocks'), item)),
      forex:    await runBatch(forex,    (item) => processMarketItem(getModel('forex'),  item)),
      goods:    await runBatch(goods,    (item) => processMarketItem(getModel('goods'),  item)),
    };

    const summary = Object.fromEntries(
      Object.entries(results).map(([key, arr]) => [
        key,
        { total: arr.length, ok: arr.filter((r) => r.ok).length, failed: arr.filter((r) => !r.ok).length },
      ])
    );

    res.status(200).json({ summary, results });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
