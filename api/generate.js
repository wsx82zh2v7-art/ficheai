const ipCounts = {};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const MAX_FREE = 3;

  if (!ipCounts[ip]) ipCounts[ip] = { count: 0, resetAt: Date.now() + 24*60*60*1000 };
  if (Date.now() > ipCounts[ip].resetAt) { ipCounts[ip] = { count: 0, resetAt: Date.now() + 24*60*60*1000 }; }

  if (ipCounts[ip].count >= MAX_FREE) {
    return res.status(403).json({ error: 'LIMIT_REACHED', message: 'Limite gratuite atteinte' });
  }

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || 'Erreur de génération.';
    ipCounts[ip].count++;
    res.status(200).json({ text, remaining: MAX_FREE - ipCounts[ip].count });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur: ' + error.message });
  }
}
