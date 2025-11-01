const currentMessageEl = document.getElementById('currentMessage');
const timestampEl = document.getElementById('timestamp');
const messageBoxEl = document.querySelector('.message-box');
const form = document.getElementById('messageForm');
const input = document.getElementById('messageInput');
const statusEl = document.getElementById('formStatus');
const bgSwatchesEl = document.getElementById('bgSwatches');
const fontSelectEl = document.getElementById('fontSelect');
const sizeSelectEl = document.getElementById('sizeSelect');
const splashEl = document.getElementById('splash');
const splashTextEl = document.getElementById('splashText');
const mainEl = document.querySelector('main.container');

const ALLOWED_BG = ['#a6ff9d', '#fbffad', '#3ebfcd', '#973ecd', '#cd3ec1', '#cd763e'];

// Build color swatches
if (bgSwatchesEl) {
  ALLOWED_BG.forEach((color, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.backgroundColor = color;
    btn.setAttribute('aria-label', `Background ${idx+1}`);
    btn.addEventListener('click', () => {
      [...bgSwatchesEl.children].forEach(c => c.setAttribute('aria-pressed','false'));
      btn.setAttribute('aria-pressed','true');
      if (input) {
        input.style.backgroundColor = color;
        input.style.color = '#0a0a0a';
      }
      bgSwatchesEl.dataset.selected = color;
    });
    bgSwatchesEl.appendChild(btn);
  });
  // default select first color for textarea only
  if (bgSwatchesEl.firstChild) bgSwatchesEl.firstChild.click();
}

function applyStyle(style) {
  if (!style) return;
  if (style.bgColor && ALLOWED_BG.includes(style.bgColor)) {
    messageBoxEl.style.backgroundColor = style.bgColor;
    // mark selected
    if (bgSwatchesEl) {
      [...bgSwatchesEl.children].forEach(c => c.setAttribute('aria-pressed','false'));
      const idx = ALLOWED_BG.indexOf(style.bgColor);
      if (idx >= 0) bgSwatchesEl.children[idx]?.setAttribute('aria-pressed','true');
      bgSwatchesEl.dataset.selected = style.bgColor;
    }
  }
  if (style.fontFamily) {
    currentMessageEl.style.fontFamily = style.fontFamily;
    if (fontSelectEl) fontSelectEl.value = style.fontFamily;
  }
  if (style.textSize) {
    messageBoxEl.classList.remove('size-small','size-medium','size-large');
    messageBoxEl.classList.add(`size-${style.textSize}`);
    if (sizeSelectEl) sizeSelectEl.value = style.textSize;
  }
}

// Helpers to keep textarea as live preview (do not change current message box)
const sizeToRem = (v) => v === 'small' ? '1rem' : v === 'large' ? '1.5rem' : '1.25rem';

function syncTextareaFromControls() {
  if (!input) return;
  const bg = bgSwatchesEl?.dataset.selected;
  if (bg) {
    input.style.backgroundColor = bg;
    input.style.color = '#0a0a0a';
  }
  if (fontSelectEl) input.style.fontFamily = fontSelectEl.value || 'system-ui';
  if (sizeSelectEl) input.style.fontSize = sizeToRem(sizeSelectEl.value || 'medium');
}

if (fontSelectEl) {
  fontSelectEl.addEventListener('change', syncTextareaFromControls);
}
if (sizeSelectEl) {
  sizeSelectEl.addEventListener('change', syncTextareaFromControls);
}

async function loadMessage() {
  try {
    const res = await fetch(`/api/message`);
    const data = await res.json();
    if (data.message) {
      currentMessageEl.textContent = data.message;
      timestampEl.textContent = new Date(data.createdAt).toLocaleString();
      applyStyle(data.style);
      // Make textarea mirror current style initially
      syncTextareaFromControls();
      // Show splash for 3 seconds only on first load per tab (session)
      const shouldShowSplash = !sessionStorage.getItem('seenSplash');
      if (shouldShowSplash && splashEl && splashTextEl && mainEl) {
        splashTextEl.textContent = data.message;
        if (data.style && data.style.bgColor) {
          splashEl.style.backgroundColor = data.style.bgColor;
          document.body.style.backgroundColor = data.style.bgColor;
        }
        splashEl.style.display = 'flex';
        setTimeout(() => {
          splashEl.style.display = 'none';
          mainEl.classList.remove('hidden');
          // restore body background
          document.body.style.backgroundColor = '';
          sessionStorage.setItem('seenSplash', '1');
        }, 2000);
      } else if (mainEl) {
        mainEl.classList.remove('hidden');
      }
    } else {
      currentMessageEl.textContent = 'Be the first to leave a message here!';
      timestampEl.textContent = '';
      syncTextareaFromControls();
      if (mainEl) mainEl.classList.remove('hidden');
    }
  } catch (e) {
    currentMessageEl.textContent = 'Unable to load message right now.';
    if (mainEl) mainEl.classList.remove('hidden');
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  statusEl.textContent = 'Sending...';
  try {
    const res = await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        bgColor: bgSwatchesEl?.dataset.selected,
        fontFamily: fontSelectEl?.value,
        textSize: sizeSelectEl?.value
      })
    });
    const data = await res.json();
    if (!res.ok) {
      statusEl.textContent = data.error || 'Failed to submit';
      return;
    }
    statusEl.textContent = 'Thanks! Message saved.';
    currentMessageEl.textContent = message;
    timestampEl.textContent = new Date().toLocaleString();
    applyStyle(data.style || {
      bgColor: bgSwatchesEl?.dataset.selected,
      fontFamily: fontSelectEl?.value,
      textSize: sizeSelectEl?.value
    });
    input.value = '';
    await loadMessage();
  } catch (e) {
    statusEl.textContent = 'Network error, please try again.';
  }
});

loadMessage();

const inspirations = [
  "Tell your best joke",
  "Leave a pickup line",
  "Say something inspiring",
  "What are you doing right now",
  "Whats your favourite thing ever",
  "Make up a fact",
  "Leave someone a compliment",
  "Recommend a movie",
  "Give your best advice",
  "Leave a message for your future self",
  "Reccomend a food place in Sheffield",
  "Tell a story in 100 characters",
  "Something that made you smile",
  "Leave a secret you know :0",
  "Say something you know is true",
  "What is your FAVOURITE song",
  "Leave your name :D",
  "The name of the person you love",
  "Your favorite place in the world",
  "Something you want to try",
  "Your favourite book",
  "Yes or No?",
  "What superpower would you want",
  "Leave your instagram XD",
  "Confess your most irrational opinion",
  "Favourite Food",
  "Make something up",
  "Describe yourself in 3 words",
  "Tell the next person about your ex",
  "Leave a threat >:)",
  "What was the last thing you searched",
  "Ask a question for the next person"
];

const inspoElement = document.getElementById("inspo");
const refreshButton = document.getElementById("refreshInspo");

function setRandomInspo() {
  const randomIndex = Math.floor(Math.random() * inspirations.length);
  inspoElement.value = inspirations[randomIndex];
}

setRandomInspo();

refreshButton.addEventListener("click", setRandomInspo);

