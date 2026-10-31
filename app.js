/* IKETECH AUTO LTD - staff app (no build step). Talks to Supabase; the database enforces every rule. */
// tidy the pasted values: keep only the web address root, drop spaces, quotes, trailing slashes or paths like /rest/v1
const CLEAN_URL = (() => { try { return new URL(String(IKETECH.SUPABASE_URL).trim().replace(/^["']|["']$/g, '')).origin; } catch (e) { return String(IKETECH.SUPABASE_URL).trim(); } })();
const CLEAN_KEY = String(IKETECH.SUPABASE_ANON_KEY).trim().replace(/^["']|["']$/g, '');
const sb = supabase.createClient(CLEAN_URL, CLEAN_KEY);
const $app = document.getElementById('app'), $who = document.getElementById('who'), $out = document.getElementById('out');
let me = null;   // {id, full_name, role, branch_id}

// ---- tiny safe DOM helper (never inserts raw HTML) ----
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const show = (...n) => { $app.textContent = ''; $app.append(...n); };
const nice = m => (m || '').replace(/^.*?: /, '');
const ROLES_ALL = ['ceo','manager','admin','supervisor','advisor','receptionist','technician','accounting'];
const can = (...r) => r.includes(me.role);

function field(label, input) { return h('div', {}, h('label', {}, label), input); }
function msg(cls, text) { return h('div', { class: cls }, text); }

// ---- sign in ----
function loginPage(note) {
  const email = h('input', { type: 'email', autocomplete: 'username' }), pw = h('input', { type: 'password', autocomplete: 'current-password' });
  const out = h('div'), btn = h('button', { class: 'p' }, 'Sign in');
  btn.onclick = async () => {
    btn.disabled = true; out.textContent = '';
    const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pw.value });
    if (error) { out.append(msg('err', 'Could not sign in: ' + error.message + ' [site: ' + CLEAN_URL.replace(/^https?:\/\//,'').slice(0,4) + '…' + CLEAN_URL.slice(-12) + ']' + (error.status ? ' (code ' + error.status + ')' : ''))); btn.disabled = false; } else boot();
  };
  show(h('div', { class: 'card' }, h('h2', {}, 'Sign in'), note ? msg('err', note) : '', field('Email', email), field('Password', pw), btn, out));
}

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { $who.textContent = ''; $out.hidden = true; return loginPage(); }
  const { data, error } = await sb.from('profiles').select('id, full_name, role, branch_id, is_active, can_see_payroll').eq('id', session.user.id).maybeSingle();
  if (error || !data || !data.is_active) { await sb.auth.signOut(); return loginPage(error ? 'Signed in, but the staff profile could not be read: ' + error.message : 'Signed in, but there is no active staff profile for this login. The profile row must use this user\'s id.'); }
  me = data; $who.textContent = data.full_name + ' · ' + data.role; $out.hidden = false;
  route();
}
$out.onclick = async () => { await sb.auth.signOut(); me = null; boot(); };
window.addEventListener('hashchange', () => me && route());

// ---- routing ----
function route() {
  const [page, arg] = (location.hash.slice(1) || 'home').split('/');
  ({ home, customers, customer, jobs, job, inspections, insp, quotations, quotation, invoices, invoice, messages, payroll, dashboard, credit, referrals, technicians, costing, settings, branches, team }[page] || home)(arg);
}

function home() {
  const ICON = { 'CEO dashboard': '📊', 'Customers': '👥', 'Inspections': '🔍', 'Quotations': '📝', 'Invoices & payments': '💳', 'Messages': '💬', 'Credit control': '⏳', 'Referrals': '🤝', 'Job costing': '🧮', 'Technicians': '🛠️', 'Jobs': '🚗', 'Payroll': '💰', 'Business settings': '⚙️', 'Branches': '🏢', 'Team': '🪪' };
  const t = (href, title, sub) => h('a', { class: 'tile', href }, h('span', { class: 'ic' }, ICON[title] || '•'), title, h('small', {}, sub));
  const tiles = [];
  if (can('ceo','manager')) tiles.push(t('#dashboard', 'CEO dashboard', 'Money, jobs, quality and branches at a glance'));
  if (can('ceo','manager','admin','advisor','receptionist')) tiles.push(t('#customers', 'Customers', 'Add and find customers and vehicles'));
  tiles.push(t('#inspections', 'Inspections', can('technician') ? 'Your vehicle inspections' : 'Vehicle inspections and reports'));
  if (can('ceo','manager','admin','supervisor','advisor','receptionist','accounting')) tiles.push(t('#quotations', 'Quotations', 'Prices for customers to approve'));
  if (can('ceo','manager','admin','advisor','receptionist','accounting')) tiles.push(t('#invoices', 'Invoices & payments', 'Bills, payments and balances'));
  if (can('ceo','manager','admin','supervisor','advisor','receptionist')) tiles.push(t('#messages', 'Messages', 'Updates waiting to be sent to customers'));
  if (can('ceo','manager','admin','accounting','advisor')) tiles.push(t('#credit', 'Credit control', 'Who owes us, how long, and reminders'));
  if (can('ceo','manager','admin','accounting')) tiles.push(t('#referrals', 'Referrals', 'Referrers and the rewards they have earned'));
  if (can('ceo','manager','admin','accounting')) tiles.push(t('#costing', 'Job costing', 'What each job cost and the profit made'));
  if (can('ceo','manager','supervisor')) tiles.push(t('#technicians', 'Technicians', 'Workload, quality and speed'));
  tiles.push(t('#jobs', 'Jobs', can('technician') ? 'Your assigned jobs' : 'Open and recent jobs'));
  if (can('ceo') || me.can_see_payroll) tiles.push(t('#payroll', 'Payroll', 'Staff pay, advances and payslips (private)'));
  if (can('ceo')) tiles.push(t('#settings', 'Business settings', 'Name, motto, terms, bank details'), t('#branches', 'Branches', 'Add and manage branches'), t('#team', 'Team', 'Roles and access'));
  show(h('div', { class: 'hello' }, h('img', { src: 'logo.jpg', alt: '' }), h('div', {}, h('h2', {}, 'Hello, ' + me.full_name.split(' ')[0]), h('div', { class: 'mut' }, 'What would you like to do today?'))), h('div', { class: 'grid' }, tiles));
}

// ---- customer messages: one at every stage from reception to delivery ----
const MSG_LABEL = { JOB_RECEIVED: 'Vehicle received', CHECKIN: 'Inspection started', REPORT_READY: 'Inspection report ready', QUOTE_SENT: 'Quotation sent', APPROVAL_RECEIVED: 'Approval received', REPAIR_STARTED: 'Repair started',
  REPAIRS_DONE: 'Repairs done', INVOICE_ISSUED: 'Invoice issued', PAYMENT_RECEIVED: 'Payment received', READY: 'Ready for collection', COLLECTED: 'Handed over - thank you' };
const MSG_ORDER = Object.keys(MSG_LABEL);
function msgText(m, co, x) {
  const n = ((m.customers && m.customers.name) || 'customer').split(' ')[0], v = m.vehicles ? [m.vehicles.make, m.vehicles.model].filter(Boolean).join(' ') + (m.vehicles.registration ? ' (' + m.vehicles.registration + ')' : '') : 'vehicle';
  const cn = co.company_name || 'IKETECH AUTO LTD', track = x.track ? ' Follow progress here: ' + x.track : '';
  switch (m.event) {
    case 'JOB_RECEIVED': return `Hello ${n}, we have received your ${v} at ${cn}. Job number ${m.job_id}. We will keep you updated at every step.${track}`;
    case 'CHECKIN': return `Hello ${n}, the inspection of your ${v} has started. We do not guess faults, we diagnose them properly.${track}`;
    case 'REPORT_READY': return `Hello ${n}, the inspection report for your ${v} is ready.${track}`;
    case 'QUOTE_SENT': return `Hello ${n}, your quotation ${m.ref} for the ${v} is ready${x.total ? ' (total ' + x.total + ')' : ''}. Please review and approve it here: ${x.approve || '(open the quotation page to copy the approval link)'}`;
    case 'APPROVAL_RECEIVED': return `Hello ${n}, thank you for approving the repair on your ${v}. We will start work now.${track}`;
    case 'REPAIR_STARTED': return `Hello ${n}, work has started on your ${v}.${track}`;
    case 'REPAIRS_DONE': return `Hello ${n}, the repairs on your ${v} are complete. We are doing final quality checks.${track}`;
    case 'INVOICE_ISSUED': return `Hello ${n}, your invoice ${m.ref} for the ${v} is ready${x.total ? ': total ' + x.total : ''}${x.balance ? ', balance due ' + x.balance : ''}.${x.link ? ' View and download it as PDF: ' + x.link + '.' : ''}${co.bank_details ? ' Payment details: ' + co.bank_details.replace(/\n/g, ', ') + '.' : ''} Thank you.`;
    case 'PAYMENT_RECEIVED': return `Hello ${n}, we have received your payment${x.paid ? ' of ' + x.paid : ''} for the ${v}. ${x.balance && x.balance !== '0' ? 'Balance remaining: ' + x.balance + '.' : 'Your account is fully paid.'}${x.link ? ' Your receipt (download as PDF): ' + x.link : ''} Thank you.`;
    case 'READY': return `Hello ${n}, your ${v} is ready for collection at ${cn}${co.company_phone ? '. Call ' + co.company_phone + ' for any question' : ''}.`;
    case 'COLLECTED': return `Hello ${n}, thank you for choosing ${cn}. We hope you are happy with the work on your ${v}. If anything is not right, call us and we will fix it. If you know someone who needs a car repair, refer them to us.`;
    default: return `Hello ${n}, an update on your ${v}.`;
  }
}
async function messages() {
  const co = (await sb.rpc('public_company')).data || {}, base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
  const list = h('div'), showAll = h('input', { type: 'checkbox' });
  async function load() {
    list.textContent = '';
    let req = sb.from('customer_messages').select('id,event,status,channel,skip_reason,created_at,ref,job_id,inspection_id,customers(name,phone,email),vehicles(registration,make,model)').order('created_at', { ascending: false }).limit(100);
    if (!showAll.checked) req = req.eq('status', 'QUEUED');
    const { data, error } = await req;
    if (error) return list.append(msg('err', nice(error.message) + (/column|job_id|customers/.test(error.message) ? ' (Run file 14_customer_updates.sql in Supabase first.)' : '')));
    if (!data.length) return list.append(h('div', { class: 'card mut' }, 'Nothing waiting. Every customer is up to date.'));
    const jobs = [...new Set(data.map(m => m.job_id).filter(Boolean))], qids = data.filter(m => m.event === 'QUOTE_SENT').map(m => m.ref), iids = data.filter(m => m.event === 'INVOICE_ISSUED').map(m => m.ref), pids = data.filter(m => m.event === 'PAYMENT_RECEIVED').map(m => m.ref);
    const [insp, qs, qt, it, pays, ivs] = await Promise.all([jobs.length ? sb.from('inspections').select('job_id,tracking_token').in('job_id', jobs) : { data: [] }, qids.length ? sb.from('quotations').select('id,approval_token,currency').in('id', qids) : { data: [] },
      qids.length ? sb.from('v_quotation_totals').select('id,total').in('id', qids) : { data: [] }, iids.length || pids.length ? sb.from('v_invoice_status').select('id,total,balance,currency') : { data: [] }, pids.length ? sb.from('payments').select('id,amount,currency,invoice_id,receipt_token').in('id', pids) : { data: [] }, iids.length ? sb.from('invoices').select('id,view_token').in('id', iids) : { data: [] }]);
    const tok = {}; (insp.data || []).forEach(i => tok[i.job_id] = i.tracking_token);
    for (const m of data) {
      const x = {}; if (m.job_id && tok[m.job_id]) x.track = base + 'track.html?t=' + tok[m.job_id];
      if (m.event === 'QUOTE_SENT') { const q = (qs.data || []).find(y => y.id === m.ref), t = (qt.data || []).find(y => y.id === m.ref); if (q && q.approval_token) x.approve = base + 'approve.html?t=' + q.approval_token; if (q && t) x.total = money(t.total, q.currency); }
      if (m.event === 'INVOICE_ISSUED') { const v = (it.data || []).find(y => y.id === m.ref); if (v) { x.total = money(v.total, v.currency); x.balance = money(v.balance, v.currency); } const iv = (ivs.data || []).find(y => y.id === m.ref); if (iv) x.link = viewUrl('invoice', iv.view_token); }
      if (m.event === 'PAYMENT_RECEIVED') { const p = (pays.data || []).find(y => y.id === m.ref), v = p && (it.data || []).find(y => y.id === p.invoice_id); if (p) { x.paid = money(p.amount, p.currency); if (p.receipt_token) x.link = viewUrl('receipt', p.receipt_token); } if (v) x.balance = Number(v.balance) > 0 ? money(v.balance, v.currency) : '0'; }
      const c = m.customers || {}, text = msgText(m, co, x), age = (Date.now() - new Date(m.created_at)) / 3600000, late = m.status === 'QUEUED' && age > 2;
      const done = async (ch, why) => { const { error: e } = await sb.rpc('mark_message_sent', { p_id: m.id, p_channel: ch, p_reason: why || null }); if (e) return alert(nice(e.message)); load(); };
      const wa = waNumber(c.phone), btns = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px' });
      if (m.status === 'QUEUED') {
        if (wa) { const a = h('a', { class: 'btn p', href: 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text), target: '_blank', rel: 'noopener' }, 'Send on WhatsApp'); a.onclick = () => setTimeout(() => done('WHATSAPP'), 600); btns.append(a); }
        if (c.email) { const a = h('a', { class: 'btn', href: 'mailto:' + c.email + '?subject=' + encodeURIComponent((co.company_name || 'IKETECH AUTO LTD') + ' - ' + MSG_LABEL[m.event]) + '&body=' + encodeURIComponent(text), target: '_blank', rel: 'noopener' }, 'Send by email'); a.onclick = () => setTimeout(() => done('EMAIL'), 600); btns.append(a); }
        const cl = h('button', { type: 'button' }, 'I called them'); cl.onclick = () => done('CALL'); btns.append(cl);
        if (!wa && !c.email) btns.append(h('span', { class: 'err' }, 'No phone or email saved for this customer.'));
        const sk = h('button', { type: 'button' }, 'Skip...'); sk.onclick = () => { const why = prompt('Why skip this message? (for example: told the customer in person)'); if (why && why.trim().length >= 3) done('SKIPPED', why.trim()); }; btns.append(sk);
      }
      list.append(h('div', { class: 'card', style: late ? 'border-left:5px solid var(--bad)' : '' }, h('div', { class: 'row' }, h('b', {}, MSG_LABEL[m.event] || m.event), h('span', { class: 'pill' }, m.status + (m.channel && m.status === 'SENT' ? ' · ' + m.channel.toLowerCase() : ''))),
        h('div', { class: 'mut' }, (c.name || '') + ' · ' + (m.job_id ? 'job ' + m.job_id : '') + ' · ' + new Date(m.created_at).toLocaleString()), late ? h('div', { class: 'err' }, 'Waiting for ' + Math.floor(age) + ' hours. The customer should have been told by now.') : '',
        m.skip_reason ? h('div', { class: 'mut' }, 'Skipped: ' + m.skip_reason) : '', h('div', { style: 'margin-top:6px;font-size:13px;white-space:pre-wrap' }, text), btns));
    }
  }
  showAll.onchange = load;
  show(h('a', { href: '#home' }, '← Home'), h('h2', {}, 'Messages to customers'),
    h('div', { class: 'mut' }, 'A message is prepared at every stage, from the day the vehicle arrives to the day it leaves. Tap a button, your WhatsApp or email opens with the message ready, then press send. A message can only be skipped with a reason, and a vehicle cannot be handed over until the customer has been told it is ready.'),
    h('label', {}, showAll, ' Show sent and skipped too'), list, h('div', { id: 'fu' }));
  load();
  followupsBox(co).then(b => { const t = document.getElementById('fu'); if (t) t.append(b); });
}

// ---- customer updates timeline on the job page ----
async function updatesCard(j) {
  if (!can('ceo', 'manager', 'admin', 'supervisor', 'advisor', 'receptionist')) return '';
  const { data } = await sb.from('customer_messages').select('event,status,channel,created_at').eq('job_id', j.id);
  const by = {}; (data || []).forEach(m => { (by[m.event] = by[m.event] || []).push(m); });
  const box = h('div', { class: 'card' }, h('h3', {}, 'Customer updates'), h('div', { class: 'mut' }, 'Has the customer been told at each stage?'));
  for (const e of MSG_ORDER) { const ms = by[e]; if (!ms && ['PAYMENT_RECEIVED', 'COLLECTED', 'INVOICE_ISSUED', 'QUOTE_SENT'].includes(e)) continue;
    const st = !ms ? 'not due yet' : ms.every(x => x.status === 'SENT') ? 'sent' : ms.some(x => x.status === 'QUEUED') ? 'WAITING TO BE SENT' : 'skipped';
    box.append(h('div', { class: 'row' }, h('span', {}, MSG_LABEL[e]), h('span', { class: st === 'WAITING TO BE SENT' ? 'err' : st === 'sent' ? 'okm' : 'mut', style: 'margin:0' }, st))); }
  box.append(h('a', { href: '#messages' }, 'Open Messages →'));
  return box;
}

// ---- payroll (CEO and people the CEO allows; every action goes through database functions) ----
async function payroll(tab) {
  if (!(can('ceo') || me.can_see_payroll)) return show(msg('err', 'Payroll is private.'));
  tab = ['runs', 'staff', 'advances', 'rates'].includes(tab) ? tab : 'runs';
  const month = h('input', { type: 'month', value: sessionStorage.getItem('paymonth') || new Date().toISOString().slice(0, 7) });
  month.onchange = () => { try { sessionStorage.setItem('paymonth', month.value); } catch (e) {} draw(); };
  const body = h('div'), nav = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin:10px 0' },
    [['runs', 'Pay runs'], ['staff', 'Staff'], ['advances', 'Advances'], ['rates', 'Tax and rates']].map(([k, l]) => h('a', { href: '#payroll/' + k, class: 'btn' + (k === tab ? ' p' : '') }, l)));
  show(h('a', { href: '#home' }, '← Home'), h('h2', {}, 'Payroll'), nav, body);
  const N = x => Number(x || 0), fmt = x => money(x, 'NGN');
  async function draw() {
    body.textContent = '';
    const { data, error } = await sb.rpc('payroll_overview', { p_month: month.value || new Date().toISOString().slice(0, 7) });
    if (error) return body.append(msg('err', nice(error.message) + (/payroll_overview/.test(error.message) ? ' (Run file 11_payroll.sql in Supabase first.)' : '')));
    ({ runs: tRuns, staff: tStaff, advances: tAdv, rates: tRates }[tab])(data);
  }
  const call = async (fn, args, out, then) => { const { data, error } = await sb.rpc(fn, args); if (error) { out.textContent = ''; out.append(msg('err', nice(error.message))); return false; } if (then) then(data); return true; };

  function tRuns(d) {
    const out = h('div'), gen = h('button', { class: 'p', type: 'button' }, 'Generate draft for this month');
    gen.onclick = async () => { out.textContent = ''; if (await call('payroll_generate', { p_month: month.value }, out, n => out.append(msg('okm', n + ' draft pay line(s) created.')))) setTimeout(draw, 700); };
    body.append(h('div', { class: 'card' }, field('Month', month), gen, out));
    if (!d.runs.length) return body.append(h('div', { class: 'card mut' }, 'No pay lines for this month yet. Add staff first, then generate.'));
    const sum = k => d.runs.reduce((a, r) => a + N(r[k]), 0);
    body.append(h('div', { class: 'card' }, h('h3', {}, 'Month summary'),
      [['Staff', d.runs.length], ['Gross pay', fmt(sum('gross'))], ['Net pay (to pay staff)', fmt(sum('net'))], ['Pension + PAYE + NHF to remit', fmt(sum('pension_employee') + sum('pension_employer') + sum('paye') + sum('nhf'))], ['Total cost to company', fmt(sum('employer_cost'))]]
        .map(([a, b]) => h('div', { class: 'row' }, h('span', {}, a), h('b', {}, String(b))))));
    for (const r of d.runs) {
      const bonus = h('input', { type: 'number', min: 0, step: '0.01', value: N(r.bonus) }), cb = h('input', { type: 'number', min: 0, step: '0.01', value: N(r.commission_base) }), od = h('input', { type: 'number', min: 0, step: '0.01', value: N(r.other_deduction) });
      const o = h('div'), btns = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px' });
      const act = (label, fn, cls) => { const b = h('button', { type: 'button', class: cls || '' }, label); b.onclick = fn; btns.append(b); };
      if (r.status === 'DRAFT') {
        act('Recalculate', async () => { if (await call('payroll_recalc', { p_id: r.id, p_bonus: N(bonus.value), p_comm_base: N(cb.value), p_other: N(od.value) }, o)) draw(); });
        act('Approve', async () => { if (await call('payroll_approve', { p_id: r.id }, o)) draw(); }, 'p');
      }
      if (r.status === 'APPROVED') act('Mark paid', async () => { const ref = prompt('Payment reference (optional)') ; if (ref === null) return; if (await call('payroll_pay', { p_id: r.id, p_date: null, p_method: 'Bank transfer', p_ref: ref }, o)) draw(); }, 'p');
      if (['DRAFT', 'APPROVED', 'PAID'].includes(r.status)) act('Reverse', async () => { const why = prompt('Why are you reversing this line?'); if (!why) return; if (await call('payroll_reverse', { p_id: r.id, p_reason: why }, o)) draw(); });
      btns.append(h('a', { class: 'btn', href: 'payslip.html?id=' + encodeURIComponent(r.id), target: '_blank', rel: 'noopener' }, 'Payslip'));
      body.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', {}, r.name), h('span', { class: 'pill' }, r.status)),
        h('div', { class: 'row' }, h('span', {}, 'Gross ' + fmt(r.gross)), h('span', { class: 'mut' }, 'Pension ' + fmt(r.pension_employee) + ' · PAYE ' + fmt(r.paye) + (N(r.advance_repayment) ? ' · Advance ' + fmt(r.advance_repayment) : ''))),
        h('div', { class: 'row' }, h('b', {}, 'Net pay'), h('b', {}, fmt(r.net))), r.notes ? h('div', { class: 'err' }, r.notes) : '',
        r.status === 'DRAFT' ? h('div', {}, field('Bonus', bonus), field('Sales amount for commission', cb), field('Other deduction', od)) : '', btns, o));
    }
  }

  function tStaff(d) {
    const form = (e) => {
      e = e || {}; const f = {}, mk = (k, type, label, extra) => { f[k] = h('input', Object.assign({ type: type || 'text', value: e[k] ?? '' }, extra || {})); return field(label, f[k]); };
      const chk = (k, label) => { f[k] = h('input', { type: 'checkbox' }); f[k].checked = e[k] === undefined ? k === 'pension_applies' : !!e[k]; return h('label', { style: 'display:block' }, f[k], ' ' + label); };
      const st = h('select', {}, ['ACTIVE', 'LEFT', 'SUSPENDED'].map(x => h('option', { selected: (e.status || 'ACTIVE') === x }, x))), out = h('div'), save = h('button', { class: 'p', type: 'button' }, e.id ? 'Save changes' : 'Add staff');
      save.onclick = async () => {
        const p = { id: e.id || '', status: st.value }; for (const k of ['name', 'job_title', 'email', 'monthly_basic', 'housing', 'transport', 'other_allowance', 'commission_pct', 'start_date', 'bank', 'account_number']) p[k] = f[k].value;
        for (const k of ['pension_applies', 'nhf_applies', 'paye_applies']) p[k] = f[k].checked; p.branch_id = me.branch_id || '';
        out.textContent = ''; if (await call('payroll_save_employee', { p }, out, () => out.append(msg('okm', 'Saved.')))) setTimeout(draw, 600);
      };
      return h('div', {}, mk('name', 'text', 'Full name'), mk('job_title', 'text', 'Job title'), mk('email', 'email', 'Email'), mk('monthly_basic', 'number', 'Monthly basic salary (₦)', { min: 0, step: '0.01' }), mk('housing', 'number', 'Housing allowance (₦)', { min: 0 }),
        mk('transport', 'number', 'Transport allowance (₦)', { min: 0 }), mk('other_allowance', 'number', 'Other allowance (₦)', { min: 0 }), mk('commission_pct', 'number', 'Commission % of sales amount', { min: 0, max: 100, step: '0.01' }),
        chk('pension_applies', 'Pension applies'), chk('nhf_applies', 'Housing fund (NHF) applies'), chk('paye_applies', 'PAYE tax applies'), mk('start_date', 'date', 'Start date'), field('Status', st), mk('bank', 'text', 'Bank'), mk('account_number', 'text', 'Account number'), save, out);
    };
    body.append(h('div', { class: 'card' }, h('h3', {}, 'Add staff'), form()));
    for (const e of d.employees) { const det = h('details', { class: 'card' }, h('summary', {}, h('b', {}, e.name), ' · ' + (e.job_title || '') + ' · ' + fmt(e.monthly_basic) + ' · ' + e.status), form(e)); body.append(det); }
  }

  function tAdv(d) {
    const sel = h('select', {}, d.employees.filter(e => e.status === 'ACTIVE').map(e => h('option', { value: e.id }, e.name))), amt = h('input', { type: 'number', min: 1, step: '0.01' }), mo = h('input', { type: 'number', min: 1, step: '0.01' }), nt = h('input'), out = h('div'), b = h('button', { class: 'p', type: 'button' }, 'Record advance');
    b.onclick = async () => { out.textContent = ''; if (await call('payroll_add_advance', { p_emp: sel.value, p_amount: N(amt.value), p_monthly: N(mo.value), p_notes: nt.value }, out)) draw(); };
    body.append(h('div', { class: 'card' }, h('h3', {}, 'New salary advance'), field('Staff', sel), field('Amount (₦)', amt), field('Monthly repayment (₦)', mo), field('Note', nt), b, out));
    if (!d.advances.length) body.append(h('div', { class: 'card mut' }, 'No advances recorded.'));
    for (const a of d.advances) {
      const o = h('div'), c = h('button', { type: 'button' }, 'Cancel'); c.onclick = async () => { if (confirm('Cancel this advance?') && await call('payroll_cancel_advance', { p_id: a.id }, o)) draw(); };
      body.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', {}, a.name), h('span', { class: 'pill' }, a.status)), h('div', { class: 'mut' }, fmt(a.amount) + ' · repays ' + fmt(a.monthly_repayment) + ' a month · given ' + a.given_on),
        a.status === 'ACTIVE' ? h('div', {}, 'Still owed: ', h('b', {}, fmt(a.balance)), ' ', c) : '', o));
    }
  }

  function tRates(d) {
    const r = {}, out = h('div'), box = h('div', { class: 'card' }, h('h3', {}, 'Rates'), h('div', { class: 'mut' }, 'Confirm every figure with your accountant. These drive every pay run.'));
    for (const x of d.rates) { r[x.key] = h('input', { type: 'number', min: 0, step: '0.01', value: x.value }); box.append(field(x.key.replace(/_/g, ' ').toLowerCase() + (x.note ? ' - ' + x.note : ''), r[x.key])); }
    const bands = h('div', { class: 'card' }, h('h3', {}, 'PAYE tax bands (per year)'), h('div', { class: 'mut' }, 'Enter bands from the current tax law, in order. Leave the size empty on the last band (= the rest). Until set, PAYE shows 0 with a warning.'));
    const rows = []; const addRow = (b) => { const sz = h('input', { type: 'number', min: 0, placeholder: 'Band size ₦ per year (empty = the rest)', value: b && b.band_size != null ? b.band_size : '' }), rt = h('input', { type: 'number', min: 0, max: 100, step: '0.01', placeholder: 'Rate %', value: b ? b.rate_pct : '' }); rows.push({ sz, rt }); bands.insertBefore(h('div', { style: 'display:flex;gap:8px;margin-top:6px' }, sz, rt), more); };
    const more = h('button', { type: 'button' }, '+ Add band'); more.onclick = () => addRow(); bands.append(more); d.bands.forEach(addRow);
    const save = h('button', { class: 'p', type: 'button' }, 'Save rates and bands');
    save.onclick = async () => { out.textContent = ''; const rates = {}; for (const k in r) rates[k] = N(r[k].value); const bs = rows.filter(x => x.rt.value !== '').map(x => ({ band_size: x.sz.value === '' ? null : N(x.sz.value), rate_pct: N(x.rt.value) }));
      if (await call('payroll_save_rates', { p_rates: rates, p_bands: bs }, out, () => out.append(msg('okm', 'Saved. Recalculate any draft lines to use the new rates.')))) {} };
    body.append(box, bands, save, out);
  }
  draw();
}

// ---- quality check (on the job page) ----
const QC_ITEMS = [['road_test', 'Road test done and drives properly'], ['faults', 'Warning lights off and fault codes cleared'], ['leaks', 'No leaks (oil, coolant, fuel, brake fluid)'], ['torque', 'Wheels, nuts and bolts tightened'],
  ['fluids', 'Fluids topped up to the right level'], ['complaint', 'The customer complaint is fixed'], ['old_parts', 'Old parts kept or shown to the customer'], ['clean', 'Vehicle cleaned, no grease marks, items put back']];
async function qcCard(j) {
  if (!can('ceo', 'manager', 'admin', 'supervisor', 'advisor')) return '';
  const { data: hist } = await sb.from('qc_checks').select('result,notes,checked_at,checked_by').eq('job_id', j.id).order('checked_at', { ascending: false });
  const box = h('div', { class: 'card' }, h('h3', {}, 'Quality check')), out = h('div');
  const last = (hist || [])[0];
  box.append(h('div', { class: 'mut' }, last ? 'Latest result: ' + last.result + ' on ' + new Date(last.checked_at).toLocaleDateString() + (last.notes ? ' - ' + last.notes : '') : 'No quality check yet. A vehicle cannot be marked ready until one is passed.'));
  if (can('ceo', 'manager', 'supervisor') && !['COLLECTED', 'CANCELLED'].includes(j.status)) {
    const ck = {}, list = h('div'), nt = h('input', { placeholder: 'If anything fails, say what' });
    QC_ITEMS.forEach(([k, l]) => { ck[k] = h('input', { type: 'checkbox' }); list.append(h('label', { style: 'display:block;margin:6px 0' }, ck[k], ' ' + l)); });
    const go = h('button', { class: 'p', type: 'button' }, 'Record quality check');
    go.onclick = async () => {
      out.textContent = ''; const checks = {}; QC_ITEMS.forEach(([k]) => checks[k] = ck[k].checked);
      const { data, error } = await sb.rpc('record_qc', { p_job: j.id, p_checks: checks, p_notes: nt.value });
      if (error) return out.append(msg('err', nice(error.message)));
      out.append(msg(data === 'PASS' ? 'okm' : 'err', data === 'PASS' ? 'Passed. The vehicle can now be marked ready.' : 'Failed. The job went back to repair.')); setTimeout(() => job(j.id), 1200);
    };
    box.append(list, field('Notes', nt), go, out);
  }
  if ((hist || []).length > 1) box.append(h('div', { class: 'mut', style: 'margin-top:8px' }, 'Earlier: ' + hist.slice(1).map(x => x.result + ' ' + new Date(x.checked_at).toLocaleDateString()).join(' · ')));
  return box;
}

// ---- referrer on the customer page ----
async function referrerCard(c) {
  if (!can('ceo', 'manager', 'admin', 'advisor', 'receptionist')) return '';
  const { data: refs } = await sb.from('referrers').select('id,name,phone').eq('is_active', true).order('name');
  const sel = h('select', {}, h('option', { value: '' }, 'Not referred'), (refs || []).map(r => h('option', { value: r.id, selected: c.referred_by === r.id }, r.name + (r.phone ? ' (' + r.phone + ')' : '')))), out = h('div'), b = h('button', { type: 'button' }, 'Save');
  b.onclick = async () => { out.textContent = ''; const { error } = await sb.from('customers').update({ referred_by: sel.value || null }).eq('id', c.id); out.append(error ? msg('err', nice(error.message)) : msg('okm', 'Saved.')); };
  return h('div', { class: 'card' }, h('h3', {}, 'Referred by'), h('div', { class: 'mut' }, 'The referrer earns a reward when this customer pays an invoice in full.'), sel, b, out);
}

// ---- CEO dashboard ----
async function dashboard() {
  if (!can('ceo', 'manager')) return show(msg('err', 'The dashboard is for the CEO and managers.'));
  const today = new Date().toISOString().slice(0, 10), first = today.slice(0, 8) + '01';
  const from = h('input', { type: 'date', value: first }), to = h('input', { type: 'date', value: today }), body = h('div');
  const mny = o => { const k = Object.keys(o || {}); return k.length ? k.map(c => money(o[c], c)).join(' + ') : '0'; };
  const tile = (label, value, sub, warn) => h('div', { class: 'tile', style: warn ? 'border-color:#c01048' : '' }, h('small', {}, label), h('b', { style: 'font-size:20px;display:block;margin:4px 0' }, String(value)), sub ? h('small', {}, sub) : '');
  async function draw() {
    body.textContent = '';
    const { data: d, error } = await sb.rpc('ceo_dashboard', { p_from: from.value, p_to: to.value });
    if (error) return body.append(msg('err', nice(error.message) + (/ceo_dashboard/.test(error.message) ? ' (Run file 12_operations.sql in Supabase first.)' : '')));
    const qcT = d.qc_pass + d.qc_fail, conv = d.quotes_sent ? Math.round(100 * d.quotes_approved / d.quotes_sent) : null;
    body.append(h('div', { class: 'grid' }, tile('Money collected', mny(d.collected), 'in this period'), tile('Invoiced', mny(d.invoiced), 'issued in this period'), tile('Still owed to us', mny(d.outstanding), 'all open invoices'),
      tile('Overdue', mny(d.overdue), 'past the due date', Object.keys(d.overdue || {}).length > 0)),
      h('div', { class: 'grid', style: 'margin-top:10px' }, tile('Vehicles in', d.jobs_in, 'new jobs'), tile('Vehicles out', d.jobs_out, 'collected'), tile('Ready, not collected', d.ready_not_collected, 'customers to call', d.ready_not_collected > 0),
        tile('Quotations waiting', d.quotes_waiting, 'customer has not answered'), tile('Quotation approval rate', conv === null ? '-' : conv + '%', d.quotes_approved + ' of ' + d.quotes_sent + ' sent'), tile('Quality checks passed', qcT ? Math.round(100 * d.qc_pass / qcT) + '%' : '-', d.qc_fail + ' failed (rework)', d.qc_fail > 0)),
      h('div', { class: 'grid', style: 'margin-top:10px' }, tile('Inspections', d.inspections, d.inspections_waiting_review + ' waiting for review', d.inspections_waiting_review > 0), tile('Referral rewards owed', mny(d.referral_owed), 'earned, not yet paid'),
        tile('Customer messages waiting', d.messages_waiting, (d.messages_overdue || 0) + ' waiting over 2 hours', (d.messages_overdue || 0) > 0)));
    const st = Object.entries(d.jobs_by_status || {});
    body.append(h('div', { class: 'card', style: 'margin-top:10px' }, h('h3', {}, 'Jobs in the workshop now'), st.length ? st.map(([k, v]) => h('div', { class: 'row' }, h('span', {}, k.replace(/_/g, ' ')), h('b', {}, String(v)))) : h('div', { class: 'mut' }, 'No open jobs.')));
    body.append(h('div', { class: 'card' }, h('h3', {}, 'By branch'), (d.branches || []).map(b => h('div', { class: 'row' }, h('span', {}, b.name, h('div', { class: 'mut' }, (b.country || '') + ' · ' + b.jobs_in + ' new jobs · ' + b.open_jobs + ' open')), h('b', {}, mny(b.collected))))));
  }
  from.onchange = to.onchange = draw;
  show(h('a', { href: '#home' }, '← Home'), h('h2', {}, 'CEO dashboard'), h('div', { class: 'card', style: 'display:flex;gap:10px;flex-wrap:wrap' }, field('From', from), field('To', to)), body);
  draw();
}

// ---- credit control ----
async function credit() {
  if (!can('ceo', 'manager', 'admin', 'accounting', 'advisor')) return show(msg('err', 'Not allowed.'));
  const co = (await sb.rpc('public_company')).data || {}, body = h('div');
  show(h('a', { href: '#home' }, '← Home'), h('h2', {}, 'Credit control'), body);
  async function draw() {
    body.textContent = '';
    const { data: rows, error } = await sb.rpc('credit_control');
    if (error) return body.append(msg('err', nice(error.message) + (/credit_control/.test(error.message) ? ' (Run file 12_operations.sql in Supabase first.)' : '')));
    if (!rows.length) return body.append(h('div', { class: 'card okm' }, 'Nobody owes the workshop anything. Well done.'));
    const bucket = d => d <= 0 ? 'Not yet due' : d <= 30 ? '1-30 days late' : d <= 60 ? '31-60 days late' : 'Over 60 days late';
    const tot = {}; rows.forEach(r => { const k = bucket(r.days_overdue); (tot[k] = tot[k] || {}); tot[k][r.currency] = (tot[k][r.currency] || 0) + Number(r.balance); });
    body.append(h('div', { class: 'card' }, h('h3', {}, 'Ageing'), ['Not yet due', '1-30 days late', '31-60 days late', 'Over 60 days late'].map(k => h('div', { class: 'row' }, h('span', {}, k), h('b', {}, tot[k] ? Object.keys(tot[k]).map(c => money(tot[k][c], c)).join(' + ') : '-')))));
    for (const r of rows) {
      const wa = waNumber(r.phone), out = h('div'), first = (r.customer || '').split(' ')[0];
      const text = `Hello ${first}, this is a friendly reminder from ${co.company_name || 'IKETECH AUTO LTD'}. Invoice ${r.invoice} for your vehicle ${r.vehicle} has a balance of ${money(r.balance, r.currency)}${r.due_date ? ' which was due on ' + r.due_date : ''}. ` + (co.bank_details ? 'Payment details: ' + co.bank_details.replace(/\n/g, ', ') + '. ' : '') + 'Thank you.';
      const btns = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px' });
      const log = async ch => { const { error: e } = await sb.rpc('log_reminder', { p_invoice: r.invoice, p_channel: ch, p_note: '' }); if (e) out.append(msg('err', nice(e.message))); else draw(); };
      if (wa) { const a = h('a', { class: 'btn p', href: 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text), target: '_blank', rel: 'noopener' }, 'Remind on WhatsApp'); a.onclick = () => setTimeout(() => log('WHATSAPP'), 600); btns.append(a); }
      if (r.email) { const a = h('a', { class: 'btn', href: 'mailto:' + r.email + '?subject=' + encodeURIComponent('Payment reminder ' + r.invoice) + '&body=' + encodeURIComponent(text), target: '_blank', rel: 'noopener' }, 'Remind by email'); a.onclick = () => setTimeout(() => log('EMAIL'), 600); btns.append(a); }
      const call = h('button', { type: 'button' }, 'I called them'); call.onclick = () => log('CALL'); btns.append(call, h('a', { class: 'btn', href: '#invoice/' + r.invoice }, 'Open invoice'));
      body.append(h('div', { class: 'card', style: r.days_overdue > 30 ? 'border-left:5px solid #c01048' : '' }, h('div', { class: 'row' }, h('b', {}, r.customer), h('b', {}, money(r.balance, r.currency))),
        h('div', { class: 'mut' }, r.invoice + ' · ' + r.vehicle + ' · ' + (r.phone || 'no phone') + (r.vehicle_collected ? ' · vehicle already collected' : ' · vehicle still here')),
        h('div', { class: r.days_overdue > 0 ? 'err' : 'mut' }, r.days_overdue > 0 ? r.days_overdue + ' days overdue (due ' + (r.due_date || r.issue_date) + ')' : 'Not yet due'),
        h('div', { class: 'mut' }, r.reminders ? r.reminders + ' reminder(s), last on ' + new Date(r.last_reminder).toLocaleDateString() : 'No reminder sent yet'), btns, out));
    }
  }
  draw();
}

// ---- referrals ----
async function referrals() {
  if (!can('ceo', 'manager', 'admin', 'accounting')) return show(msg('err', 'Not allowed.'));
  const body = h('div'); show(h('a', { href: '#home' }, '← Home'), h('h2', {}, 'Referrals'), body);
  async function draw() {
    body.textContent = '';
    const { data: d, error } = await sb.rpc('referral_overview');
    if (error) return body.append(msg('err', nice(error.message) + (/referral_overview/.test(error.message) ? ' (Run file 12_operations.sql in Supabase first.)' : '')));
    const name = h('input'), phone = h('input', { type: 'tel' }), bank = h('input'), out = h('div'), add = h('button', { class: 'p', type: 'button' }, 'Add referrer');
    add.onclick = async () => { out.textContent = ''; const { error: e } = await sb.from('referrers').insert({ name: name.value.trim(), phone: phone.value.trim() || null, bank_details: bank.value.trim() || null }); if (e) return out.append(msg('err', nice(e.message))); draw(); };
    body.append(h('div', { class: 'card' }, h('h3', {}, 'New referrer'), h('div', { class: 'mut' }, 'Reward: ' + d.rate + '% of the invoice total, earned when the referred customer pays in full. Link a customer to a referrer on the customer page.'), field('Name', name), field('Phone', phone), field('Bank details', bank), add, out));
    const wait = d.rewards.filter(w => w.status === 'EARNED');
    body.append(h('h3', {}, 'Rewards waiting to be paid'));
    if (!wait.length) body.append(h('div', { class: 'card mut' }, 'None right now.'));
    for (const w of wait) { const o = h('div'), pay = h('button', { class: 'p', type: 'button' }, 'Mark paid'), vd = h('button', { type: 'button' }, 'Cancel');
      pay.onclick = async () => { const { error: e } = await sb.rpc('pay_referral', { p_id: w.id }); if (e) o.append(msg('err', nice(e.message))); else draw(); };
      vd.onclick = async () => { if (!confirm('Cancel this reward?')) return; const { error: e } = await sb.rpc('void_referral', { p_id: w.id }); if (e) o.append(msg('err', nice(e.message))); else draw(); };
      body.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', {}, w.referrer), h('b', {}, money(w.reward, w.currency))), h('div', { class: 'mut' }, 'For ' + (w.customer || '') + ' · invoice ' + w.invoice + ' · ' + w.rate + '% of ' + money(w.base, w.currency)),
        h('div', { class: 'mut' }, [w.referrer_phone, w.bank_details].filter(Boolean).join(' · ')), h('div', { style: 'display:flex;gap:8px;margin-top:8px' }, pay, vd), o)); }
    body.append(h('h3', {}, 'Referrers'));
    for (const r of d.referrers) body.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', {}, r.name), h('span', { class: 'pill' }, r.customers + ' customer(s)')), h('div', { class: 'mut' }, [r.phone, r.bank_details].filter(Boolean).join(' · ')),
      h('div', { class: 'row' }, h('span', {}, 'Owed now'), h('b', {}, String(r.owed))), h('div', { class: 'row' }, h('span', {}, 'Paid so far'), h('b', {}, String(r.paid)))));
    const done = d.rewards.filter(w => w.status !== 'EARNED');
    if (done.length) body.append(h('h3', {}, 'History'), h('div', { class: 'card' }, done.map(w => h('div', { class: 'row' }, h('span', {}, w.referrer + ' · ' + w.invoice), h('span', {}, money(w.reward, w.currency) + ' · ' + w.status)))));
  }
  draw();
}

// ---- technicians ----
async function technicians() {
  if (!can('ceo', 'manager', 'supervisor')) return show(msg('err', 'Not allowed.'));
  const today = new Date().toISOString().slice(0, 10), from = h('input', { type: 'date', value: today.slice(0, 8) + '01' }), to = h('input', { type: 'date', value: today }), body = h('div');
  async function draw() {
    body.textContent = '';
    const { data: rows, error } = await sb.rpc('technician_scorecard', { p_from: from.value, p_to: to.value });
    if (error) return body.append(msg('err', nice(error.message) + (/technician_scorecard/.test(error.message) ? ' (Run file 12_operations.sql in Supabase first.)' : '')));
    if (!rows.length) return body.append(h('div', { class: 'card mut' }, 'No technicians yet. Add them on the Team page with the role technician.'));
    for (const r of rows) { const t = r.qc_pass + r.qc_fail, pct = t ? Math.round(100 * r.qc_pass / t) : null;
      body.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', {}, r.name), h('span', { class: 'pill' }, r.jobs_open + ' open now')),
        [['Jobs given in this period', r.jobs_assigned], ['Jobs finished (ready or collected)', r.jobs_done], ['Inspections done', r.inspections], ['Quality check passed first time', pct === null ? '-' : pct + '% (' + r.qc_pass + ' pass, ' + r.qc_fail + ' failed)'], ['Average days from in to out', r.avg_days === null ? '-' : r.avg_days]]
          .map(([a, b]) => h('div', { class: 'row' }, h('span', {}, a), h('b', { class: (a.startsWith('Quality') && r.qc_fail > 0) ? 'err' : '' }, String(b)))))); }
  }
  from.onchange = to.onchange = draw;
  show(h('a', { href: '#home' }, '← Home'), h('h2', {}, 'Technicians'), h('div', { class: 'card', style: 'display:flex;gap:10px;flex-wrap:wrap' }, field('From', from), field('To', to)), body);
  draw();
}

// ---- job costing ----
async function costCard(j) {
  if (!can('ceo', 'manager', 'admin', 'accounting', 'supervisor')) return '';
  const [{ data: costs }, { data: invs }] = await Promise.all([sb.from('job_costs').select('id,kind,description,supplier,amount,created_at').eq('job_id', j.id).order('created_at'),
    sb.from('invoices').select('id,currency,fx_rate,status').eq('job_id', j.id).eq('status', 'ISSUED')]);
  let rev = 0; if ((invs || []).length) { const { data: t } = await sb.from('v_invoice_status').select('id,total').in('id', invs.map(i => i.id)); (t || []).forEach(x => { const i = invs.find(y => y.id === x.id); rev += Number(x.total) * (i.currency === 'NGN' ? 1 : Number(i.fx_rate || 1)); }); }
  const cost = (costs || []).reduce((a, c) => a + Number(c.amount), 0), profit = rev - cost;
  const box = h('div', { class: 'card' }, h('h3', {}, 'Job costing (naira)'), h('div', { class: 'mut' }, 'What this job cost us. Customers and technicians never see this.')), out = h('div');
  for (const c of costs || []) box.append(h('div', { class: 'row' }, h('span', {}, h('b', {}, c.description), h('div', { class: 'mut' }, c.kind + (c.supplier ? ' · ' + c.supplier : ''))),
    h('span', {}, money(c.amount, 'NGN'), ' ', can('ceo', 'manager', 'accounting') ? h('button', { type: 'button', style: 'color:var(--bad);background:none;border:0;cursor:pointer', onclick: async () => { if (!confirm('Remove this cost?')) return; const { error } = await sb.rpc('delete_job_cost', { p_id: c.id }); if (error) out.append(msg('err', nice(error.message))); else job(j.id); } }, 'Remove') : '')));
  box.append(h('div', { class: 'row' }, h('span', {}, 'Total cost'), h('b', {}, money(cost, 'NGN'))), h('div', { class: 'row' }, h('span', {}, 'Invoiced to customer'), h('b', {}, money(rev, 'NGN'))),
    h('div', { class: 'row' }, h('b', {}, 'Profit'), h('b', { class: profit < 0 ? 'err' : 'okm', style: 'margin:0' }, money(profit, 'NGN') + (rev > 0 ? ' (' + Math.round(100 * profit / rev) + '%)' : ''))));
  const kind = h('select', {}, ['PART', 'LABOUR', 'SUBLET', 'OTHER'].map(x => h('option', {}, x))), desc = h('input', { placeholder: 'e.g. Starter motor' }), sup = h('input', { placeholder: 'Supplier (optional)' }), amt = h('input', { type: 'number', min: 0, step: '0.01', placeholder: 'Amount we paid' }), add = h('button', { class: 'p', type: 'button' }, 'Add cost');
  add.onclick = async () => { out.textContent = ''; const { error } = await sb.rpc('add_job_cost', { p_job: j.id, p_kind: kind.value, p_desc: desc.value, p_supplier: sup.value, p_amount: Number(amt.value) }); if (error) return out.append(msg('err', nice(error.message))); job(j.id); };
  box.append(field('Add a cost', kind), desc, sup, amt, add, out);
  return box;
}

async function costing() {
  if (!can('ceo', 'manager', 'admin', 'accounting')) return show(msg('err', 'Not allowed.'));
  const today = new Date().toISOString().slice(0, 10), from = h('input', { type: 'date', value: today.slice(0, 8) + '01' }), to = h('input', { type: 'date', value: today }), body = h('div');
  async function draw() {
    body.textContent = '';
    const { data: rows, error } = await sb.rpc('job_profit', { p_from: from.value, p_to: to.value });
    if (error) return body.append(msg('err', nice(error.message) + (/job_profit/.test(error.message) ? ' (Run file 13_costing_comms.sql in Supabase first.)' : '')));
    if (!rows.length) return body.append(h('div', { class: 'card mut' }, 'No invoiced or costed jobs in this period. Add costs on each job page.'));
    const sum = k => rows.reduce((a, r) => a + Number(r[k]), 0), rev = sum('revenue'), cost = sum('cost');
    body.append(h('div', { class: 'card' }, h('h3', {}, 'Totals'), h('div', { class: 'row' }, h('span', {}, 'Invoiced'), h('b', {}, money(rev, 'NGN'))), h('div', { class: 'row' }, h('span', {}, 'Cost'), h('b', {}, money(cost, 'NGN'))),
      h('div', { class: 'row' }, h('b', {}, 'Profit'), h('b', {}, money(rev - cost, 'NGN') + (rev > 0 ? ' (' + Math.round(100 * (rev - cost) / rev) + '%)' : '')))),
      h('div', { class: 'mut' }, 'Worst margin first. A job with no cost entered shows full revenue as profit, so enter costs on every job.'));
    for (const r of rows) body.append(h('a', { class: 'card', href: '#job/' + r.job, style: 'display:block;color:inherit;text-decoration:none' }, h('div', { class: 'row' }, h('b', {}, r.job + ' · ' + r.vehicle), h('b', { class: Number(r.profit) < 0 ? 'err' : '', style: 'margin:0' }, money(r.profit, 'NGN'))),
      h('div', { class: 'mut' }, r.customer + ' · invoiced ' + money(r.revenue, 'NGN') + ' · cost ' + money(r.cost, 'NGN') + (r.margin_pct !== null ? ' · margin ' + r.margin_pct + '%' : '') + (Number(r.cost) === 0 ? ' · NO COST ENTERED' : ''))));
  }
  from.onchange = to.onchange = draw;
  show(h('a', { href: '#home' }, '← Home'), h('h2', {}, 'Job costing'), h('div', { class: 'card', style: 'display:flex;gap:10px;flex-wrap:wrap' }, field('From', from), field('To', to)), body);
  draw();
}

// ---- client communication log (on the customer page) ----
async function commsCard(c) {
  if (!can('ceo', 'manager', 'admin', 'supervisor', 'advisor', 'receptionist', 'accounting')) return '';
  const { data: log } = await sb.from('customer_comms').select('channel,direction,topic,note,at').eq('customer_id', c.id).order('at', { ascending: false }).limit(30);
  const box = h('div', { class: 'card' }, h('h3', {}, 'Conversations with this customer'));
  if (!(log || []).length) box.append(h('div', { class: 'mut' }, 'Nothing recorded yet.'));
  for (const m of log || []) box.append(h('div', { class: 'row' }, h('span', {}, h('b', {}, (m.direction === 'OUT' ? 'We → ' : 'Customer → ') + m.channel.toLowerCase()), ' · ' + m.topic.replace(/_/g, ' ').toLowerCase(), m.note ? h('div', { class: 'mut' }, m.note) : ''), h('span', { class: 'mut' }, new Date(m.at).toLocaleDateString())));
  const ch = h('select', {}, ['CALL', 'WHATSAPP', 'EMAIL', 'VISIT', 'SMS', 'OTHER'].map(x => h('option', {}, x))), dir = h('select', {}, h('option', { value: 'OUT' }, 'We contacted them'), h('option', { value: 'IN' }, 'They contacted us')),
    tp = h('select', {}, [['UPDATE', 'Update on the repair'], ['QUOTE', 'Quotation'], ['PAYMENT', 'Payment'], ['COMPLAINT', 'Complaint'], ['FOLLOW_UP', 'Follow-up'], ['SERVICE_REMINDER', 'Service reminder'], ['OTHER', 'Other']].map(([v, l]) => h('option', { value: v }, l))),
    note = h('input', { placeholder: 'What was said' }), out = h('div'), b = h('button', { class: 'p', type: 'button' }, 'Save note');
  b.onclick = async () => { out.textContent = ''; const { error } = await sb.rpc('add_comm', { p_customer: c.id, p_job: '', p_channel: ch.value, p_direction: dir.value, p_topic: tp.value, p_note: note.value }); if (error) return out.append(msg('err', nice(error.message))); customer(c.id); };
  box.append(h('h4', {}, 'Record a conversation'), ch, dir, tp, note, b, out);
  return box;
}

// ---- follow-ups (shown on the Messages page) ----
async function followupsBox(co) {
  const { data: rows, error } = await sb.rpc('followups_due');
  if (error) return h('div', { class: 'card mut' }, /followups_due/.test(error.message) ? 'Run file 13_costing_comms.sql in Supabase to turn on follow-ups.' : nice(error.message));
  const box = h('div', {}, h('h3', {}, 'Follow-ups due'), h('div', { class: 'mut' }, 'Three days after collection we ask how the car is. After six months we remind them about a service.'));
  if (!rows.length) box.append(h('div', { class: 'card mut' }, 'No follow-ups due today.'));
  for (const r of rows) {
    const first = (r.customer || '').split(' ')[0], wa = waNumber(r.phone), out = h('div'), co_ = co.company_name || 'IKETECH AUTO LTD';
    const text = r.kind === 'FOLLOW_UP' ? `Hello ${first}, this is ${co_}. We hope your ${r.vehicle} is running well since we released it. If you notice anything at all, please call us and we will look at it. Thank you for choosing us.`
      : `Hello ${first}, it has been about six months since we worked on your ${r.vehicle}. It is a good time for a service check so small issues do not become big ones. Reply to book a time. ${co_}`;
    const log = async () => { const { error: e } = await sb.rpc('add_comm', { p_customer: r.customer_id, p_job: r.job, p_channel: 'WHATSAPP', p_direction: 'OUT', p_topic: r.kind, p_note: 'Sent from follow-ups' }); if (e) out.append(msg('err', nice(e.message))); else messages(); };
    const btns = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px' });
    if (wa) { const a = h('a', { class: 'btn p', href: 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text), target: '_blank', rel: 'noopener' }, 'Send on WhatsApp'); a.onclick = () => setTimeout(log, 600); btns.append(a); }
    if (r.email) { const a = h('a', { class: 'btn', href: 'mailto:' + r.email + '?subject=' + encodeURIComponent(co_) + '&body=' + encodeURIComponent(text), target: '_blank', rel: 'noopener' }, 'Send by email'); a.onclick = () => setTimeout(log, 600); btns.append(a); }
    const done = h('button', { type: 'button' }, 'Done / skip'); done.onclick = log; btns.append(done);
    box.append(h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', {}, r.kind === 'FOLLOW_UP' ? 'How is the car? (3 days)' : 'Service reminder (6 months)'), h('span', { class: 'pill' }, r.days_since + ' days ago')),
      h('div', { class: 'mut' }, r.customer + ' · ' + r.vehicle + ' · ', h('a', { href: '#customer/' + r.customer_id }, 'open customer')), h('div', { style: 'margin-top:6px;font-size:13px' }, text), btns, out));
  }
  return box;
}

// ---- customers ----
async function customers() {
  const q = h('input', { placeholder: 'Search name or phone' }), list = h('div', { class: 'card' });
  async function load() {
    let req = sb.from('customers').select('id,name,phone,customer_type').order('created_at', { ascending: false }).limit(50);
    if (q.value.trim()) req = req.or(`name.ilike.%${q.value.trim().replace(/[,()%]/g, '')}%,phone.ilike.%${q.value.trim().replace(/[,()%]/g, '')}%`);
    const { data, error } = await req; list.textContent = '';
    if (error) return list.append(msg('err', nice(error.message)));
    if (!data.length) list.append(h('div', { class: 'mut' }, 'No customers found.'));
    for (const c of data) list.append(h('a', { class: 'row', href: '#customer/' + c.id, style: 'color:inherit;text-decoration:none' }, h('span', {}, c.name, h('div', { class: 'mut' }, c.phone || 'no phone')), h('span', { class: 'pill' }, c.customer_type)));
  }
  q.oninput = () => { clearTimeout(q._t); q._t = setTimeout(load, 300); };
  const name = h('input'), phone = h('input', { type: 'tel' }), email = h('input', { type: 'email' }), out = h('div');
  const type = h('select', {}, ['Individual','Corporate','Dealership','Fleet','Government institution'].map(x => h('option', {}, x)));
  const add = h('button', { class: 'p' }, 'Save customer');
  add.onclick = async () => {
    add.disabled = true; out.textContent = '';
    const { error } = await sb.from('customers').insert({ name: name.value.trim(), phone: phone.value.trim() || null, email: email.value.trim() || null, customer_type: type.value });
    add.disabled = false;
    if (error) return out.append(msg('err', error.code === '23505' ? 'This customer is already saved.' : nice(error.message)));
    name.value = phone.value = email.value = ''; out.append(msg('okm', 'Saved.')); load();
  };
  show(h('h2', {}, 'Customers'), h('div', { class: 'card' }, field('Search', q)), list,
    h('div', { class: 'card' }, h('h3', {}, 'New customer'), field('Name', name), field('Phone', phone), field('Email (optional)', email), field('Type', type), add, out));
  load();
}

async function customer(id) {
  const { data: c, error } = await sb.from('customers').select('*').eq('id', id).maybeSingle();
  if (error || !c) return show(msg('err', 'Customer not found.'));
  const { data: vs } = await sb.from('vehicles').select('id,registration,make,model,year').eq('customer_id', id);
  const reg = h('input'), make = h('input'), model = h('input'), year = h('input', { type: 'number' }), out = h('div');
  const add = h('button', { class: 'p' }, 'Save vehicle');
  add.onclick = async () => {
    add.disabled = true; out.textContent = '';
    const { error } = await sb.from('vehicles').insert({ customer_id: id, registration: reg.value.trim(), make: make.value.trim(), model: model.value.trim() || null, year: year.value ? +year.value : null });
    add.disabled = false;
    if (error) return out.append(msg('err', error.code === '23505' ? 'A vehicle with this plate or VIN is already saved.' : nice(error.message)));
    customer(id);
  };
  show(h('a', { href: '#customers' }, '← Customers'), h('h2', {}, c.name), h('div', { class: 'mut' }, [c.phone, c.email, c.id].filter(Boolean).join(' · ')),
    h('div', { class: 'card' }, h('h3', {}, 'Vehicles'), (vs || []).length ? (vs || []).map(v => h('div', { class: 'row' }, h('span', {}, v.registration + ' — ' + [v.year, v.make, v.model].filter(Boolean).join(' ')), can('ceo','manager','admin','advisor','receptionist') ? h('a', { href: '#job/new:' + v.id }, 'New job') : '')) : h('div', { class: 'mut' }, 'No vehicles yet.')),
    await referrerCard(c), await commsCard(c),
    h('div', { class: 'card' }, h('h3', {}, 'Add vehicle'), field('Registration number', reg), field('Make', make), field('Model', model), field('Year', year), add, out));
}

// ---- jobs ----
async function jobs() {
  const { data, error } = await sb.from('jobs').select('id,status,complaint,date_in,vehicles(registration,make,model),customers(name)').order('date_in', { ascending: false }).limit(50);
  const list = h('div', { class: 'card' });
  if (error) list.append(msg('err', nice(error.message)));
  else if (!data.length) list.append(h('div', { class: 'mut' }, 'No jobs yet.'));
  else for (const j of data) list.append(h('a', { class: 'row', href: '#job/' + j.id, style: 'color:inherit;text-decoration:none' },
    h('span', {}, j.id + ' · ' + (j.vehicles?.registration || ''), h('div', { class: 'mut' }, (j.customers?.name || '') + ' — ' + j.complaint.slice(0, 60))), h('span', { class: 'pill' }, j.status.replace(/_/g, ' '))));
  show(h('h2', {}, 'Jobs'), list);
}

async function job(arg) {
  if (arg && arg.startsWith('new:')) return newJob(arg.slice(4));
  const { data: j, error } = await sb.from('jobs').select('*, vehicles(registration,make,model), customers(name,phone), technician:profiles!jobs_technician_id_fkey(full_name)').eq('id', arg).maybeSingle();
  if (error || !j) return show(msg('err', 'Job not found.'));
  const out = h('div'), editable = can('ceo','manager','admin','supervisor','advisor');
  const diag = h('textarea', { rows: 3 }, j.diagnosis || ''), conf = h('input', { type: 'checkbox' }), sol = h('textarea', { rows: 3 }, j.recommended_solution || '');
  conf.checked = j.diagnosis_confirmed;
  const st = h('select', {}, ['RECEIVED','INSPECTING','DIAGNOSED','AWAITING_APPROVAL','APPROVED','IN_REPAIR','QUALITY_CHECK','READY','COLLECTED','CANCELLED'].map(s => h('option', { value: s, selected: s === j.status }, s.replace(/_/g, ' '))));
  const save = h('button', { class: 'p' }, 'Save changes');
  save.onclick = async () => {
    save.disabled = true; out.textContent = '';
    const { error } = await sb.from('jobs').update({ diagnosis: diag.value, diagnosis_confirmed: conf.checked, recommended_solution: sol.value, status: st.value }).eq('id', j.id);
    save.disabled = false; out.append(error ? msg('err', nice(error.message)) : msg('okm', 'Saved.'));
  };
  show(h('a', { href: '#jobs' }, '← Jobs'), h('h2', {}, j.id), h('div', { class: 'card' },
    h('div', {}, h('b', {}, j.vehicles?.registration), ' ' + [j.vehicles?.make, j.vehicles?.model].filter(Boolean).join(' ')),
    h('div', { class: 'mut' }, (j.customers?.name || '') + (j.customers?.phone ? ' · ' + j.customers.phone : '')),
    h('p', {}, h('b', {}, 'Customer complaint: '), j.complaint),
    can('ceo','manager','admin','supervisor','advisor','receptionist') ? h('a', { href: '#insp/new:' + j.vehicle_id + ':' + j.id }, 'Start vehicle inspection →') : ''),
    editable ? h('div', { class: 'card' }, field('Status', st), field('Diagnosis', diag),
      h('label', {}, conf, ' Diagnosis is confirmed by a test (only confirmed diagnoses go on quotations)'), field('Recommended solution', sol), save, out)
      : h('div', { class: 'card' }, h('div', {}, 'Status: ' + j.status.replace(/_/g, ' '))),
    await jobBilling(j), await qcCard(j), await costCard(j), await updatesCard(j));
}

async function newJob(vehicleId) {
  const { data: v } = await sb.from('vehicles').select('id,registration,make,model,customer_id').eq('id', vehicleId).maybeSingle();
  if (!v) return show(msg('err', 'Vehicle not found.'));
  const { data: techs } = await sb.from('profiles').select('id,full_name').eq('role', 'technician').eq('is_active', true);
  const complaint = h('textarea', { rows: 3, placeholder: "Write what the customer says, in their own words" }), odo = h('input', { type: 'number' }),
    tech = h('select', {}, h('option', { value: '' }, 'Assign later'), (techs || []).map(t => h('option', { value: t.id }, t.full_name))), out = h('div');
  const go = h('button', { class: 'p' }, 'Create job');
  go.onclick = async () => {
    go.disabled = true; out.textContent = '';
    const { data, error } = await sb.from('jobs').insert({ customer_id: v.customer_id, vehicle_id: v.id, complaint: complaint.value.trim(), odometer_km: odo.value ? +odo.value : null, technician_id: tech.value || null }).select('id').single();
    go.disabled = false;
    if (error) return out.append(msg('err', nice(error.message)));
    location.hash = '#job/' + data.id;
  };
  show(h('h2', {}, 'New job'), h('div', { class: 'card' }, h('b', {}, v.registration), ' ' + [v.make, v.model].filter(Boolean).join(' '),
    field('Customer complaint', complaint), field('Odometer (km)', odo), field('Technician', tech), go, out));
}

// ---- branches (CEO) ----
async function branches() {
  if (!can('ceo')) return show(msg('err', 'Only the CEO can manage branches.'));
  const { data } = await sb.from('branches').select('*').order('created_at');
  const f = {}; for (const k of ['code','name','country','currency_label','timezone','phone_code']) f[k] = h('input');
  f.currency_label.value = 'NGN'; f.timezone.value = 'Africa/Lagos';
  const out = h('div'), add = h('button', { class: 'p' }, 'Add branch');
  add.onclick = async () => {
    add.disabled = true; out.textContent = '';
    const body = {}; for (const k in f) body[k] = f[k].value.trim();
    const { error } = await sb.from('branches').insert(body); add.disabled = false;
    if (error) return out.append(msg('err', error.code === '23505' ? 'That branch code is already used.' : nice(error.message)));
    branches();
  };
  show(h('a', { href: '#home' }, '← Home'), h('h2', {}, 'Branches'),
    h('div', { class: 'card' }, (data || []).map(b => h('div', { class: 'row' }, h('span', {}, b.name, h('div', { class: 'mut' }, [b.code, b.country, b.currency_label, b.timezone].filter(Boolean).join(' · '))), h('span', { class: 'pill' }, b.is_active ? 'active' : 'closed')))),
    h('div', { class: 'card' }, h('h3', {}, 'Add a branch'), field('Short code (e.g. ACC)', f.code), field('Name', f.name), field('Country', f.country), field('Currency (NGN, USD, GBP, GHS…)', f.currency_label), field('Time zone (e.g. Africa/Accra)', f.timezone), field('Phone code (e.g. +233)', f.phone_code), add, out));
}

// ---- team (CEO) ----
async function team() {
  if (!can('ceo')) return show(msg('err', 'Only the CEO can manage the team.'));
  const [{ data: ps }, { data: bs }] = await Promise.all([sb.from('profiles').select('*').order('created_at'), sb.from('branches').select('id,name')]);
  const rows = (ps || []).map(p => {
    const role = h('select', {}, ROLES_ALL.map(r => h('option', { selected: r === p.role }, r))), br = h('select', {}, (bs || []).map(b => h('option', { value: b.id, selected: b.id === p.branch_id }, b.name)));
    const pay = h('input', { type: 'checkbox' }); pay.checked = p.can_see_payroll;
    const s = h('button', { class: 'p' }, 'Save'), o = h('span', { class: 'mut' });
    s.onclick = async () => { const { error } = await sb.from('profiles').update({ role: role.value, branch_id: br.value, can_see_payroll: pay.checked }).eq('id', p.id); o.textContent = error ? nice(error.message) : ' Saved'; };
    return h('div', { class: 'card' }, h('b', {}, p.full_name), field('Role', role), field('Branch', br), h('label', {}, pay, ' Can see payroll'), s, o);
  });
  show(h('a', { href: '#home' }, '← Home'), h('h2', {}, 'Team'),
    h('div', { class: 'card mut' }, 'To add a new person: create their login in Supabase (Authentication > Users), then add them to profiles. A simple "invite" button comes in the next step.'), rows);
}


// ---- documents and customer links ----
const baseUrl = () => location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
const docUrl = (type, id) => baseUrl() + 'doc.html?type=' + type + '&id=' + encodeURIComponent(id);
function waNumber(phone) { const d = String(phone || '').replace(/\D/g, ''); if (!d) return ''; if (d.startsWith('234')) return d; if (d.startsWith('0')) return '234' + d.slice(1); return d; }
// a customer-facing link to a document (opens without sign-in, can be saved as PDF)
const viewUrl = (kind, token) => baseUrl() + 'view.html?k=' + kind + '&t=' + token;
function shareButtons(url, text, cust, subject) {
  const row = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;align-items:center' }), cm = h('span', { class: 'mut' });
  row.append(h('button', { type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(url); cm.textContent = 'Link copied.'; } catch (e) { cm.textContent = url; } } }, 'Copy PDF link'),
    h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener' }, 'Preview'));
  const wa = waNumber((cust || {}).phone); if (wa) row.append(h('a', { class: 'btn p', href: 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text + ' ' + url), target: '_blank', rel: 'noopener' }, 'Send on WhatsApp'));
  if ((cust || {}).email) row.append(h('a', { class: 'btn', href: 'mailto:' + cust.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text + ' ' + url), rel: 'noopener' }, 'Send by email'));
  row.append(cm); return row;
}
function printButton(type, id, label) { return h('a', { class: 'p', href: docUrl(type, id), target: '_blank', style: 'display:inline-block;text-decoration:none;color:#fff;background:var(--brand);border-radius:8px;padding:11px 16px;font-weight:600;margin:12px 8px 0 0' }, label || 'Print / PDF'); }

async function settings() {
  if (!can('ceo')) return show(msg('err', 'Only the CEO can change business settings.'));
  const { data } = await sb.from('app_settings').select('key,value');
  const V = {}; (data || []).forEach(r => V[r.key] = r.value);
  const defs = [['company_name', 'Company name', 'input'], ['motto', 'Motto', 'input'], ['company_address', 'Address', 'input'], ['company_phone', 'Phone', 'input'], ['company_email', 'Email', 'input'],
    ['bank_details', 'Bank details for invoices (one line each: bank, account name, number)', 'textarea', 3], ['terms', 'Terms and conditions (one per line)', 'textarea', 10]];
  const f = {}, form = h('div', { class: 'card' });
  for (const [k, label, tag, rows] of defs) { f[k] = h(tag, tag === 'textarea' ? { rows } : {}); f[k].value = V[k] || ''; form.append(field(label, f[k])); }
  const out = h('div'), save = h('button', { class: 'p' }, 'Save settings');
  save.onclick = async () => { out.textContent = ''; save.disabled = true; const rows = defs.map(([k]) => ({ key: k, value: f[k].value.trim() }));
    const { error } = await sb.from('app_settings').upsert(rows, { onConflict: 'key' }); save.disabled = false; out.append(error ? msg('err', nice(error.message)) : msg('okm', 'Saved. New documents use these details.')); };
  form.append(save, out);
  show(h('a', { href: '#home' }, '← Home'), h('h2', {}, 'Business settings'), h('div', { class: 'mut' }, 'These appear on every quotation, invoice and report, and on the customer approval page. The logo is the file logo.jpg in your site.'), form);
}

// =====================================================================
// INSPECTIONS
// =====================================================================
const BUCKET = 'inspection-media';
const STATUS_LABEL = { GREEN: 'OK', YELLOW: 'Attention soon', RED: 'Urgent', GREY: 'Not inspected', BLUE: 'Info only' };
const STATUS_COLOR = { GREEN: 'var(--ok)', YELLOW: 'var(--warn)', RED: 'var(--bad)', GREY: 'var(--mut)', BLUE: 'var(--brand)' };
const can_checkin = () => can('ceo','manager','admin','supervisor','advisor','receptionist');
const naira = n => Number(n || 0).toLocaleString('en-NG');
const val = v => (v === '' || v == null) ? null : v;

function statusDot(st) { return h('span', { class: 'pill', style: 'border-color:' + (STATUS_COLOR[st] || 'var(--line)') + ';color:' + (STATUS_COLOR[st] || 'inherit') }, STATUS_LABEL[st] || 'Not marked'); }

// shrink phone photos before upload (saves data and storage)
function shrinkImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error('Could not read this photo.')), 'image/jpeg', 0.82);
    };
    img.onerror = () => reject(new Error('This file is not a photo.'));
    img.src = url;
  });
}
async function uploadPhoto(inspId, itemId, kind, file) {
  const blob = await shrinkImage(file);
  const path = inspId + '/' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random()) + '.jpg';
  const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
  if (up.error) throw up.error;
  const ins = await sb.from('inspection_media').insert({ inspection_id: inspId, item_id: itemId, kind, storage_path: path, mime_type: 'image/jpeg' });
  if (ins.error) throw ins.error;
}
async function signedUrls(paths) {
  if (!paths.length) return {};
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const m = {}; (data || []).forEach(d => { if (d.signedUrl) m[d.path] = d.signedUrl; });
  return m;
}

async function inspections() {
  const { data, error } = await sb.from('inspections').select('id,status,overall,complaint,created_at,vehicles(registration,make,model),customers(name)').order('created_at', { ascending: false }).limit(60);
  const list = h('div', { class: 'card' });
  if (error) list.append(msg('err', nice(error.message)));
  else if (!data.length) list.append(h('div', { class: 'mut' }, 'No inspections yet. Start one from a customer’s vehicle or from a job.'));
  else for (const i of data) list.append(h('a', { class: 'row', href: '#insp/' + i.id, style: 'color:inherit;text-decoration:none' },
    h('span', {}, i.id + ' · ' + (i.vehicles?.registration || ''), h('div', { class: 'mut' }, (i.customers?.name || '') + (i.overall ? ' — ' + i.overall : ''))), h('span', { class: 'pill' }, i.status.replace(/_/g, ' '))));
  show(h('a', { href: '#home' }, '← Home'), h('h2', {}, 'Inspections'), list);
}

async function newInsp(arg) {
  const [vehicleId, jobId] = arg.split(':');
  if (!can_checkin()) return show(msg('err', 'Your role cannot start inspections.'));
  const { data: v } = await sb.from('vehicles').select('id,registration,make,model').eq('id', vehicleId).maybeSingle();
  if (!v) return show(msg('err', 'Vehicle not found.'));
  const { data: techs } = await sb.from('profiles').select('id,full_name').eq('role', 'technician').eq('is_active', true);
  const complaint = h('textarea', { rows: 3, placeholder: 'The customer’s own words' }), odo = h('input', { type: 'number' }),
    fuel = h('select', {}, ['Empty', '1/4', '1/2', '3/4', 'Full'].map(x => h('option', {}, x))),
    when = h('input', { placeholder: 'When does it happen? (cold start, at speed…)' }), lights = h('input', { placeholder: 'Warning lights on?' }),
    tech = h('select', {}, (techs || []).map(t => h('option', { value: t.id }, t.full_name))), consent = h('input', { type: 'checkbox' }), out = h('div');
  if (jobId) { const { data: j } = await sb.from('jobs').select('complaint,odometer_km,fuel_level').eq('id', jobId).maybeSingle(); if (j) { complaint.value = j.complaint || ''; if (j.odometer_km) odo.value = j.odometer_km; } }
  const go = h('button', { class: 'p' }, 'Start inspection');
  go.onclick = async () => {
    go.disabled = true; out.textContent = '';
    const { data, error } = await sb.rpc('check_in_inspection', { p_vehicle: v.id, p_complaint: complaint.value.trim(), p_odometer: +odo.value || 0, p_fuel: fuel.value, p_consent: consent.checked,
      p_technician: tech.value || null, p_job: jobId || null, p_details: { when_it_occurs: when.value, warning_lights: lights.value } });
    go.disabled = false;
    if (error) return out.append(msg('err', nice(error.message)));
    location.hash = '#insp/' + data;
  };
  show(h('h2', {}, 'Start inspection'), h('div', { class: 'card' }, h('b', {}, v.registration), ' ' + [v.make, v.model].filter(Boolean).join(' '),
    field('Customer complaint', complaint), field('Odometer (km)', odo), field('Fuel level', fuel), field('When it happens', when), field('Warning lights', lights), field('Technician', tech),
    h('label', {}, consent, ' The customer agrees to the vehicle records and photos being kept'), go, out));
}

async function insp(arg) {
  if (arg && arg.startsWith('new:')) return newInsp(arg.slice(4));
  const { data: i, error } = await sb.from('inspections').select('*, vehicles(registration,make,model), customers(name,phone,email), technician:profiles!inspections_technician_id_fkey(full_name)').eq('id', arg).maybeSingle();
  if (error || !i) return show(msg('err', 'Inspection not found.'));
  const [{ data: items }, { data: media }, { data: recs }, { data: trans }] = await Promise.all([
    sb.from('inspection_items').select('*').eq('inspection_id', arg).order('sort'),
    sb.from('inspection_media').select('id,item_id,kind,storage_path').eq('inspection_id', arg),
    sb.from('recommendations').select('*').eq('inspection_id', arg).order('id'),
    sb.from('rec_transitions').select('*')]);
  const urls = await signedUrls((media || []).map(m => m.storage_path));
  const editing = i.technician_id === me.id && ['ASSIGNED', 'IN_PROGRESS', 'RETURNED'].includes(i.status);
  const reload = () => insp(arg);
  const parts = [h('a', { href: '#inspections' }, '← Inspections'), h('h2', {}, i.id + ' · ' + (i.vehicles?.registration || ''))];
  if (['APPROVED', 'REPORT_SENT', 'CLOSED', 'SUBMITTED'].includes(i.status)) parts.push(printButton('inspection', i.id, 'Print report / PDF'));

  parts.push(h('div', { class: 'card' },
    h('div', {}, [i.vehicles?.make, i.vehicles?.model].filter(Boolean).join(' '), ' · ', i.customers?.name || ''), 
    h('div', { class: 'mut' }, 'Technician: ' + (i.technician?.full_name || '—') + ' · ' + i.odometer_km + ' km · fuel ' + i.fuel_level),
    h('p', {}, h('b', {}, 'Complaint: '), i.complaint),
    h('div', {}, h('span', { class: 'pill' }, i.status.replace(/_/g, ' ')), i.overall ? ' ' + i.overall : ''),
    i.submitted_at ? h('div', { class: 'mut' }, `OK ${i.green} · Soon ${i.yellow} · Urgent ${i.red} · Not inspected ${i.grey} · Info ${i.blue}`) : ''));
  if (i.status === 'RETURNED' && i.review_note) parts.push(h('div', { class: 'card' }, h('b', {}, 'Returned by supervisor: '), i.review_note));

  // arrival photos
  const arrival = (media || []).filter(m => m.kind === 'arrival');
  const arrBox = h('div', { class: 'card' }, h('h3', {}, 'Arrival photos'), h('div', {}, arrival.map(m => h('img', { src: urls[m.storage_path] || '', style: 'height:80px;border-radius:8px;margin:0 6px 6px 0' }))));
  if (editing) arrBox.append(photoInput('Add arrival photo', async f => { await uploadPhoto(i.id, null, 'arrival', f); reload(); }));
  parts.push(arrBox);

  // checklist
  const groups = {}; (items || []).forEach(x => (groups[x.category] = groups[x.category] || []).push(x));
  for (const [cat, list] of Object.entries(groups)) {
    const box = h('div', { class: 'card' }, h('h3', {}, cat));
    for (const it of list) box.append(editing ? itemEditor(i, it, (media || []).filter(m => m.item_id === it.id), urls, reload) : itemView(it, (media || []).filter(m => m.item_id === it.id), urls));
    parts.push(box);
  }

  if (editing) {
    const out = h('div'), chk = h('button', { class: 'p' }, 'Check what is missing'), sub = h('button', { class: 'p' }, 'Submit for supervisor review');
    chk.onclick = async () => { out.textContent = ''; const { data, error } = await sb.rpc('validate_inspection', { p_id: i.id });
      if (error) return out.append(msg('err', nice(error.message)));
      out.append(data.length ? h('div', { class: 'err' }, h('b', {}, 'Still to do:'), h('ul', {}, data.map(x => h('li', {}, x)))) : msg('okm', 'Everything is complete. You can submit.')); };
    sub.onclick = async () => { sub.disabled = true; out.textContent = ''; const { error } = await sb.rpc('submit_inspection', { p_id: i.id });
      if (error) { sub.disabled = false; return out.append(msg('err', nice(error.message))); } reload(); };
    parts.push(h('div', { class: 'card' }, chk, ' ', sub, out));
  }

  // supervisor review
  if (i.status === 'SUBMITTED' && can('ceo', 'manager', 'supervisor')) {
    const note = h('textarea', { rows: 2, placeholder: 'Note (required if you return it)' }), out = h('div'),
      ok = h('button', { class: 'p' }, 'Approve report'), back = h('button', { class: 'p', style: 'background:var(--warn)' }, 'Return to technician');
    const act = approve => async () => { out.textContent = ''; const { error } = await sb.rpc('review_inspection', { p_id: i.id, p_approve: approve, p_note: note.value.trim() || null });
      if (error) return out.append(msg('err', nice(error.message))); reload(); };
    ok.onclick = act(true); back.onclick = act(false);
    parts.push(h('div', { class: 'card' }, h('h3', {}, 'Review'), field('Note', note), ok, ' ', back, out));
  }
  if (['APPROVED', 'REPORT_SENT'].includes(i.status) && can('ceo', 'manager', 'supervisor')) {
    const out = h('div'), b = h('button', { class: 'p' }, 'Reopen for correction');
    b.onclick = async () => { const why = prompt('Why are you reopening this approved report?'); if (!why) return; const { error } = await sb.rpc('reopen_inspection', { p_id: i.id, p_reason: why }); if (error) return out.append(msg('err', nice(error.message))); reload(); };
    parts.push(h('div', { class: 'card' }, b, out));
  }

  // after approval: recommendations, customer link, handover
  if (['APPROVED', 'REPORT_SENT', 'CLOSED'].includes(i.status)) parts.push(...afterApproval(i, recs || [], trans || [], reload));
  show(...parts);
}

function photoInput(label, onFile) {
  const out = h('span', { class: 'mut' }), inp = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none' });
  inp.onchange = async () => { if (!inp.files[0]) return; out.textContent = ' Uploading…'; try { await onFile(inp.files[0]); } catch (e) { out.textContent = ' ' + nice(e.message || String(e)); } };
  return h('span', {}, h('button', { class: 'p', type: 'button', onclick: () => inp.click() }, '📷 ' + label), inp, out);
}

function itemView(it, media, urls) {
  return h('div', { class: 'row', style: 'display:block' },
    h('div', {}, h('b', {}, it.item), ' ', statusDot(it.status), it.safety ? h('span', { class: 'mut' }, ' · safety') : ''),
    ['observed', 'test_performed', 'result', 'recommended_action'].filter(k => it[k]).map(k => h('div', { class: 'mut' }, k.replace(/_/g, ' ') + ': ' + it[k])),
    it.drive_advice ? h('div', { class: 'err' }, it.drive_advice) : '',
    it.no_photo_reason ? h('div', { class: 'mut' }, 'No photo: ' + it.no_photo_reason) : '',
    h('div', {}, media.map(m => h('img', { src: urls[m.storage_path] || '', style: 'height:70px;border-radius:8px;margin:4px 6px 0 0' }))));
}

function itemEditor(i, it, media, urls, reload) {
  const f = {}; const mk = (k, tag = 'input', opts = {}) => { f[k] = h(tag, opts); f[k].value = it[k] ?? ''; return f[k]; };
  let status = it.status;
  const body = h('div'), msgBox = h('div');
  const btns = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0' });
  const renderBtns = () => { btns.textContent = ''; Object.keys(STATUS_LABEL).forEach(k => btns.append(h('button', { type: 'button', style: `padding:7px 10px;border-radius:8px;border:2px solid ${STATUS_COLOR[k]};background:${status === k ? STATUS_COLOR[k] : 'transparent'};color:${status === k ? '#fff' : STATUS_COLOR[k]};font:inherit;cursor:pointer`, onclick: () => { status = k; renderBtns(); renderBody(); } }, STATUS_LABEL[k]))); };
  const renderBody = () => {
    body.textContent = '';
    if (!status) return;
    const needTest = (status === 'GREEN' && it.needs_test) || status === 'YELLOW' || status === 'RED';
    if (status !== 'GREEN') body.append(field(status === 'GREY' ? 'Why was it not inspected?' : status === 'BLUE' ? 'What was recorded?' : 'What did you see?', mk('observed', 'textarea', { rows: 2 })));
    if (needTest) body.append(field('Test performed' + (status === 'GREEN' ? ' (required for Green)' : ''), mk('test_performed')), field('Result', mk('result')));
    if (status === 'YELLOW' || status === 'RED') {
      const ft = h('select', {}, h('option', { value: '' }, 'Choose…'), ['Confirmed fault', 'Suspected fault', 'Maintenance', 'Monitor'].map(x => h('option', { selected: it.finding_type === x }, x))); f.finding_type = ft;
      const pr = h('select', {}, h('option', { value: '' }, 'Choose…'), ['Immediate', 'Soon', 'Planned', 'Monitor'].map(x => h('option', { selected: it.priority === x }, x))); f.priority = pr;
      body.append(field('Finding type (Confirmed fault needs a test and result)', ft), field('Probable cause', mk('probable_cause')), field('Recommended action', mk('recommended_action', 'textarea', { rows: 2 })), field('Priority', pr),
        field('Estimated parts (₦)', mk('est_parts', 'input', { type: 'number' })), field('Estimated labour (₦)', mk('est_labour', 'input', { type: 'number' })));
      if (it.safety && status === 'RED') { const da = h('select', {}, h('option', { value: '' }, 'Choose…'), ['Can be driven with caution', 'Do not drive - hold at workshop', 'Transport only (tow)', 'Pending supervisor assessment'].map(x => h('option', { selected: it.drive_advice === x }, x))); f.drive_advice = da; body.append(field('Driving advice (safety item)', da)); }
      if (!media.length) body.append(field('No photo? Say why', mk('no_photo_reason')));
    }
    const save = h('button', { class: 'p', type: 'button' }, 'Save this item');
    save.onclick = async () => {
      save.disabled = true; msgBox.textContent = '';
      const p = { status }; for (const k of ['observed','test_performed','result','probable_cause','recommended_action','no_photo_reason','finding_type','priority','drive_advice']) if (f[k]) p[k] = val(f[k].value);
      for (const k of ['est_parts', 'est_labour']) if (f[k]) p[k] = +f[k].value || 0;
      const { error } = await sb.from('inspection_items').update(p).eq('id', it.id);
      save.disabled = false; msgBox.append(error ? msg('err', nice(error.message)) : msg('okm', 'Saved.'));
    };
    body.append(save);
    if (status !== 'GREEN' || it.needs_test) body.append(' ', photoInput('Add photo', async file => { await uploadPhoto(i.id, it.id, 'closeup', file); reload(); }));
    media.forEach(m => body.append(h('img', { src: urls[m.storage_path] || '', style: 'height:70px;border-radius:8px;margin:6px 6px 0 0' })));
  };
  renderBtns(); renderBody();
  return h('div', { class: 'row', style: 'display:block' }, h('b', {}, it.item), it.safety ? h('span', { class: 'mut' }, ' · safety item') : '', it.needs_test ? h('span', { class: 'mut' }, ' · needs a test') : '', btns, body, msgBox);
}

function afterApproval(i, recs, trans, reload) {
  const out = []; const link = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '') + 'track.html?t=' + i.tracking_token;
  const cb = h('button', { class: 'p', type: 'button' }, 'Copy customer tracking link'); const cm = h('span', { class: 'mut' });
  cb.onclick = async () => { try { await navigator.clipboard.writeText(link); cm.textContent = ' Copied.'; } catch (e) { cm.textContent = ' ' + link; } };
  out.push(h('div', { class: 'card' }, h('h3', {}, 'Customer'), h('div', { class: 'mut' }, 'The customer opens this link to follow the repair. No sign-in is needed.'), cb, cm));

  const editEst = can('ceo', 'manager', 'admin', 'advisor', 'supervisor');
  const box = h('div', { class: 'card' }, h('h3', {}, 'Recommended repairs'));
  if (!recs.length) box.append(h('div', { class: 'mut' }, 'No repairs recommended. Nothing was Yellow or Red.'));
  const picked = new Set();
  for (const r of recs) {
    const row = h('div', { class: 'row', style: 'display:block' }, h('div', {}, h('b', {}, r.item), ' ', h('span', { class: 'pill' }, r.status)), h('div', { class: 'mut' }, r.summary), r.decision_note ? h('div', { class: 'mut' }, 'Note: ' + r.decision_note) : '');
    if (editEst) {
      const p = h('input', { type: 'number', value: r.est_parts, style: 'width:110px' }), l = h('input', { type: 'number', value: r.est_labour, style: 'width:110px' }), st = h('span', { class: 'mut' });
      const sv = h('button', { class: 'p', type: 'button', style: 'padding:5px 10px;margin:0 0 0 6px' }, 'Save estimate');
      sv.onclick = async () => { const { error } = await sb.from('recommendations').update({ est_parts: +p.value || 0, est_labour: +l.value || 0 }).eq('id', r.id); st.textContent = error ? ' ' + nice(error.message) : ' Saved'; };
      row.append(h('div', {}, 'Parts ', p, ' Labour ', l, sv, st));
    } else row.append(h('div', { class: 'mut' }, 'Estimate ₦' + naira(r.est_total)));
    if (r.status === 'Pending quotation' && can('ceo', 'manager', 'admin', 'advisor')) { const c = h('input', { type: 'checkbox' }); c.onchange = () => c.checked ? picked.add(r.id) : picked.delete(r.id); row.append(h('label', {}, c, ' Include in quotation')); }
    const next = trans.filter(t => t.from_status === r.status && t.roles.includes(me.role) && !(t.to_status === 'Quotation sent'));
    const nb = h('div', { style: 'margin-top:6px;display:flex;gap:6px;flex-wrap:wrap' }), no = h('div');
    next.forEach(t => nb.append(h('button', { class: 'p', type: 'button', style: 'padding:6px 10px;margin:0', onclick: async () => {
      let note = null; if (['Declined', 'Deferred', 'Withdrawn'].includes(t.to_status)) { note = prompt('Add a short note (required):'); if (!note) return; }
      const { error } = await sb.rpc('set_rec_status', { p_id: r.id, p_status: t.to_status, p_note: note }); if (error) return no.append(msg('err', nice(error.message))); reload(); } }, '→ ' + t.to_status)));
    row.append(nb, no); box.append(row);
  }
  if (recs.some(r => r.status === 'Pending quotation') && can('ceo', 'manager', 'admin', 'advisor') && i.job_id) {
    const cur = h('select', {}, ['NGN', 'USD'].map(c => h('option', {}, c))), qo = h('div'), qb = h('button', { class: 'p', type: 'button' }, 'Create quotation from ticked items');
    qb.onclick = async () => { qo.textContent = ''; if (!picked.size) return qo.append(msg('err', 'Tick at least one repair.'));
      const { data, error } = await sb.rpc('make_quotation_from_recs', { p_inspection: i.id, p_recs: [...picked], p_currency: cur.value });
      if (error) return qo.append(msg('err', nice(error.message))); qo.append(msg('okm', 'Quotation ' + data + ' created as a draft. The quotation screen is the next thing I build.')); setTimeout(reload, 2500); };
    box.append(field('Quotation currency', cur), qb, qo);
  } else if (recs.some(r => r.status === 'Pending quotation') && !i.job_id) box.append(h('div', { class: 'mut' }, 'Link this inspection to a job to create a quotation.'));
  out.push(box);

  const hb = h('div', { class: 'card' }, h('h3', {}, 'Handover')), ho = h('div');
  if (i.status === 'APPROVED' && can('ceo', 'manager', 'admin', 'advisor', 'receptionist')) hb.append(h('button', { class: 'p', type: 'button', style: 'margin-right:6px', onclick: async () => { const { error } = await sb.rpc('mark_report_sent', { p_id: i.id }); if (error) return ho.append(msg('err', nice(error.message))); reload(); } }, 'Mark report as sent to customer'));
  if (!i.ready_at && can('ceo', 'manager', 'supervisor', 'advisor')) hb.append(h('button', { class: 'p', type: 'button', style: 'margin-right:6px', onclick: async () => { const { error } = await sb.rpc('mark_ready', { p_inspection: i.id }); if (error) return ho.append(msg('err', nice(error.message))); reload(); } }, 'Vehicle is ready for collection'));
  if (i.ready_at && !i.collected_at && can('ceo', 'manager', 'admin', 'advisor', 'receptionist')) hb.append(h('button', { class: 'p', type: 'button', onclick: async () => { const { error } = await sb.rpc('mark_collected', { p_inspection: i.id }); if (error) return ho.append(msg('err', nice(error.message))); reload(); } }, 'Customer collected the vehicle'));
  if (i.ready_at) hb.append(h('div', { class: 'mut' }, 'Ready since ' + new Date(i.ready_at).toLocaleString() + (i.collected_at ? ' · collected ' + new Date(i.collected_at).toLocaleString() : '')));
  hb.append(ho); out.push(hb);
  return out;
}

// =====================================================================
// QUOTATIONS, INVOICES, PAYMENTS
// =====================================================================
const SYMBOL = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
const money = (n, cur) => (SYMBOL[cur] || (cur || '') + ' ') + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const canQuote = () => can('ceo', 'manager', 'admin', 'advisor');
const canBill = () => can('ceo', 'manager', 'admin', 'accounting');
const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR', 'GHS', 'KES', 'ZAR', 'CAD'];

async function jobBilling(j) {
  if (!can('ceo','manager','admin','supervisor','advisor','receptionist','accounting')) return '';
  const [{ data: qs }, { data: is }] = await Promise.all([sb.from('quotations').select('id,status,currency').eq('job_id', j.id), sb.from('invoices').select('id,status,currency').eq('job_id', j.id)]);
  const box = h('div', { class: 'card' }, h('h3', {}, 'Quotations and invoices')), out = h('div');
  (qs || []).forEach(q => box.append(h('div', { class: 'row' }, h('a', { href: '#quotation/' + q.id }, q.id), h('span', { class: 'pill' }, q.status + ' · ' + q.currency))));
  (is || []).forEach(i => box.append(h('div', { class: 'row' }, h('a', { href: '#invoice/' + i.id }, i.id), h('span', { class: 'pill' }, i.status + ' · ' + i.currency))));
  if (!(qs || []).length && !(is || []).length) box.append(h('div', { class: 'mut' }, 'None yet.'));
  const cur = h('select', {}, CURRENCIES.map(c => h('option', {}, c)));
  const mk = (label, fn, rpc, ok) => ok ? h('button', { class: 'p', type: 'button', style: 'margin-right:6px', onclick: async () => { out.textContent = ''; const { data, error } = await sb.rpc(rpc, { p_job: j.id, p_currency: cur.value }); if (error) return out.append(msg('err', nice(error.message))); location.hash = fn + data; } }, label) : '';
  box.append(field('Currency for a new document', cur), mk('New quotation', '#quotation/', 'create_quotation_for_job', canQuote()), mk('New invoice (without quotation)', '#invoice/', 'create_invoice_for_job', canBill()), out);
  return box;
}

function linesTable(lines, cur, editable, onDelete) {
  const t = h('div');
  if (!lines.length) t.append(h('div', { class: 'mut' }, 'No lines yet.'));
  for (const l of lines) t.append(h('div', { class: 'row' },
    h('span', {}, h('b', {}, l.description), h('div', { class: 'mut' }, l.line_type + ' · ' + l.qty + ' × ' + money(l.unit_price, cur))),
    h('span', {}, money(l.qty * l.unit_price, cur), editable ? h('button', { type: 'button', style: 'margin-left:10px;color:var(--bad);background:none;border:0;cursor:pointer', onclick: () => onDelete(l.id) }, 'Remove') : '')));
  const total = lines.reduce((a, l) => a + l.qty * l.unit_price, 0);
  t.append(h('div', { class: 'row' }, h('b', {}, 'Total'), h('b', {}, money(total, cur))));
  return t;
}

function lineForm(table, parentCol, parentId, nextSort, reload) {
  const type = h('select', {}, ['PART', 'LABOUR', 'OTHER'].map(x => h('option', {}, x))), desc = h('input', { placeholder: 'Description' }),
    qty = h('input', { type: 'number', value: 1, step: '0.01' }), price = h('input', { type: 'number', step: '0.01', placeholder: 'Unit price' }), out = h('div'), add = h('button', { class: 'p', type: 'button' }, 'Add line');
  add.onclick = async () => {
    out.textContent = ''; add.disabled = true;
    const { error } = await sb.from(table).insert({ [parentCol]: parentId, line_type: type.value, description: desc.value.trim(), qty: +qty.value, unit_price: +price.value, sort: nextSort });
    add.disabled = false; if (error) return out.append(msg('err', nice(error.message))); reload();
  };
  return h('div', { class: 'card' }, h('h3', {}, 'Add a line'), field('Type', type), field('Description', desc), field('Quantity', qty), field('Unit price', price), add, out);
}

async function quotations() {
  const [{ data }, { data: tot }] = await Promise.all([
    sb.from('quotations').select('id,status,currency,created_at,jobs(vehicles(registration),customers(name))').order('created_at', { ascending: false }).limit(60), sb.from('v_quotation_totals').select('id,total')]);
  const T = {}; (tot || []).forEach(x => T[x.id] = x.total);
  const list = h('div', { class: 'card' });
  if (!(data || []).length) list.append(h('div', { class: 'mut' }, 'No quotations yet. Create one from a job, or from an approved inspection.'));
  for (const q of data || []) list.append(h('a', { class: 'row', href: '#quotation/' + q.id, style: 'color:inherit;text-decoration:none' },
    h('span', {}, q.id + ' · ' + (q.jobs?.vehicles?.registration || ''), h('div', { class: 'mut' }, q.jobs?.customers?.name || '')), h('span', {}, money(T[q.id], q.currency), ' ', h('span', { class: 'pill' }, q.status))));
  show(h('a', { href: '#home' }, '← Home'), h('h2', {}, 'Quotations'), list);
}

async function quotation(id) {
  const { data: q, error } = await sb.from('quotations').select('*, jobs(id,complaint,vehicles(registration,make,model),customers(name,phone,email))').eq('id', id).maybeSingle();
  if (error || !q) return show(msg('err', 'Quotation not found.'));
  const [{ data: lines }, { data: recs }, { data: inv }] = await Promise.all([
    sb.from('quotation_lines').select('*').eq('quotation_id', id).order('sort'), sb.from('recommendations').select('id,item,status').eq('quotation_id', id),
    sb.from('invoices').select('id,status').eq('quotation_id', id).neq('status', 'CANCELLED')]);
  const reload = () => quotation(id), draft = q.status === 'DRAFT' && canQuote();
  const parts = [h('a', { href: '#job/' + q.job_id }, '← Job ' + q.job_id), h('h2', {}, q.id),
    h('div', { class: 'card' }, h('div', {}, h('b', {}, q.jobs?.vehicles?.registration), ' ' + [q.jobs?.vehicles?.make, q.jobs?.vehicles?.model].filter(Boolean).join(' ')),
      h('div', { class: 'mut' }, (q.jobs?.customers?.name || '') + (q.jobs?.customers?.phone ? ' · ' + q.jobs.customers.phone : '')),
      h('div', {}, h('span', { class: 'pill' }, q.status), ' ', q.currency, q.currency === 'USD' && q.fx_rate ? ' · rate ₦' + Number(q.fx_rate).toLocaleString() + ' per $1' : ''),
      q.valid_until ? h('div', { class: 'mut' }, 'Valid until ' + q.valid_until) : '', q.approved_via ? h('div', { class: 'mut' }, 'Approved: ' + q.approved_via) : '',
      (recs || []).length ? h('div', { class: 'mut' }, 'Covers: ' + recs.map(r => r.item).join(', ')) : ''),
    h('div', { class: 'card' }, h('h3', {}, 'Items'), linesTable(lines || [], q.currency, draft, async lid => { const { error } = await sb.from('quotation_lines').delete().eq('id', lid); if (!error) reload(); }))];
  if (draft) parts.push(lineForm('quotation_lines', 'quotation_id', id, (lines || []).length + 1, reload));
  const out = h('div'), box = h('div', { class: 'card' }, h('h3', {}, 'Status'));
  const act = (label, status, need, style) => h('button', { class: 'p', type: 'button', style: 'margin:0 6px 6px 0;' + (style || ''), onclick: async () => {
    let note = null; if (need) { note = prompt(need); if (note === null || (need.includes('required') && !note.trim())) return; }
    out.textContent = ''; const { error } = await sb.rpc('set_quotation_status', { p_id: id, p_status: status, p_note: note }); if (error) return out.append(msg('err', nice(error.message))); reload(); } }, label);
  if (canQuote()) {
    if (q.status === 'DRAFT') box.append(act('Mark as sent to customer', 'SENT'), act('Cancel quotation', 'CANCELLED', 'Reason (required):', 'background:var(--bad)'));
    if (q.status === 'SENT') box.append(act('Customer approved', 'APPROVED', 'How did the customer approve? (e.g. phone, WhatsApp, in person). Optional:'), act('Customer rejected', 'REJECTED', 'Reason (required):', 'background:var(--warn)'), act('Cancel quotation', 'CANCELLED', 'Reason (required):', 'background:var(--bad)'));
    if (q.status === 'APPROVED' && !(inv || []).length) box.append(act('Cancel quotation', 'CANCELLED', 'Reason (required):', 'background:var(--bad)'));
  }
  if (q.status === 'APPROVED' && canBill()) {
    if ((inv || []).length) box.append(h('div', {}, 'Invoice: ', h('a', { href: '#invoice/' + inv[0].id }, inv[0].id)));
    else box.append(h('button', { class: 'p', type: 'button', onclick: async () => { out.textContent = ''; const { data, error } = await sb.rpc('invoice_from_quotation', { p_quotation: id }); if (error) return out.append(msg('err', nice(error.message))); location.hash = '#invoice/' + data; } }, 'Create invoice'));
  }
  box.append(out); parts.push(box);
  parts.push(printButton('quotation', id));
  if (q.status !== 'DRAFT' && q.approval_token && canQuote()) parts.push(h('div', { class: 'card' }, h('h3', {}, 'Quotation PDF link'), h('div', { class: 'mut' }, 'The customer opens this link without signing in and can download the quotation as a PDF.'), shareButtons(viewUrl('quotation', q.approval_token), 'Hello ' + (((q.jobs?.customers || {}).name || '').split(' ')[0] || 'there') + ', here is your quotation ' + q.id + ' from IKETECH AUTO LTD:', q.jobs?.customers, 'Your quotation ' + q.id + ' - IKETECH AUTO LTD')));
  if (['DRAFT', 'SENT'].includes(q.status) && canQuote()) {
    const link = baseUrl() + 'approve.html?t=' + q.approval_token, cust = q.jobs?.customers || {}, first = (cust.name || '').split(' ')[0] || 'there';
    const text = `Hello ${first}, your quotation ${q.id} from IKETECH AUTO LTD is ready (${money(lineTotal(lines), q.currency)}). Please review and approve it here: ${link}`;
    const lb = h('div', { class: 'card' }, h('h3', {}, 'Customer approval link'), h('div', { class: 'mut' }, q.status === 'DRAFT' ? 'Mark the quotation as sent first. The link works once it is sent.' : 'The customer opens this link, reads the quotation and the terms, and approves or declines. No sign-in is needed.'), h('div', { style: 'word-break:break-all;font-size:13px;margin:8px 0' }, link));
    const cm = h('span', { class: 'mut' });
    lb.append(h('button', { class: 'p', type: 'button', style: 'margin-right:6px', onclick: async () => { try { await navigator.clipboard.writeText(link); cm.textContent = ' Copied.'; } catch (e) { cm.textContent = ' Select and copy the link above.'; } } }, 'Copy link'));
    const wa = waNumber(cust.phone);
    if (wa) lb.append(h('a', { href: 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text), target: '_blank', style: 'display:inline-block;text-decoration:none;color:#fff;background:#12805c;border-radius:8px;padding:11px 16px;font-weight:600;margin-right:6px' }, 'Send on WhatsApp'));
    if (cust.email) lb.append(h('a', { href: 'mailto:' + cust.email + '?subject=' + encodeURIComponent('Your quotation ' + q.id + ' - IKETECH AUTO LTD') + '&body=' + encodeURIComponent(text), style: 'display:inline-block;text-decoration:none;color:#fff;background:#667085;border-radius:8px;padding:11px 16px;font-weight:600' }, 'Send by email'));
    lb.append(cm); parts.push(lb);
  }
  show(...parts);
}
const lineTotal = lines => (lines || []).reduce((a, l) => a + l.qty * l.unit_price, 0);

async function invoices() {
  const [{ data }, { data: st }] = await Promise.all([
    sb.from('invoices').select('id,status,currency,created_at,jobs(vehicles(registration),customers(name))').order('created_at', { ascending: false }).limit(60), sb.from('v_invoice_status').select('id,total,balance,payment_status')]);
  const S = {}; (st || []).forEach(x => S[x.id] = x);
  const list = h('div', { class: 'card' });
  if (!(data || []).length) list.append(h('div', { class: 'mut' }, 'No invoices yet. Create one from an approved quotation.'));
  for (const i of data || []) { const s = S[i.id] || {}; list.append(h('a', { class: 'row', href: '#invoice/' + i.id, style: 'color:inherit;text-decoration:none' },
    h('span', {}, i.id + ' · ' + (i.jobs?.vehicles?.registration || ''), h('div', { class: 'mut' }, i.jobs?.customers?.name || '')),
    h('span', {}, money(s.total, i.currency), h('div', { class: 'mut' }, (s.payment_status || i.status) + (s.payment_status === 'PART PAID' || s.payment_status === 'UNPAID' ? ' · owes ' + money(s.balance, i.currency) : ''))))); }
  const parts = [h('a', { href: '#home' }, '← Home'), h('h2', {}, 'Invoices and payments'), list];
  if (can('ceo', 'manager', 'accounting')) parts.push(await fxCard());
  show(...parts);
}

async function fxCard() {
  const { data } = await sb.from('fx_rates').select('*').order('id', { ascending: false }).limit(1);
  const r = (data || [])[0], rate = h('input', { type: 'number', step: '0.01', placeholder: '₦ per $1' }), mar = h('input', { type: 'number', step: '0.01', value: 0 }), out = h('div'), b = h('button', { class: 'p', type: 'button' }, 'Save exchange rate');
  b.onclick = async () => { out.textContent = ''; const { error } = await sb.rpc('add_fx_rate', { p_usd_ngn: +rate.value, p_margin: +mar.value }); if (error) return out.append(msg('err', nice(error.message))); invoices(); };
  return h('div', { class: 'card' }, h('h3', {}, 'Dollar exchange rate'), h('div', { class: 'mut' }, r ? 'Current: ₦' + Number(r.usd_ngn).toLocaleString() + ' per $1 + ' + r.margin_pct + '% = ₦' + Number(r.used_rate).toLocaleString() + ' used on new dollar documents (' + r.rate_date + ')' : 'No rate yet. Add one before making a dollar quotation.'),
    field('Market rate (₦ per $1)', rate), field('Your margin (%)', mar), b, out);
}

async function invoice(id) {
  const { data: inv, error } = await sb.from('invoices').select('*, jobs(id,vehicles(registration,make,model),customers(name,phone,email))').eq('id', id).maybeSingle();
  if (error || !inv) return show(msg('err', 'Invoice not found.'));
  const [{ data: lines }, { data: pays }, { data: st }] = await Promise.all([
    sb.from('invoice_lines').select('*').eq('invoice_id', id).order('sort'), sb.from('payments').select('*').eq('invoice_id', id).order('created_at'),
    sb.from('v_invoice_status').select('*').eq('id', id).maybeSingle()]);
  const reload = () => invoice(id), draft = inv.status === 'DRAFT' && canBill(), cur = inv.currency;
  const parts = [h('a', { href: '#job/' + inv.job_id }, '← Job ' + inv.job_id), h('h2', {}, inv.id),
    h('div', { class: 'card' }, h('div', {}, h('b', {}, inv.jobs?.vehicles?.registration), ' ' + [inv.jobs?.vehicles?.make, inv.jobs?.vehicles?.model].filter(Boolean).join(' ')),
      h('div', { class: 'mut' }, (inv.jobs?.customers?.name || '') + (inv.jobs?.customers?.phone ? ' · ' + inv.jobs.customers.phone : '')),
      h('div', {}, h('span', { class: 'pill' }, inv.status), ' ', st?.payment_status && inv.status === 'ISSUED' ? h('span', { class: 'pill' }, st.payment_status) : '', ' ', cur, cur === 'USD' && inv.fx_rate ? ' · rate ₦' + Number(inv.fx_rate).toLocaleString() + ' per $1' : ''),
      inv.issue_date ? h('div', { class: 'mut' }, 'Issued ' + inv.issue_date + ' · due ' + inv.due_date) : '', inv.quotation_id ? h('div', { class: 'mut' }, 'From ', h('a', { href: '#quotation/' + inv.quotation_id }, inv.quotation_id)) : ''),
    h('div', { class: 'card' }, h('h3', {}, 'Items'), linesTable(lines || [], cur, draft, async lid => { const { error } = await sb.from('invoice_lines').delete().eq('id', lid); if (!error) reload(); }))];
  if (draft) parts.push(lineForm('invoice_lines', 'invoice_id', id, (lines || []).length + 1, reload));
  const out = h('div'), box = h('div', { class: 'card' }, h('h3', {}, 'Status'));
  const setStatus = (label, status, style) => h('button', { class: 'p', type: 'button', style: 'margin:0 6px 6px 0;' + (style || ''), onclick: async () => {
    if (status === 'CANCELLED' && !confirm('Cancel this invoice? This cannot be undone.')) return;
    out.textContent = ''; const { error } = await sb.from('invoices').update({ status }).eq('id', id); if (error) return out.append(msg('err', nice(error.message))); reload(); } }, label);
  if (canBill()) { if (inv.status === 'DRAFT') box.append(setStatus('Issue invoice', 'ISSUED'), setStatus('Cancel', 'CANCELLED', 'background:var(--bad)')); if (inv.status === 'ISSUED') box.append(setStatus('Cancel invoice', 'CANCELLED', 'background:var(--bad)')); }
  box.append(out); parts.push(box);
  parts.push(printButton('invoice', id, 'Print invoice / PDF'));
  if (inv.status === 'ISSUED' && inv.view_token) parts.push(h('div', { class: 'card' }, h('h3', {}, 'Invoice PDF link'), h('div', { class: 'mut' }, 'The customer opens this link without signing in and can download the invoice as a PDF. It always shows the latest balance.'), shareButtons(viewUrl('invoice', inv.view_token), 'Hello ' + (((inv.jobs?.customers || {}).name || '').split(' ')[0] || 'there') + ', here is your invoice ' + inv.id + ' from IKETECH AUTO LTD:', inv.jobs?.customers, 'Your invoice ' + inv.id + ' - IKETECH AUTO LTD')));

  if (inv.status === 'ISSUED' || (pays || []).length) {
    const pbox = h('div', { class: 'card' }, h('h3', {}, 'Payments'), st ? h('div', {}, 'Paid ' + money(st.paid, cur) + ' of ' + money(st.total, cur) + ' · balance ' + money(st.balance, cur)) : '');
    const reversed = new Set((pays || []).filter(p => p.reverses).map(p => p.reverses)), pout = h('div');
    for (const p of pays || []) pbox.append(h('div', { class: 'row' },
      h('span', {}, h('b', {}, money(p.amount, cur)), ' ' + p.method + (p.reference ? ' · ' + p.reference : ''), h('div', { class: 'mut' }, new Date(p.paid_at).toLocaleString() + (p.reason ? ' · ' + p.reason : '') + (reversed.has(p.id) ? ' · REVERSED' : '')),
        !p.reverses && !reversed.has(p.id) && p.receipt_token ? h('div', {}, h('div', { class: 'mut', style: 'margin-top:6px' }, 'Receipt:'), shareButtons(viewUrl('receipt', p.receipt_token), 'Hello, here is your payment receipt ' + p.id + ' from IKETECH AUTO LTD:', inv.jobs?.customers, 'Your payment receipt ' + p.id + ' - IKETECH AUTO LTD')) : ''),
      !p.reverses && !reversed.has(p.id) && can('ceo', 'manager', 'accounting') ? h('button', { type: 'button', style: 'color:var(--bad);background:none;border:0;cursor:pointer', onclick: async () => {
        const why = prompt('Why is this payment being reversed? (required)'); if (!why || why.trim().length < 5) return;
        const { error } = await sb.rpc('reverse_payment', { p_payment: p.id, p_reason: why.trim() }); if (error) return pout.append(msg('err', nice(error.message))); reload(); } }, 'Reverse') : ''));
    if (inv.status === 'ISSUED' && can('ceo', 'manager', 'admin', 'accounting', 'receptionist') && st && st.balance > 0) {
      const amt = h('input', { type: 'number', step: '0.01', value: st.balance }), meth = h('select', {}, ['Cash', 'Transfer', 'POS', 'Cheque', 'Online', 'Other'].map(x => h('option', {}, x))), ref = h('input', { placeholder: 'Transfer or POS reference' }),
        pay = h('button', { class: 'p', type: 'button' }, 'Record payment');
      pay.onclick = async () => { pout.textContent = ''; pay.disabled = true; const { error } = await sb.rpc('record_payment', { p_invoice: id, p_amount: +amt.value, p_method: meth.value, p_reference: ref.value.trim() || null }); pay.disabled = false; if (error) return pout.append(msg('err', nice(error.message))); reload(); };
      pbox.append(h('h4', {}, 'Record a payment'), field('Amount (' + cur + ')', amt), field('Method', meth), field('Reference', ref), pay);
    }
    pbox.append(pout); parts.push(pbox);
  }
  show(...parts);
}

boot();
