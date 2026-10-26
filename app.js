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
  ({ home, customers, customer, jobs, job, inspections, insp, branches, team }[page] || home)(arg);
}

function home() {
  const t = (href, title, sub) => h('a', { class: 'tile', href }, title, h('small', {}, sub));
  const tiles = [];
  if (can('ceo','manager','admin','advisor','receptionist')) tiles.push(t('#customers', 'Customers', 'Add and find customers and vehicles'));
  tiles.push(t('#inspections', 'Inspections', can('technician') ? 'Your vehicle inspections' : 'Vehicle inspections and reports'));
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
    h('p', {}, h('b', {}, 'Customer complaint: '), j.complaint),
    can('ceo','manager','admin','supervisor','advisor','receptionist') ? h('a', { href: '#insp/new:' + j.vehicle_id + ':' + j.id }, 'Start vehicle inspection →') : ''),
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

boot();
