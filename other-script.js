// --- Active nav link ---
document.querySelectorAll('.nav a').forEach(a => {
    if (a.href === location.href || a.pathname === location.pathname) {
        a.classList.add('active');
    }
});

// --- CONFIGURATION ---
const SUPABASE_URL = 'https://sgmibyooymrocvojchxu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnbWlieW9veW1yb2N2b2pjaHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1Mzk0OTYsImV4cCI6MjA4NzExNTQ5Nn0.nLXsVr6mvsCQJijHsO2wkw49e0J4JZ-2oiLTpKZGmu0';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Page detection ---
const PAGE = document.body.dataset.page; // 'other-collection' or 'other-wantlist'
const TABLE = PAGE === 'other-wantlist' ? 'other_wantlist' : 'other_collection';
const IS_WANTLIST = PAGE === 'other-wantlist';

let itemCache = [];
let currentView = 'list';

// --- CONDITIONS ---
const CONDITIONS = [
    { value: 'New Sealed',    label: 'New Sealed' },
    { value: 'New Open',      label: 'New Open' },
    { value: 'Complete',      label: 'Complete' },
    { value: 'Incomplete',    label: 'Incomplete' },
    { value: 'Used',          label: 'Used' },
    { value: 'Parts Only',    label: 'Parts Only' },
    { value: 'For Display',   label: 'For Display' },
];

// ─── Toast ───────────────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => { toast.classList.add('visible'); });
    });
    setTimeout(() => {
        toast.classList.remove('visible');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3200);
}

// ─── Utility ─────────────────────────────────────────────────────────────────
function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function conditionBadge(condition) {
    if (!condition) return '';
    const colors = {
        'New Sealed': '#00ff00', 'New Open': '#00cc00', 'Complete': '#00aaff',
        'Incomplete': '#ffaa00', 'Used': '#ff8800', 'Parts Only': '#ff4444', 'For Display': '#cc88ff'
    };
    const color = colors[condition] || '#aaa';
    return ` <span style="font-family:var(--mono);font-size:0.62em;color:${color};border:1px solid ${color}44;padding:1px 6px;border-radius:3px;vertical-align:middle;">${condition}</span>`;
}

function conditionSelectHTML(selected = '') {
    return `<select id="condition-select" style="background:var(--surface2);color:var(--green);border:1px solid var(--green-dim);padding:6px 10px;font-family:var(--mono);font-size:0.8em;border-radius:var(--radius-sm);width:100%;margin-top:4px;">
        <option value="">-- Select Condition --</option>
        ${CONDITIONS.map(c => `<option value="${c.value}"${selected === c.value ? ' selected' : ''}>${c.label}</option>`).join('')}
    </select>`;
}

function attachImgFallback(imgEl) {
    imgEl.onerror = function() {
        this.onerror = null;
        this.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='45'><rect width='60' height='45' fill='%23111'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' font-size='9' fill='%23333' font-family='monospace'>NO IMG</text></svg>";
    };
}

// ─── Controls (sort/filter/search) ───────────────────────────────────────────
function toggleControls() {
    const body = document.getElementById('controls-body');
    const title = document.getElementById('controls-toggle');
    const isOpen = body.classList.contains('open');
    body.classList.toggle('open', !isOpen);
    title.classList.toggle('open', !isOpen);
    try { localStorage.setItem(`other_controls_open_${PAGE}`, String(!isOpen)); } catch {}
}

function restoreControlsState() {
    try {
        const saved = localStorage.getItem(`other_controls_open_${PAGE}`);
        const open = saved === null ? true : saved === 'true';
        const body = document.getElementById('controls-body');
        const title = document.getElementById('controls-toggle');
        if (open) { body.classList.add('open'); title.classList.add('open'); }
    } catch {}
}

let filterDebounce = null;
function debouncedFilter() {
    clearTimeout(filterDebounce);
    filterDebounce = setTimeout(() => applyControls(), 200);
}

function applyControls() {
    const sortVal = document.getElementById('sort-select')?.value || 'created_at|desc';
    const [sortCol, sortDir] = sortVal.split('|');
    const filterBrand = (document.getElementById('filter-brand')?.value || '').toLowerCase();
    const filterYear  = document.getElementById('filter-year')?.value || '';
    const filterName  = (document.getElementById('filter-name')?.value || '').toLowerCase().trim();
    const filterCond  = document.getElementById('filter-condition')?.value || '';

    let filtered = [...itemCache];

    if (filterBrand) filtered = filtered.filter(i => (i.brand || '').toLowerCase() === filterBrand);
    if (filterYear)  filtered = filtered.filter(i => String(i.year) === filterYear);
    if (filterName)  filtered = filtered.filter(i => (i.name || '').toLowerCase().includes(filterName));
    if (filterCond && !IS_WANTLIST)  filtered = filtered.filter(i => i.condition === filterCond);

    filtered.sort((a, b) => {
        let va = a[sortCol], vb = b[sortCol];
        if (va == null) va = ''; if (vb == null) vb = '';
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    renderItems(filtered);
}

function clearFilters() {
    const ids = ['filter-brand', 'filter-year', 'filter-name', 'filter-condition'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const sort = document.getElementById('sort-select');
    if (sort) sort.value = 'created_at|desc';
    applyControls();
}

function populateFilterDropdowns(data) {
    const brands = [...new Set(data.map(i => i.brand).filter(Boolean))].sort();
    const years   = [...new Set(data.map(i => i.year).filter(Boolean))].sort((a,b) => b - a);

    const brandSel = document.getElementById('filter-brand');
    if (brandSel) {
        const cur = brandSel.value;
        brandSel.innerHTML = '<option value="">All Brands</option>' +
            brands.map(b => `<option value="${escapeHTML(b)}"${cur === b ? ' selected' : ''}>${escapeHTML(b)}</option>`).join('');
    }
    const yearSel = document.getElementById('filter-year');
    if (yearSel) {
        const cur = yearSel.value;
        yearSel.innerHTML = '<option value="">All Years</option>' +
            years.map(y => `<option value="${y}"${String(cur) === String(y) ? ' selected' : ''}>${y}</option>`).join('');
    }

    if (!IS_WANTLIST) {
        const conds = [...new Set(data.map(i => i.condition).filter(Boolean))].sort();
        const condSel = document.getElementById('filter-condition');
        if (condSel) {
            const cur = condSel.value;
            condSel.innerHTML = '<option value="">All Conditions</option>' +
                conds.map(c => `<option value="${escapeHTML(c)}"${cur === c ? ' selected' : ''}>${escapeHTML(c)}</option>`).join('');
        }
    }
}

// ─── View toggle ─────────────────────────────────────────────────────────────
function setView(mode) {
    currentView = mode;
    document.getElementById('btn-list')?.classList.toggle('active', mode === 'list');
    document.getElementById('btn-grid')?.classList.toggle('active', mode === 'grid');
    try { localStorage.setItem(`other_view_${PAGE}`, mode); } catch {}
    applyControls();
}

function loadViewPreference() {
    try {
        const saved = localStorage.getItem(`other_view_${PAGE}`);
        if (saved) { currentView = saved; setView(saved); }
    } catch {}
}

// ─── Load from Supabase ───────────────────────────────────────────────────────
async function loadItems() {
    const { data, error } = await db.from(TABLE).select('*').order('created_at', { ascending: false });
    if (error) {
        showToast('Error loading data: ' + error.message, 'error');
        document.getElementById('collection-list').innerHTML = '<li style="color:#f44;padding:10px;">Failed to load data.</li>';
        return;
    }
    itemCache = data || [];
    populateFilterDropdowns(itemCache);
    applyControls();
    updateCount(itemCache.length, itemCache.length);
}

function updateCount(showing, total) {
    const el = document.getElementById('collection-count');
    if (!el) return;
    if (total === 0) { el.innerHTML = ''; return; }
    if (showing === total) {
        el.innerHTML = `> <span>${total}</span>&nbsp;set${total !== 1 ? 's' : ''} in database`;
    } else {
        el.innerHTML = `> Showing&nbsp;<span>${showing}</span>&nbsp;of&nbsp;<span>${total}</span>&nbsp;sets`;
    }
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderItems(data) {
    const list = document.getElementById('collection-list');
    updateCount(data.length, itemCache.length);

    list.innerHTML = '';
    list.classList.remove('grid-view');
    if (currentView === 'grid') list.classList.add('grid-view');

    if (!data.length) {
        list.innerHTML = '<li style="color:#666;padding:10px;">No sets match your filters.</li>';
        return;
    }

    data.forEach((item, idx) => {
        const li = document.createElement('li');
        li.className = 'collection-item collection-item-fadein';
        li.style.animationDelay = `${Math.min(idx * 30, 400)}ms`;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'collection-item-info';

        const img = document.createElement('img');
        img.src = item.img_url || '';
        img.alt = item.name || '';
        img.width = currentView === 'grid' ? 100 : 50;
        img.style.cssText = `margin-right:${currentView === 'grid' ? '0' : '10px'};border:1px solid #0f0;cursor:pointer;`;
        attachImgFallback(img);
        img.addEventListener('click', e => { e.stopPropagation(); showModal(item); });

        const textDiv = document.createElement('div');
        const priceBadge = !IS_WANTLIST && item.price_paid != null
            ? `<span style="font-family:var(--mono);font-size:0.62em;color:var(--green);margin-left:6px;border:1px solid var(--green-dim);padding:1px 5px;border-radius:3px;vertical-align:middle;" title="Price paid">$${Number(item.price_paid).toFixed(2)}</span>`
            : '';
        const pieceBadge = item.pieces
            ? `<span style="font-family:var(--mono);font-size:0.62em;color:#888;margin-left:6px;border:1px solid #333;padding:1px 5px;border-radius:3px;vertical-align:middle;">${item.pieces} pcs</span>`
            : '';
        textDiv.innerHTML = `
            <strong>${escapeHTML(item.name)}</strong> (${item.year || '?'})${IS_WANTLIST ? '' : conditionBadge(item.condition)}${priceBadge}${pieceBadge}<br>
            <small style="color:#00ffff;">Brand: ${escapeHTML(item.brand || '—')}</small>`;

        infoDiv.appendChild(img);
        infoDiv.appendChild(textDiv);
        infoDiv.addEventListener('click', () => showModal(item));

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = 'REMOVE';
        removeBtn.addEventListener('click', e => { e.stopPropagation(); deleteItem(item.id); });

        li.appendChild(infoDiv);
        li.appendChild(removeBtn);
        list.appendChild(li);
    });
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function showModal(item) {
    const conditionSection = IS_WANTLIST ? '' : `
        <div style="margin-top:10px;">
            <span class="label">Condition: </span>
            ${conditionSelectHTML(item.condition || '')}
            <button onclick="updateCondition(${item.id})" style="margin-top:8px;width:100%;background:#00ff00;color:#000;border:none;padding:7px;font-family:'Courier New',monospace;font-weight:bold;cursor:pointer;">UPDATE CONDITION</button>
        </div>`;

    const priceSection = IS_WANTLIST ? '' : `
        <div style="margin-top:12px;border-top:1px solid var(--border2);padding-top:12px;">
            <div style="font-family:var(--mono);font-size:0.68em;color:var(--text-muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Price Paid</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="font-family:var(--mono);color:var(--green);font-size:1em;">$</span>
                <input id="modal-price-input" type="number" min="0" step="0.01"
                    value="${item.price_paid != null ? item.price_paid : ''}"
                    placeholder="0.00"
                    style="background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:6px 10px;font-family:var(--mono);font-size:0.9em;width:120px;outline:none;"
                    onfocus="this.style.borderColor='var(--green-dim)'" onblur="this.style.borderColor='var(--border2)'">
            </div>
            <button onclick="updatePricePaid(${item.id})" style="width:100%;background:transparent;color:var(--green);border:1px solid var(--green-dim);padding:7px;font-family:var(--mono);font-size:0.75em;font-weight:bold;cursor:pointer;border-radius:var(--radius-sm);letter-spacing:1px;transition:background 0.2s;" onmouseover="this.style.background='rgba(0,255,136,0.08)'" onmouseout="this.style.background='transparent'">UPDATE PRICE</button>
        </div>`;

    const notesSection = `
        <div style="margin-top:12px;border-top:1px solid var(--border2);padding-top:12px;">
            <div style="font-family:var(--mono);font-size:0.68em;color:var(--text-muted);letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Notes</div>
            <textarea id="modal-notes-input" placeholder="Add notes..."
                style="background:var(--surface2);color:var(--text);border:1px solid var(--border2);border-radius:var(--radius-sm);padding:8px;font-family:var(--mono);font-size:0.8em;width:100%;box-sizing:border-box;min-height:70px;outline:none;resize:vertical;"
                onfocus="this.style.borderColor='var(--green-dim)'" onblur="this.style.borderColor='var(--border2)'">${escapeHTML(item.notes || '')}</textarea>
            <button onclick="updateNotes(${item.id})" style="margin-top:6px;width:100%;background:transparent;color:var(--green);border:1px solid var(--green-dim);padding:7px;font-family:var(--mono);font-size:0.75em;font-weight:bold;cursor:pointer;border-radius:var(--radius-sm);letter-spacing:1px;transition:background 0.2s;" onmouseover="this.style.background='rgba(0,255,136,0.08)'" onmouseout="this.style.background='transparent'">UPDATE NOTES</button>
        </div>`;

    document.getElementById('modal-content').innerHTML = `
        <button class="modal-close" onclick="document.getElementById('set-modal').classList.remove('active')">✕</button>
        <h2>${escapeHTML(item.name)}</h2>
        <div class="modal-img-wrap">
            <img id="modal-set-img" src="${escapeHTML(item.img_url || '')}" alt="${escapeHTML(item.name)}">
        </div>
        <div class="modal-meta">
            <div><span class="label">Brand: </span><span class="value">${escapeHTML(item.brand || '—')}</span></div>
            <div><span class="label">Year: </span><span class="value">${item.year || '—'}</span></div>
            <div><span class="label">Pieces: </span><span class="value">${item.pieces || '—'}</span></div>
            ${item.set_id ? `<div><span class="label">Set ID: </span><span class="value">${escapeHTML(item.set_id)}</span></div>` : ''}
            ${!IS_WANTLIST && item.condition ? `<div><span class="label">Condition: </span>${conditionBadge(item.condition)}</div>` : ''}
            ${conditionSection}
            ${priceSection}
            ${notesSection}
        </div>`;
    const img = document.getElementById('modal-set-img');
    if (img) attachImgFallback(img);
    document.getElementById('set-modal').classList.add('active');
}

function closeModal(e) {
    if (e.target === document.getElementById('set-modal')) {
        document.getElementById('set-modal').classList.remove('active');
    }
}

async function updateCondition(id) {
    const raw = document.getElementById('condition-select')?.value || '';
    const valid = CONDITIONS.map(c => c.value);
    const condition = valid.includes(raw) ? raw : null;
    const { error } = await db.from(TABLE).update({ condition }).eq('id', id);
    if (error) { showToast('Error updating condition: ' + error.message, 'error'); return; }
    const item = itemCache.find(i => i.id === id);
    if (item) item.condition = condition;
    showToast('Condition updated!', 'success');
    applyControls();
    document.getElementById('set-modal').classList.remove('active');
}

async function updatePricePaid(id) {
    const raw = document.getElementById('modal-price-input')?.value;
    const price_paid = (raw !== '' && raw != null) ? parseFloat(raw) : null;
    const { error } = await db.from(TABLE).update({ price_paid: (!isNaN(price_paid) && price_paid !== null) ? price_paid : null }).eq('id', id);
    if (error) { showToast('Error updating price: ' + error.message, 'error'); return; }
    const item = itemCache.find(i => i.id === id);
    if (item) item.price_paid = price_paid;
    showToast('Price updated!', 'success');
    applyControls();
    document.getElementById('set-modal').classList.remove('active');
}

async function updateNotes(id) {
    const notes = document.getElementById('modal-notes-input')?.value || '';
    const { error } = await db.from(TABLE).update({ notes }).eq('id', id);
    if (error) { showToast('Error updating notes: ' + error.message, 'error'); return; }
    const item = itemCache.find(i => i.id === id);
    if (item) item.notes = notes;
    showToast('Notes updated!', 'success');
    document.getElementById('set-modal').classList.remove('active');
}

// ─── Delete ───────────────────────────────────────────────────────────────────
async function deleteItem(id) {
    const label = IS_WANTLIST ? 'want list' : 'collection';
    if (!confirm(`Remove this set from your ${label}?`)) return;
    const { error } = await db.from(TABLE).delete().eq('id', id);
    if (error) { showToast('Error removing set: ' + error.message, 'error'); return; }
    itemCache = itemCache.filter(i => i.id !== id);
    showToast('Set removed.', 'info');
    populateFilterDropdowns(itemCache);
    applyControls();
}

// ─── Add Item Form ────────────────────────────────────────────────────────────
function openAddModal() {
    const condRow = IS_WANTLIST ? '' : `
        <div class="add-form-row">
            <label>Condition</label>
            ${conditionSelectHTML('')}
        </div>
        <div class="add-form-row">
            <label>Price Paid ($)</label>
            <input type="number" id="add-price" min="0" step="0.01" placeholder="0.00" class="add-form-input">
        </div>`;

    document.getElementById('modal-content').innerHTML = `
        <button class="modal-close" onclick="document.getElementById('set-modal').classList.remove('active')">✕</button>
        <h2>ADD NEW SET</h2>
        <div style="font-family:var(--mono);font-size:0.7em;color:var(--text-muted);margin-bottom:16px;letter-spacing:1px;">Manually enter set details below.</div>
        <div class="add-form">
            <div class="add-form-row">
                <label>Name <span class="add-required">*</span></label>
                <input type="text" id="add-name" placeholder="e.g. Mega Construx Halo Warthog" class="add-form-input">
            </div>
            <div class="add-form-row">
                <label>Brand <span class="add-required">*</span></label>
                <input type="text" id="add-brand" placeholder="e.g. Mega Construx, K'NEX, Playmobil" class="add-form-input">
            </div>
            <div class="add-form-row">
                <label>Year</label>
                <input type="number" id="add-year" placeholder="e.g. 2022" min="1950" max="2099" class="add-form-input">
            </div>
            <div class="add-form-row">
                <label>Pieces</label>
                <input type="number" id="add-pieces" placeholder="e.g. 314" min="1" class="add-form-input">
            </div>
            <div class="add-form-row">
                <label>Set ID / #</label>
                <input type="text" id="add-set-id" placeholder="e.g. GNB25" class="add-form-input">
            </div>
            <div class="add-form-row">
                <label>Image URL</label>
                <input type="url" id="add-img-url" placeholder="https://..." class="add-form-input">
            </div>
            ${condRow}
            <div class="add-form-row">
                <label>Notes</label>
                <textarea id="add-notes" placeholder="Optional notes..." class="add-form-textarea"></textarea>
            </div>
            <button onclick="submitAddForm()" class="add-submit-btn">+ ADD TO ${IS_WANTLIST ? 'WANT LIST' : 'COLLECTION'}</button>
        </div>`;

    document.getElementById('set-modal').classList.add('active');
    setTimeout(() => document.getElementById('add-name')?.focus(), 80);
}

async function submitAddForm() {
    const name   = document.getElementById('add-name')?.value.trim();
    const brand  = document.getElementById('add-brand')?.value.trim();
    const year   = parseInt(document.getElementById('add-year')?.value) || null;
    const pieces = parseInt(document.getElementById('add-pieces')?.value) || null;
    const set_id = document.getElementById('add-set-id')?.value.trim() || null;
    const img_url = document.getElementById('add-img-url')?.value.trim() || null;
    const notes  = document.getElementById('add-notes')?.value.trim() || null;

    if (!name)  { showToast('Name is required.', 'warning'); return; }
    if (!brand) { showToast('Brand is required.', 'warning'); return; }

    const record = { name, brand, year, pieces, set_id, img_url, notes };

    if (!IS_WANTLIST) {
        const raw = document.getElementById('condition-select')?.value || '';
        const valid = CONDITIONS.map(c => c.value);
        record.condition = valid.includes(raw) ? raw : null;
        const priceRaw = document.getElementById('add-price')?.value;
        const price_paid = (priceRaw !== '' && priceRaw != null) ? parseFloat(priceRaw) : null;
        record.price_paid = (!isNaN(price_paid) && price_paid !== null) ? price_paid : null;
    }

    const { error } = await db.from(TABLE).insert([record]);
    if (error) { showToast('Error saving: ' + error.message, 'error'); return; }

    showToast(`Added "${name}" to your ${IS_WANTLIST ? 'want list' : 'collection'}!`, 'success');
    document.getElementById('set-modal').classList.remove('active');
    await loadItems();
}

// ─── Export ───────────────────────────────────────────────────────────────────
function exportItems() {
    if (!itemCache.length) { showToast('Nothing to export.', 'warning'); return; }
    const cols = IS_WANTLIST
        ? ['name', 'brand', 'year', 'pieces', 'set_id', 'notes', 'created_at']
        : ['name', 'brand', 'year', 'pieces', 'set_id', 'condition', 'price_paid', 'notes', 'created_at'];
    const header = cols.join(',');
    const rows = itemCache.map(i => cols.map(c => {
        const v = i[c] != null ? String(i[c]) : '';
        return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = IS_WANTLIST ? 'other-wantlist.csv' : 'other-collection.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    restoreControlsState();
    loadViewPreference();
    loadItems();
});
