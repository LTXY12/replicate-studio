import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

const REPLICATE_API_BASE = 'https://api.replicate.com/v1';

// Proxy all requests to Replicate API
app.use('/api', async (req, res) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const path = req.url;
  const url = `${REPLICATE_API_BASE}${path}`;

  try {
    console.log(`${req.method} ${url}`);

    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`API Error ${response.status}:`, JSON.stringify(data, null, 2));
      return res.status(response.status).json(data);
    }

    console.log('Success:', response.status);

    // Log version info for debugging
    if (path.includes('/versions/') && data.id) {
      console.log('Version ID from response:', data.id);
    }

    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
