require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

const GEMINI_MODEL = 'gemini-2.5-flash';

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;


// Gemini can choose the most suitable mood from these categories.
// The emoji is NOT fixed here. Gemini generates it.
const VALID_MOODS = [
  'happy',
  'sad',
  'angry',
  'excited',
  'anxious',
  'calm',
  'love',
  'bored',
  'surprised',
  'tired',
  'confused',
  'grateful',
  'proud',
  'neutral'
];


async function detectMood(text) {

  const prompt = `
You are the AI mood analyzer for a journaling app.

Read the user's text carefully and understand the meaning and emotion behind it.

Choose the ONE mood that best matches the user's feeling from this list:

${VALID_MOODS.join(', ')}

IMPORTANT:
- Do NOT choose a mood just because of one word.
- Understand the complete meaning and context.
- For example:
  "Yes! I won this." can be "proud".
  "I finally completed my project!" can be "proud" or "excited".
  "I miss my friend." can be "sad".
  "I can't wait for tomorrow!" can be "excited".
- You decide the most appropriate mood yourself.

Also generate:
1. A suitable emoji or small combination of emojis.
2. One short, friendly sentence explaining the feeling.
3. A short GIPHY search phrase related to the emotion.

Return ONLY valid JSON.
Do not use markdown.
Do not use code fences.

Use exactly this format:

{
  "mood": "proud",
  "emoji": "🥹🏆✨",
  "reason": "You feel proud and happy about your achievement.",
  "gifQuery": "proud achievement reaction"
}

The reason should be in the same language as the user's input when possible.

User text:
"""${text}"""
`;


  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300
      }
    })
  });


  if (!response.ok) {
    const errBody = await response.text();

    throw new Error(
      `Gemini API error (${response.status}): ${errBody}`
    );
  }


  const data = await response.json();

  const rawText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text || '';


  const cleaned = rawText
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();


  let parsed;


  try {
    parsed = JSON.parse(cleaned);
  } catch (error) {

    console.error('Gemini JSON parse failed:', rawText);

    parsed = {
      mood: 'neutral',
      emoji: '🙂',
      reason: 'I could not understand the feeling clearly.',
      gifQuery: 'neutral reaction'
    };
  }


  // Safety fallback if Gemini gives an unexpected mood
  if (!VALID_MOODS.includes(parsed.mood?.toLowerCase())) {
    parsed.mood = 'neutral';
  } else {
    parsed.mood = parsed.mood.toLowerCase();
  }


  // Fallback values if Gemini misses anything
  if (!parsed.emoji) {
    parsed.emoji = '🙂';
  }

  if (!parsed.reason) {
    parsed.reason = 'This is how your feeling seems from your message.';
  }

  if (!parsed.gifQuery) {
    parsed.gifQuery = `${parsed.mood} reaction`;
  }


  return parsed;
}


async function fetchGif(gifQuery) {

  const query = gifQuery || 'reaction';

  const url =
    `https://api.giphy.com/v1/gifs/search` +
    `?api_key=${GIPHY_API_KEY}` +
    `&q=${encodeURIComponent(query)}` +
    `&limit=10` +
    `&rating=g`;


  const response = await fetch(url);


  if (!response.ok) {

    const errBody = await response.text();

    throw new Error(
      `Giphy API error (${response.status}): ${errBody}`
    );
  }


  const data = await response.json();


  if (!data.data || data.data.length === 0) {
    return null;
  }


  const pick =
    data.data[Math.floor(Math.random() * data.data.length)];


  return {
    url: pick?.images?.downsized_medium?.url ||
         pick?.images?.original?.url ||
         null,

    title: pick.title || query
  };
}


app.post('/api/analyze', async (req, res) => {

  try {

    const { text } = req.body;


    if (
      !text ||
      typeof text !== 'string' ||
      !text.trim()
    ) {

      return res.status(400).json({
        error: 'Please provide non-empty "text" in the request body.'
      });
    }


    if (!GEMINI_API_KEY) {

      return res.status(500).json({
        error:
          'GEMINI_API_KEY is not set on the server. Add it to your .env file.'
      });
    }


    if (!GIPHY_API_KEY) {

      return res.status(500).json({
        error:
          'GIPHY_API_KEY is not set on the server. Add it to your .env file.'
      });
    }


    // Gemini understands the user's text
    const moodResult = await detectMood(text.trim());


    // GIPHY uses Gemini's generated search phrase
    let gif = null;


    try {

      gif = await fetchGif(moodResult.gifQuery);

    } catch (gifErr) {

      console.error(
        'Giphy fetch failed:',
        gifErr.message
      );

      // If GIPHY fails, mood analysis still works
      gif = null;
    }


    res.json({

      mood: moodResult.mood,

      emoji: moodResult.emoji,

      reason: moodResult.reason,

      gifQuery: moodResult.gifQuery,

      gif: gif
    });


  } catch (err) {

    console.error(
      'Analyze error:',
      err.message
    );


    res.status(500).json({
      error: err.message
    });
  }
});


app.get('/api/health', (req, res) => {

  res.json({

    status: 'ok',

    geminiConfigured: !!GEMINI_API_KEY,

    giphyConfigured: !!GIPHY_API_KEY

  });
});


app.listen(PORT, () => {

  console.log(
    `Mood detector server running at http://localhost:${PORT}`
  );

});