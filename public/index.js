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
const viewAllSectionEl = document.getElementById('viewAllSection');

const sb = window.sheffmsgSupabase;

const ALLOWED_BG = [
  '#a6ff9d',
  '#fbffad',
  '#3ebfcd',
  '#973ecd',
  '#cd3ec1',
  '#cd763e'
];

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

function rowToStyle(row) {
  return {
    bgColor: row?.bg_color,
    fontFamily: row?.font_family,
    textSize: row?.text_size
  };
}

// Build colour swatches
// If we were reached via a personal QR (sheffmsg.fun/<code>), grab the code from
// the URL so we can attribute the message and notify the code's owner. On the
// plain root ("/") this is null and the page behaves exactly as before.
const REFERRAL_CODE = (() => {
  const seg = window.location.pathname.replace(/^\/+/, '').split('/')[0];
  return /^[A-Za-z0-9]{6,10}$/.test(seg) ? seg : null;
})();

// Build color swatches
if (bgSwatchesEl) {
  ALLOWED_BG.forEach((color, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.backgroundColor = color;
    btn.setAttribute('aria-label', `Background ${idx + 1}`);

    btn.addEventListener('click', () => {
      [...bgSwatchesEl.children].forEach((c) =>
        c.setAttribute('aria-pressed', 'false')
      );

      btn.setAttribute('aria-pressed', 'true');

      if (input) {
        input.style.backgroundColor = color;
        input.style.color = '#0a0a0a';
      }

      bgSwatchesEl.dataset.selected = color;
    });

    bgSwatchesEl.appendChild(btn);
  });

  if (bgSwatchesEl.firstChild) {
    bgSwatchesEl.firstChild.click();
  }
}

function applyStyle(style) {
  if (!style || !messageBoxEl) return;

  if (style.bgColor && ALLOWED_BG.includes(style.bgColor)) {
    messageBoxEl.style.backgroundColor = style.bgColor;

    if (bgSwatchesEl) {
      [...bgSwatchesEl.children].forEach((c) =>
        c.setAttribute('aria-pressed', 'false')
      );

      const idx = ALLOWED_BG.indexOf(style.bgColor);

      if (idx >= 0) {
        bgSwatchesEl.children[idx]?.setAttribute('aria-pressed', 'true');
      }

      bgSwatchesEl.dataset.selected = style.bgColor;
    }
  }

  if (style.fontFamily && currentMessageEl) {
    currentMessageEl.style.fontFamily = style.fontFamily;

    if (fontSelectEl) {
      fontSelectEl.value = style.fontFamily;
    }
  }

  if (style.textSize && messageBoxEl) {
    messageBoxEl.classList.remove('size-small', 'size-medium', 'size-large');
    messageBoxEl.classList.add(`size-${style.textSize}`);

    if (sizeSelectEl) {
      sizeSelectEl.value = style.textSize;
    }
  }
}

const sizeToRem = (v) =>
  v === 'small' ? '1rem' : v === 'large' ? '1.5rem' : '1.25rem';

function syncTextareaFromControls() {
  if (!input) return;

  const bg = bgSwatchesEl?.dataset.selected;

  if (bg) {
    input.style.backgroundColor = bg;
    input.style.color = '#0a0a0a';
  }

  if (fontSelectEl) {
    input.style.fontFamily = fontSelectEl.value || 'system-ui';
  }

  if (sizeSelectEl) {
    input.style.fontSize = sizeToRem(sizeSelectEl.value || 'medium');
  }
}

if (fontSelectEl) {
  fontSelectEl.addEventListener('change', syncTextareaFromControls);
}

if (sizeSelectEl) {
  sizeSelectEl.addEventListener('change', syncTextareaFromControls);
}

async function loadMessage() {
  try {
    if (!sb) {
      throw new Error('Supabase client not loaded');
    }

    const { data, error } = await sb
      .from('messages')
      .select('id, message, created_at, bg_color, font_family, text_size')
      .eq('location', 'default')
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (data?.message) {
      const style = rowToStyle(data);

      currentMessageEl.textContent = data.message;
      timestampEl.textContent = formatDate(data.created_at);

      applyStyle(style);
      syncTextareaFromControls();

      const shouldShowSplash = !sessionStorage.getItem('seenSplash');

      if (shouldShowSplash && splashEl && splashTextEl && mainEl) {
        splashTextEl.textContent = data.message;

        if (style.bgColor) {
          splashEl.style.backgroundColor = style.bgColor;
          document.body.style.backgroundColor = style.bgColor;
        }

        splashEl.style.display = 'flex';

        setTimeout(() => {
          splashEl.style.display = 'none';
          mainEl.classList.remove('hidden');
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

      if (mainEl) {
        mainEl.classList.remove('hidden');
      }
    }
  } catch (e) {
    console.error(e);

    currentMessageEl.textContent = 'Unable to load message right now.';

    if (mainEl) {
      mainEl.classList.remove('hidden');
    }
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
        textSize: sizeSelectEl?.value,
        code: REFERRAL_CODE
      })
    });
    const createdAt = new Date().toISOString();

    const { data, error } = await sb
      .from('messages')
      .insert({
        location: 'default',
        message,
        created_at: createdAt,
        bg_color: bgSwatchesEl?.dataset.selected || null,
        font_family: fontSelectEl?.value || 'system-ui',
        text_size: sizeSelectEl?.value || 'medium'
      })
      .select('id, created_at, bg_color, font_family, text_size')
      .single();

    if (error) throw error;

    statusEl.textContent = 'Thanks! Message saved.';
    currentMessageEl.textContent = message;
    timestampEl.textContent = formatDate(data.created_at || createdAt);

    applyStyle(rowToStyle(data));

    input.value = '';

    if (viewAllSectionEl) {
      viewAllSectionEl.style.display = 'block';
      sessionStorage.setItem('hasPosted', '1');
    }

    await loadMessage();
  } catch (e) {
    console.error(e);
    statusEl.textContent = 'Failed to submit. Please try again.';
  }
});

loadMessage();

const inspirations = [
  'Tell your best joke',
  'Leave a pickup line',
  'Say something inspiring',
  'What are you doing right now',
  'Whats your favourite thing ever',
  'Make up a fact',
  'Leave someone a compliment',
  'Recommend a movie',
  'Give your best advice',
  'Leave a message for your future self',
  'Reccomend a food place in Sheffield',
  'Tell a story in 100 characters',
  'Something that made you smile',
  'Leave a secret you know :0',
  'Say something you know is true',
  'What is your FAVOURITE song',
  'Leave your name :D',
  'The name of the person you love',
  'Your favorite place in the world',
  'Something you want to try',
  'Your favourite book',
  'Yes or No?',
  'What superpower would you want',
  'Leave your instagram XD',
  'Confess your most irrational opinion',
  'Favourite Food',
  'Make something up',
  'Describe yourself in 3 words',
  'Tell the next person about your ex',
  'Leave a threat >:)',
  'What was the last thing you searched',
  'Ask a question for the next person'
];

const inspoElement = document.getElementById('inspo');
const refreshButton = document.getElementById('refreshInspo');

function setRandomInspo() {
  const randomIndex = Math.floor(Math.random() * inspirations.length);

  if (inspoElement) {
    inspoElement.value = inspirations[randomIndex];
  }
}

setRandomInspo();

if (refreshButton) {
  refreshButton.addEventListener('click', setRandomInspo);
}

if (sessionStorage.getItem('hasPosted') === '1' && viewAllSectionEl) {
  viewAllSectionEl.style.display = 'block';
}