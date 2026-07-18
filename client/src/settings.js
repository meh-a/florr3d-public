const QUALITY_KEY = 'florr3d-quality';

const ULTRA_ENABLED = false;

const LEVELS = ULTRA_ENABLED ? ['low', 'high', 'ultra'] : ['low', 'high'];
const LABELS = { low: 'Low', high: 'High', ultra: 'Ultra Realistic' };

export function getQuality() {
  try {
    const q = localStorage.getItem(QUALITY_KEY);
    return LEVELS.includes(q) ? q : 'high';
  } catch {
    return 'high';
  }
}

export function setQuality(q) {
  try { localStorage.setItem(QUALITY_KEY, q); } catch {}
}

export function initQualityToggle() {
  const el = document.getElementById('quality');
  el.textContent = `Quality: ${LABELS[getQuality()]}`;
  el.onclick = () => {
    const next = LEVELS[(LEVELS.indexOf(getQuality()) + 1) % LEVELS.length];
    setQuality(next);
    location.reload();
  };
}
