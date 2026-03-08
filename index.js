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
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        input: {
          control_image: `data:${mimeType};base64,${imageBase64}`,
          prompt: 'clean embroidery pattern line drawing, coloring book style, black outlines on white background, no fill, no color, no shading',
          negative_prompt: 'color, fill, shading, realistic, photo, texture',
          num_inference_steps: 28,
          guidance_scale: 7.5,
          controlnet_conditioning_scale: 1.0
        }
      })
    });

    const prediction = await createRes.json();
    if (!createRes.ok) return res.status(400).json({ error: prediction.detail || JSON.stringify(prediction) });

    // Poll until done if not already completed
    let result = prediction;
    let attempts = 0;
    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 30) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      result = await pollRes.json();
      attempts++;
    }

    if (result.status === 'failed') return res.status(500).json({ error: 'Generation failed: ' + result.error });

    const output = Array.isArray(result.output) ? result.output[0] : result.output;
    if (!output) return res.status(500).json({ error: 'No output received' });
    
    res.json({ imageUrl: output });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.send('StitchAI Proxy running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
