const entry = document.getElementById('entry');
const charCount = document.getElementById('charCount');
const analyzeBtn = document.getElementById('analyzeBtn');
const result = document.getElementById('result');
const resultEmoji = document.getElementById('resultEmoji');
const resultMood = document.getElementById('resultMood');
const resultReason = document.getElementById('resultReason');
const gifWrap = document.getElementById('gifWrap');
const resultGif = document.getElementById('resultGif');
const errorBox = document.getElementById('errorBox');

const MOOD_COLORS = {
  happy: '#C98A2E',
  sad: '#3D5A73',
  angry: '#B3432B',
  excited: '#D9642B',
  anxious: '#6B5B95',
  calm: '#4F7A6B',
  love: '#B15C6D',
  bored: '#8A8478',
  surprised: '#C9A227',
  tired: '#6E6A5E',
  confused: '#7A6E8A',
  grateful: '#A67C3D',
  proud: '#4A6FA5',
  neutral: '#8A6E4B'
};

entry.addEventListener('input', () => {
  charCount.textContent = `${entry.value.length} / 600`;
});

analyzeBtn.addEventListener('click', analyze);
entry.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    analyze();
  }
});

async function analyze() {
  const text = entry.value.trim();
  errorBox.hidden = true;

  if (!text) {
    showError('Kuch to likho pehle — the page has nothing to read yet.');
    return;
  }

  setLoading(true);
  result.hidden = true;

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong reading that.');
    }

    renderResult(data);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

function renderResult(data) {
  const color = MOOD_COLORS[data.mood] || MOOD_COLORS.neutral;
  document.documentElement.style.setProperty('--accent', color);

  resultEmoji.textContent = data.emoji || '🙂';
  resultMood.textContent = data.mood;
  resultReason.textContent = data.reason || '';

  if (data.gif && data.gif.url) {
    resultGif.src = data.gif.url;
    resultGif.alt = data.gif.title || `${data.mood} mood GIF`;
    gifWrap.hidden = false;
  } else {
    gifWrap.hidden = true;
  }

  result.hidden = false;
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function setLoading(isLoading) {
  analyzeBtn.disabled = isLoading;
  analyzeBtn.textContent = isLoading ? 'Reading…' : 'Read the mood';
}
