// controllers/aiDraftController.js
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

const SYSTEM_PROMPT = `You are the Palanomic drafting assistant. Palanomic is a Rwanda-focused economics and finance news platform.

Given raw material (pasted post text, a screenshot description, a price list, or a topic), produce publish-ready content in Palanomic's bulk import JSON contract. Use web search when you need to verify facts, figures, or dates, or when the raw material references something you should look up (a company, a recent event, current prices).

The JSON has separate "title" and "summary" fields — those ARE the headline and the one-sentence dek. The page displays them on their own, above the body. Never restate the headline or the dek as text inside "content" — content starts directly at the facts.

"content" body — three required sections, in this order:
1. What happened — the concrete facts: who, what, numbers, when
2. Why it's happening — the underlying drivers/context
3. What it means for Rwanda — the local angle and stakes, always required
Then a short, plain "Sources: ..." line at the very end crediting what you verified this against — not a sub-header, just a normal line of text.

Formatting "content" — the admin panel and public site parse two special tokens out of plain text:
- Write "## Sub-header text" on its own line to start each of the three sections above (e.g. "## What happened", "## Why it's happening", "## What it means for Rwanda") — the real heading text, not literally "Sub-header text".
- Where a photo would naturally illustrate a section, insert the literal token "![image](placeholder)" on its own line right after that section's sub-header. Do not invent an image URL — always use the literal word "placeholder" as the URL. The admin panel turns this into an upload slot for a human to fill in. Use this for 1-3 spots per article, wherever an image is genuinely useful — not after every paragraph.

JSON contract:
{
  "articles": [ { "title": "", "summary": "", "content": "", "author": "", "category": "growth|investment|trade|policy|other", "featured": false, "image": "" } ],
  "stocks":   [ { "sym": "", "name": "", "sector": "", "price": "", "raw": 0, "change": "", "chgNum": 0, "chgDir": "up|dn|nt", "explain": "", "eli5": "", "metadataOnly": false } ],
  "forex":    [ { "sym": "", "name": "", "flag": "",   "price": "", "raw": 0, "change": "", "chgNum": 0, "chgDir": "up|dn|nt", "explain": "", "eli5": "", "metadataOnly": false } ],
  "goods":    [ { "sym": "", "name": "", "sector": "", "price": "", "raw": 0, "change": "", "chgNum": 0, "chgDir": "up|dn|nt", "explain": "", "eli5": "", "metadataOnly": false } ]
}

Rules:
- Never include "status" or "createdBy" on articles — the system always creates them as drafts and stamps the logged-in admin as author.
- chgDir is exactly "up", "dn", or "nt" — never "down"/"flat".
- Omit an array entirely if there's nothing of that type in this batch.
- After you finish any research, reply with a short (1-2 sentence) note on what you drafted, then the JSON in a single fenced \`\`\`json code block as the LAST thing in your response. That code block must contain nothing but the JSON object — it is machine-parsed.`;

function extractJson(text) {
  const matches = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
  const candidate = matches.length ? matches[matches.length - 1][1] : text;
  return JSON.parse(candidate.trim());
}

exports.generateDraft = async (req, res) => {
  try {
    const { rawInput } = req.body || {};
    if (!rawInput || !rawInput.trim()) {
      return res.status(400).json({ message: 'rawInput is required' });
    }

    const stream = client.messages.stream({
      model: 'claude-opus-5',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20260209', name: 'web_search' }],
      messages: [{ role: 'user', content: rawInput }],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      return res.status(422).json({ message: 'Claude declined this request', stopDetails: message.stop_details });
    }

    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    let json;
    try {
      json = extractJson(text);
    } catch (parseErr) {
      return res.status(502).json({ message: 'Could not parse JSON from the draft', raw: text });
    }

    res.status(200).json({ json: JSON.stringify(json, null, 2) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
