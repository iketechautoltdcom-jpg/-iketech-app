/* IKETECH AUTO LTD - staff app (no build step). Talks to Supabase; the database enforces every rule. */
const sb = supabase.createClient(IKETECH.SUPABASE_URL, IKETECH.SUPABASE_ANON_KEY);
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
    if (error) { out.append(msg('err', 'Could not sign in: ' + error.message + (error.status ? ' (code ' + error.status + ')' : ''))); btn.disabled = false; } else boot();
  };
  show(h('div', { class: 'card' }, h('h2', {}, 'Sign in'), note ? msg('err', note) : '', field('Email', email), field('Password', pw), btn, out));
}

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { $who.textContent = ''; $out.hidden = true; return loginPage(); }
  const { data, error } = await sb.from('profiles').select('id, full_name, role, branch_id, is_active').eq('id', session.user.id).maybeSingle();
  if (error || !data || !data.is_active) { await sb.auth.signOut(); return loginPage(error ? 'Signed in, but the staff profile could not be read: ' + error.message : 'Signed in, but there is no active staff profile for this login. The profile row must use this user\'s id.'); }
  me = data; $who.textContent = data.full_name + ' · ' + data.role; $out.hidden = false;
  route();
}
$out.onclick = async () => { await sb.auth.signOut(); me = null; boot(); };
window.addEventListener('hashchange', () => me && route());

// ---- routing ----
function route() {
  const [page, arg] = (location.hash.slice(1) || 'home').split('/');
  ({ home, customers, customer, jobs, job, branches, team }[page] || home)(arg);
}

function home() {
  const t = (href, title, sub) => h('a', { class: 'tile', href }, title, h('small', {}, sub));
  const tiles = [];
  if (can('ceo','manager','admin','advisor','receptionist')) tiles.push(t('#customers', 'Customers', 'Add and find customers and vehicles'));
  tiles.push(t('#jobs', 'Jobs', can('technician') ? 'Your assigned jobs' : 'Open and recent jobs'));
  if (can('ceo')) tiles.push(t('#branches', 'Branches', 'Add and manage branches'), t('#team', 'Team', 'Roles and access'));
  show(h('h2', {}, 'Hello, ' + me.full_name.split(' ')[0]), h('div', { class: 'grid' }, tiles));
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
    h('p', {}, h('b', {}, 'Customer complaint: '), j.complaint)),
    editable ? h('div', { class: 'card' }, field('Status', st), field('Diagnosis', diag),
      h('label', {}, conf, ' Diagnosis is confirmed by a test (only confirmed diagnoses go on quotations)'), field('Recommended solution', sol), save, out)
      : h('div', { class: 'card' }, h('div', {}, 'Status: ' + j.status.replace(/_/g, ' '))));
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

boot();
