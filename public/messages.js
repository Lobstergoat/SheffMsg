const messagesGridEl = document.getElementById('messagesGrid');

const sizeMap = {
  small: '1rem',
  medium: '1.25rem',
  large: '1.5rem'
};

async function loadAllMessages() {
  try {
    const res = await fetch('/api/messages/all');
    const data = await res.json();
    
    if (!data.messages || data.messages.length === 0) {
      messagesGridEl.innerHTML = '<div class="no-messages">No messages yet. Be the first to leave one!</div>';
      return;
    }
    
    messagesGridEl.innerHTML = '';
    
    data.messages.forEach(msg => {
      const card = document.createElement('div');
      card.className = 'message-card';
      
      if (msg.bg_color) {
        card.style.backgroundColor = msg.bg_color;
      }
      
      const text = document.createElement('div');
      text.className = 'message-text';
      text.textContent = msg.message;
      
      if (msg.font_family) {
        text.style.fontFamily = msg.font_family;
      }
      
      if (msg.text_size && sizeMap[msg.text_size]) {
        text.style.fontSize = sizeMap[msg.text_size];
      }
      
      card.appendChild(text);
      messagesGridEl.appendChild(card);
    });
  } catch (e) {
    messagesGridEl.innerHTML = '<div class="no-messages">Unable to load messages right now.</div>';
  }
}

loadAllMessages();
