let page = 1;
const limit = 20;
const rowsEl = document.getElementById('rows');
const metaEl = document.getElementById('meta');

async function load() {
  const qs = new URLSearchParams();
  qs.set('page', String(page));
  qs.set('limit', String(limit));
  const res = await fetch(`/api/admin/messages?${qs.toString()}`, { credentials: 'include' });
  if (!res.ok) {
    rowsEl.innerHTML = '<tr><td colspan="7">Auth required or error.</td></tr>';
    return;
  }
  const data = await res.json();
  metaEl.textContent = `Total ${data.total} — Page ${data.page}`;
  rowsEl.innerHTML = '';
  for (const item of data.items) {
    const tr = document.createElement('tr');
    const bg = item.bg_color || '';
    const font = item.font_family || '';
    const size = item.text_size || '';
    tr.innerHTML = `
      <td>${item.id}</td>
      <td class="message-cell">${escapeHtml(item.message)}</td>
      <td><span title="${bg}" style="display:inline-block;width:18px;height:18px;border-radius:4px;border:1px solid #20242a;background:${bg}"></span></td>
      <td>${font}</td>
      <td>${size}</td>
      <td>${new Date(item.created_at).toLocaleString()}</td>
      <td><button data-id="${item.id}" class="danger">Delete</button></td>
    `;
    rowsEl.appendChild(tr);
  }
}

function escapeHtml(text) {
  const span = document.createElement('span');
  span.textContent = text;
  return span.innerHTML;
}

rowsEl.addEventListener('click', async (e) => {
  const target = e.target;
  if (target.tagName === 'BUTTON' && target.dataset.id) {
    const id = target.dataset.id;
    if (!confirm(`Delete message ${id}?`)) return;
    const res = await fetch(`/api/admin/messages/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) load();
  }
});

document.getElementById('prev').addEventListener('click', () => {
  page = Math.max(1, page - 1);
  load();
});
document.getElementById('next').addEventListener('click', () => {
  page = page + 1;
  load();
});

load();


