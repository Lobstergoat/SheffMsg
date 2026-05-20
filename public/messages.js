const messagesGridEl = document.getElementById('messagesGrid');
const sb = window.sheffmsgSupabase;

const ALLOWED_BG = [
  '#a6ff9d',
  '#fbffad',
  '#3ebfcd',
  '#973ecd',
  '#cd3ec1',
  '#cd763e'
];

const sizeMap = {
  small: '1rem',
  medium: '1.25rem',
  large: '1.5rem'
};

function formatDate(value) {
  if (!value) return 'Unknown date';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleString();
}

function createMessageCard(msg) {
  const card = document.createElement('div');
  card.className = 'message-card';

  if (msg.bg_color && ALLOWED_BG.includes(msg.bg_color)) {
    card.style.backgroundColor = msg.bg_color;
  }

  const text = document.createElement('div');
  text.className = 'message-text';
  text.textContent = msg.message || '';

  if (msg.font_family) {
    text.style.fontFamily = msg.font_family;
  }

  if (msg.text_size && sizeMap[msg.text_size]) {
    text.style.fontSize = sizeMap[msg.text_size];
  }

  const meta = document.createElement('div');
  meta.className = 'message-meta';
  meta.textContent = formatDate(msg.created_at);

  card.appendChild(text);
  //card.appendChild(meta);

  return card;
}

async function loadAllMessages() {
  try {
    if (!messagesGridEl) {
      throw new Error('messagesGrid element not found');
    }

    if (!sb) {
      throw new Error('Supabase client not loaded');
    }

    const { data, error } = await sb
      .from('messages')
      .select('id, message, created_at, bg_color, font_family, text_size')
      .eq('location', 'default')
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false });

    if (error) throw error;

    if (!data || data.length === 0) {
      messagesGridEl.innerHTML =
        '<div class="no-messages">No messages yet. Be the first to leave one!</div>';
      return;
    }

    messagesGridEl.innerHTML = '';

    data.forEach((msg) => {
      messagesGridEl.appendChild(createMessageCard(msg));
    });
  } catch (e) {
    console.error(e);

    if (messagesGridEl) {
      messagesGridEl.innerHTML =
        '<div class="no-messages">Unable to load messages right now.</div>';
    }
  }
}

loadAllMessages();