const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.post('/convert', async (req, res) => {
  try {
    const { imageBase64, mimeType, apiKey } = req.body;

    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'aff48af9c68d162388d230a2ab003f68d2638d88b154d57be2dcab3b4b3f9aef',
        input: {
          image: `data:${mimeType};base64,${imageBase64}`,
          prompt: 'clean embroidery pattern, coloring book line art, black outlines on white background, no fill, no shading',
          negative_prompt: 'color, shading, fill, texture, noise, photo, realistic',
          num_inference_steps: 20,
        }
      })
    });

    const prediction = await createRes.json();
    if (!createRes.ok) return res.status(400).json({ error: prediction.detail });

    // Poll until done
    let result = prediction;
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      result = await pollRes.json();
    }

    if (result.status === 'failed') return res.status(500).json({ error: 'Generation failed' });

    const output = Array.isArray(result.output) ? result.output[0] : result.output;
    res.json({ imageUrl: output });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.send('StitchAI Proxy running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
