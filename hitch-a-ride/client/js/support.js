// BUB Support Center: обращения, история и переписка.
(function () {
  const form = document.getElementById('support-form');
  const alertBox = document.getElementById('support-alert');
  const created = document.getElementById('support-created');
  const list = document.getElementById('support-ticket-list');
  const thread = document.getElementById('support-thread');
  const STORAGE_KEY = 'bub_support_tickets_v1';
  let current = null;

  function localTickets() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (_) { return []; }
  }
  function saveLocal(item) {
    const all = localTickets().filter(x => Number(x.id) !== Number(item.id));
    all.unshift(item);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 30)));
  }
  function notice(message, type) {
    alertBox.textContent = message;
    alertBox.className = 'support-alert ' + (type || 'info');
    alertBox.hidden = false;
  }
  function statusClass(status) {
    if (status === 'Решено') return 'done';
    if (status === 'В работе') return 'work';
    if (status === 'Ожидает ответа') return 'wait';
    return 'new';
  }
  function dateText(value) {
    const d = new Date(value);
    return isNaN(d) ? '' : d.toLocaleString('ru-RU', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  }
  function ticketCard(ticket, key, isAdmin) {
    return '<button type="button" class="support-ticket-row" data-ticket="' + Number(ticket.id) +
      '" data-key="' + esc(key || '') + '"><span class="support-ticket-number">#' + Number(ticket.id) +
      '</span><span class="support-ticket-main"><b>' + esc(ticket.subject) + '</b><small>' +
      (isAdmin ? esc(ticket.name) + ' · ' + esc(ticket.email) + ' · ' : '') + esc(ticket.category) + ' · ' + dateText(ticket.updated_at || ticket.created_at) +
      '</small></span><span class="support-status ' + statusClass(ticket.status) + '">' +
      esc(ticket.status) + '</span><span class="support-ticket-arrow">›</span></button>';
  }

  async function loadTickets() {
    let items = [];
    let admin = false;
    try {
      const data = await Api.get('/support/tickets');
      admin = !!data.admin;
      items = data.tickets || [];
    } catch (_) {}
    document.getElementById('support-admin-entry').hidden = !admin;
    if (!admin) {
      for (const entry of localTickets()) {
        try {
          const data = await Api.get('/support/tickets/' + Number(entry.id) + '?key=' + encodeURIComponent(entry.key));
          items.push(Object.assign({}, data.ticket, {_key:entry.key}));
        } catch (_) {}
      }
    }
    list.innerHTML = items.length
      ? (admin ? '<div class="support-admin-note">Режим администратора · все обращения пользователей</div>' : '') +
        Array.from(new Map(items.map(t => [Number(t.id), t])).values()).map(t => ticketCard(t, t._key || '', admin)).join('')
      : '<div class="support-empty"><b>Здесь пока пусто</b><span>Отправьте первое обращение — оно появится в этом списке.</span></div>';
  }

  async function openTicket(id, key) {
    try {
      const suffix = key ? '?key=' + encodeURIComponent(key) : '';
      const data = await Api.get('/support/tickets/' + Number(id) + suffix);
      current = {id:Number(id),key:key || ''};
      const messages = (data.messages || []).map(m =>
        '<div class="support-message ' + (m.author_type === 'support' ? 'from-support' : 'from-user') +
        '"><div class="support-message-meta"><b>' + esc(m.author_name) + '</b><span>' +
        dateText(m.created_at) + '</span></div><p>' + esc(m.text).replace(/\n/g,'<br>') + '</p></div>'
      ).join('');
      const statuses = ['Новое','В работе','Ожидает ответа','Решено'];
      const options = statuses.map(s => '<option' + (data.ticket.status === s ? ' selected' : '') + '>' + s + '</option>').join('');
      thread.innerHTML =
        '<div class="support-thread-head"><div><span class="support-eyebrow">ОБРАЩЕНИЕ #' +
        data.ticket.id + '</span><h3>' + esc(data.ticket.subject) + '</h3><span class="support-status ' +
        statusClass(data.ticket.status) + '">' + esc(data.ticket.status) + '</span></div>' +
        '<button type="button" class="support-close-thread" id="support-close-thread" aria-label="Закрыть">×</button></div>' +
        (data.admin ? '<label class="support-status-edit">Статус заявки<select id="support-status-select">' + options + '</select></label>' : '') +
        '<div class="support-messages">' + (messages || '<div class="support-empty">Сообщений пока нет.</div>') + '</div>' +
        (data.ticket.status === 'Решено' && !data.admin
          ? '<p class="support-resolved-note">Заявка закрыта. Если вопрос остался, создайте новое обращение.</p>'
          : '<form id="support-reply-form" class="support-reply-form"><textarea name="message" rows="2" maxlength="3000" placeholder="Напишите ответ…" required></textarea><button class="btn" type="submit">Отправить</button></form>');
      thread.hidden = false;
      document.getElementById('support-close-thread').onclick = () => {thread.hidden = true;current = null;};
      const statusSelect = document.getElementById('support-status-select');
      if (statusSelect) statusSelect.onchange = async () => {
        try {
          await Api.put('/support/tickets/' + current.id + '/status',{status:statusSelect.value});
          await openTicket(current.id,current.key);
          await loadTickets();
        } catch (err) {notice(err.message,'error');}
      };
      const replyForm = document.getElementById('support-reply-form');
      if (replyForm) replyForm.onsubmit = async e => {
        e.preventDefault();
        const button = replyForm.querySelector('button');
        button.disabled = true;
        try {
          await Api.post('/support/tickets/' + current.id + '/messages',{
            message:replyForm.message.value,access_key:current.key
          });
          await openTicket(current.id,current.key);
          await loadTickets();
        } catch (err) {notice(err.message,'error');button.disabled = false;}
      };
      const box = thread.querySelector('.support-messages');
      box.scrollTop = box.scrollHeight;
    } catch (err) {notice(err.message || 'Не удалось открыть обращение','error');}
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const result = await Api.post('/support/tickets',payload);
      saveLocal({id:result.id,key:result.access_key});
      created.hidden = false;
      created.innerHTML = '<b>Обращение #' + Number(result.id) + ' отправлено!</b>' +
        '<span>Сохраните персональный ключ доступа — он понадобится, чтобы открыть переписку с другого устройства.</span>' +
        '<code>' + esc(result.access_key) + '</code>' +
        '<button type="button" class="btn btn-secondary btn-small" id="copy-support-key">Скопировать ключ</button>';
      document.getElementById('copy-support-key').onclick = async () => {
        try {await navigator.clipboard.writeText(result.access_key);notice('Ключ скопирован.','success');}
        catch (_) {notice('Скопируйте ключ вручную из блока подтверждения.','info');}
      };
      form.reset();
      await loadTickets();
      await openTicket(result.id,result.access_key);
      created.scrollIntoView({behavior:'smooth',block:'center'});
    } catch (err) {notice(err.message || 'Не удалось отправить обращение','error');}
    finally {button.disabled = false;}
  });

  list.addEventListener('click', e => {
    const row = e.target.closest('[data-ticket]');
    if (row) openTicket(row.dataset.ticket,row.dataset.key);
  });
  document.getElementById('support-refresh').addEventListener('click',loadTickets);
  document.getElementById('support-access-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = Number(e.currentTarget.ticket_id.value);
    const key = String(e.currentTarget.access_key.value || '').trim();
    if (!id || !key) return;
    saveLocal({id:id,key:key});
    await openTicket(id,key);
    await loadTickets();
  });
  getCurrentUser().then(user => {
    if (user) {
      document.getElementById('support-name').value = user.name || '';
      document.getElementById('support-email').value = user.email || '';
    }
    loadTickets();
  });
})();