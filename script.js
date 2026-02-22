// --- CONFIGURATION ---
const REBRICKABLE_API_KEY = '05a143eb0b36a4439e8118910912d050';
const SUPABASE_URL = 'https://sgmibyooymrocvojchxu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnbWlieW9veW1yb2N2b2pjaHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1Mzk0OTYsImV4cCI6MjA4NzExNTQ5Nn0.nLXsVr6mvsCQJijHsO2wkw49e0J4JZ-2oiLTpKZGmu0';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentSet = null;

// --- Quick Links (single source of truth for all pages) ---
const QUICK_LINKS = [
    { label: 'eBay',       url: 'https://www.ebay.com/sch/i.html?_nkw=lego' },
    { label: 'Rebrickable', url: 'https://rebrickable.com' },
    { label: 'BrickLink',  url: 'https://www.bricklink.com' },
    { label: 'BrickOwl',    url: 'https://www.brickowl.com' },
    { label: 'BrickEconomy', url: 'https://www.brickeconomy.com' },
];

function renderQuickLinks() {
    const nav = document.querySelector('.quick-links');
    if (!nav) return;
    nav.innerHTML = '<span class="quick-links-title">LINKS</span>' +
        QUICK_LINKS.map(link =>
            `<a href="${link.url}" target="_blank" rel="noopener">${link.label}</a>`
        ).join('');
}

// --- Condition Options (single source of truth) ---
const CONDITIONS = [
    { value: 'Sealed',     label: 'Sealed',     color: '#00ff00' },
    { value: 'Complete',   label: 'Complete',   color: '#00ffff' },
    { value: 'Incomplete', label: 'Incomplete', color: '#ffaa00' },
    { value: 'Display',    label: 'Display',    color: '#ff00ff' },
];

function conditionBadge(condition) {
    const c = CONDITIONS.find(x => x.value === condition);
    if (!c) return '';
    return `<span style="font-size:0.7em;border:1px solid ${c.color};color:${c.color};padding:1px 6px;margin-left:6px;vertical-align:middle;">${c.label}</span>`;
}

function conditionSelectHTML(selected = '') {
    return `<select id="condition-select" style="background:#000;color:#00ff00;border:1px solid #00ff00;padding:6px 10px;font-family:'Courier New',monospace;font-size:0.85em;margin-top:10px;width:100%;">
        <option value="">— Set Condition —</option>
        ${CONDITIONS.map(c => `<option value="${c.value}"${selected === c.value ? ' selected' : ''}>${c.label}</option>`).join('')}
    </select>`;
}


// Avoids redundant Rebrickable API calls for themes already fetched this session
const themeCache = {};

async function fetchTheme(id) {
    if (themeCache[id]) return themeCache[id];
    try {
        const r = await fetch(`https://rebrickable.com/api/v3/lego/themes/${id}/`, {
            headers: { 'Authorization': `key ${REBRICKABLE_API_KEY}` }
        });
        const t = await r.json();
        themeCache[id] = t.name || "Unknown";
    } catch {
        themeCache[id] = "Unknown";
    }
    return themeCache[id];
}

// --- Input Debounce ---
let filterDebounce;
function debouncedFilter() {
    clearTimeout(filterDebounce);
    filterDebounce = setTimeout(() => {
        if (isWantlistPage()) {
            applyWantlistControls();
        } else {
            applyControls();
        }
    }, 200);
}

window.onload = () => {
    renderQuickLinks();
    // Check if the dashboard container exists (index.html)
    if (document.getElementById('last-added-container')) {
        loadLastAdded();
    }
    // Check if the full list exists (collection.html)
    if (document.getElementById('collection-list')) {
        if (document.body.dataset.page === 'wantlist') {
            loadWantlist();
        } else {
            loadCollection();
        }
    }
};

async function searchLego() {
    const input = document.getElementById('set-input').value.trim();
    if (!input) return alert("Enter a set number or name!");
    const container = document.getElementById('result-container');
    container.style.display = 'block';
    container.innerHTML = '<p>Accessing Rebrickable...</p>';

    // Detect if input looks like a set number (digits with optional dash + number)
    const isSetNum = /^\d+(-\d+)?$/.test(input);

    if (isSetNum) {
        await searchBySetNum(input, container);
    } else {
        await searchByName(input, container);
    }
}

async function searchBySetNum(input, container) {
    const setNum = input.includes('-') ? input : `${input}-1`;
    try {
        const setRes = await fetch(`https://rebrickable.com/api/v3/lego/sets/${setNum}/`, {
            headers: { 'Authorization': `key ${REBRICKABLE_API_KEY}` }
        });
        if (!setRes.ok) throw new Error("Set not found.");
        const setData = await setRes.json();

        const themeName = await fetchTheme(setData.theme_id);
        currentSet = { ...setData, theme_name: themeName };
        renderSearchResult(currentSet);
    } catch (err) {
        container.innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
}

async function searchByName(query, container) {
    try {
        const res = await fetch(`https://rebrickable.com/api/v3/lego/sets/?search=${encodeURIComponent(query)}&page_size=20&ordering=-year`, {
            headers: { 'Authorization': `key ${REBRICKABLE_API_KEY}` }
        });
        if (!res.ok) throw new Error("Search failed.");
        const data = await res.json();

        if (!data.results || data.results.length === 0) {
            container.innerHTML = `<p style="color:#ff6666;">No sets found for "<strong>${query}</strong>".</p>`;
            return;
        }

        // Only fetch themes not already in cache
        const themeIds = [...new Set(data.results.map(s => s.theme_id))];
        await Promise.all(themeIds.map(id => fetchTheme(id)));

        renderNameSearchResults(data.results, themeCache, query, data.count);
    } catch (err) {
        container.innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
}

function renderNameSearchResults(results, themeMap, query, totalCount) {
    const container = document.getElementById('result-container');
    const rows = results.map(set => `
        <li class="search-result-item" onclick="selectSearchResult('${set.set_num}', ${set.theme_id})">
            <img src="${set.set_img_url || ''}" width="50" style="border:1px solid #333; flex-shrink:0;">
            <div class="search-result-info">
                <strong>${set.name}</strong>
                <span class="search-result-meta">${set.set_num} &nbsp;|&nbsp; ${set.year} &nbsp;|&nbsp; ${themeMap[set.theme_id] || 'Unknown'}</span>
            </div>
        </li>
    `).join('');

    container.innerHTML = `
        <div style="text-align:left; margin-bottom:10px; font-size:0.8em; color:#888;">
            > ${totalCount} result${totalCount !== 1 ? 's' : ''} for "<span style="color:#00ffff;">${query}</span>"
            ${totalCount > 20 ? ' &nbsp;<span style="color:#555;">(showing top 20)</span>' : ''}
        </div>
        <ul class="search-results-list">${rows}</ul>
    `;
}

async function selectSearchResult(setNum, themeId) {
    const container = document.getElementById('result-container');
    container.innerHTML = '<p>Loading set details...</p>';
    try {
        const setRes = await fetch(`https://rebrickable.com/api/v3/lego/sets/${setNum}/`, {
            headers: { 'Authorization': `key ${REBRICKABLE_API_KEY}` }
        });
        if (!setRes.ok) throw new Error("Set not found.");
        const setData = await setRes.json();

        // fetchTheme uses cache — no extra API call if already fetched during search
        const themeName = await fetchTheme(themeId);
        currentSet = { ...setData, theme_name: themeName };
        renderSearchResult(currentSet);
    } catch (err) {
        container.innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
}

function renderSearchResult(set) {
    document.getElementById('result-container').innerHTML = `
        <h2>${set.name}</h2>
        <div class="set-meta">
            <strong>Year:</strong> ${set.year} | <strong>Theme:</strong> ${set.theme_name} | <strong>Set #:</strong> ${set.set_num}
        </div>
        <img src="${set.set_img_url}" style="max-width:250px; border:1px solid #0f0; margin-bottom: 10px;">
        <p>Parts: ${set.num_parts}</p>
        ${conditionSelectHTML()}
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:10px;">
            <button class="save-btn" onclick="saveCurrentSet()">+ ADD TO COLLECTION</button>
            <button class="wantlist-btn" onclick="saveToWantList()">♥ ADD TO WANT LIST</button>
        </div>
    `;
}

async function saveCurrentSet() {
    if (!currentSet) return;

    // Duplicate check — see if this set_num already exists in the collection
    const { data: existing, error: checkError } = await db
        .from('lego_collection')
        .select('id')
        .eq('set_num', currentSet.set_num)
        .limit(1);

    if (checkError) {
        alert("Database Error: " + checkError.message);
        return;
    }

    if (existing && existing.length > 0) {
        alert(`"${currentSet.name}" is already in your collection!`);
        return;
    }

    const condition = document.getElementById('condition-select')?.value || '';

    const { error } = await db.from('lego_collection').insert([{ 
        set_num: currentSet.set_num, 
        name: currentSet.name, 
        img_url: currentSet.set_img_url,
        year: currentSet.year,
        theme: currentSet.theme_name,
        condition: condition || null
    }]);

    if (error) {
        alert("Database Error: " + error.message);
    } else {
        alert("Saved successfully!");
        loadLastAdded(); // Refresh dashboard after save
    }
}

async function loadLastAdded() {
    const container = document.getElementById('last-added-container');
    const { data, error } = await db.from('lego_collection')
        .select('*').order('created_at', { ascending: false }).limit(1);

    if (error || !data || data.length === 0) {
        container.innerHTML = "<p style='color:#666;'>No data available.</p>";
        return;
    }

    const item = data[0];
    container.innerHTML = `
        <div class="last-added-card">
            <img src="${item.img_url}" width="60" style="border: 1px solid #00ff00;">
            <div>
                <div style="color: #fff;">${item.name}</div>
                <div style="font-size: 0.8em; color: #00ffff;">${item.theme} (${item.year})</div>
            </div>
        </div>
    `;
}

// --- View Mode ---
let currentView = 'list';

function isWantlistPage() {
    return document.body.dataset.page === 'wantlist';
}

async function loadViewPreference() {
    const col = isWantlistPage() ? 'view_mode_wantlist' : 'view_mode';
    const { data } = await db
        .from('user_preferences')
        .select(col)
        .eq('id', 'default')
        .single();
    currentView = (data && data[col]) ? data[col] : 'list';
}

async function setView(mode) {
    currentView = mode;
    const col = isWantlistPage() ? 'view_mode_wantlist' : 'view_mode';
    await db.from('user_preferences')
        .update({ [col]: mode, updated_at: new Date() })
        .eq('id', 'default');

    const btnList = document.getElementById('btn-list');
    const btnGrid = document.getElementById('btn-grid');
    if (mode === 'grid') {
        if (btnGrid) btnGrid.classList.add('active');
        if (btnList) btnList.classList.remove('active');
    } else {
        if (btnList) btnList.classList.add('active');
        if (btnGrid) btnGrid.classList.remove('active');
    }

    if (isWantlistPage()) {
        applyWantlistControls();
    } else {
        applyControls();
    }
}
let collectionCache = [];

async function loadCollection() {
    // Fetch view preference and collection data in parallel — no reason to wait on one for the other
    const [, { data, error }] = await Promise.all([
        loadViewPreference(),
        db.from('lego_collection').select('*').order('created_at', { ascending: false })
    ]);

    // Apply saved view preference to toggle buttons
    const btnList = document.getElementById('btn-list');
    const btnGrid = document.getElementById('btn-grid');
    if (currentView === 'grid') {
        if (btnGrid) btnGrid.classList.add('active');
        if (btnList) btnList.classList.remove('active');
    } else {
        if (btnList) btnList.classList.add('active');
        if (btnGrid) btnGrid.classList.remove('active');
    }

    if (error) {
        document.getElementById('collection-list').innerHTML = '<li>Error loading collection.</li>';
        return;
    }

    collectionCache = data || [];
    populateFilterDropdowns(collectionCache);
    applyControls();
}

function populateFilterDropdowns(data) {
    // Themes — sorted A-Z, unique
    const themes = [...new Set(data.map(i => i.theme).filter(Boolean))].sort();
    const themeSelect = document.getElementById('filter-theme');
    if (themeSelect) {
        const currentTheme = themeSelect.value;
        themeSelect.innerHTML = '<option value="">All Themes</option>';
        themes.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            if (t === currentTheme) opt.selected = true;
            themeSelect.appendChild(opt);
        });
    }

    // Years — sorted newest first, unique
    const years = [...new Set(data.map(i => i.year).filter(Boolean))].sort((a, b) => b - a);
    const yearSelect = document.getElementById('filter-year');
    if (yearSelect) {
        const currentYear = yearSelect.value;
        yearSelect.innerHTML = '<option value="">All Years</option>';
        years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (String(y) === currentYear) opt.selected = true;
            yearSelect.appendChild(opt);
        });
    }

    // Condition — fixed list, only on collection page
    const conditionSelect = document.getElementById('filter-condition');
    if (conditionSelect) {
        const currentCondition = conditionSelect.value;
        conditionSelect.innerHTML = '<option value="">All Conditions</option>';
        CONDITIONS.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.value;
            opt.textContent = c.label;
            if (c.value === currentCondition) opt.selected = true;
            conditionSelect.appendChild(opt);
        });
    }
}

function applyControls() {
    // Read sort
    const sortSelect = document.getElementById('sort-select');
    const [sortCol, sortDir] = sortSelect ? sortSelect.value.split('|') : ['created_at', 'desc'];

    // Read filters
    const filterTheme     = (document.getElementById('filter-theme')?.value || '').toLowerCase();
    const filterYear      = document.getElementById('filter-year')?.value || '';
    const filterName      = (document.getElementById('filter-name')?.value || '').toLowerCase().trim();
    const filterCondition = document.getElementById('filter-condition')?.value || '';

    // Filter
    let results = collectionCache.filter(item => {
        if (filterTheme     && (item.theme || '').toLowerCase() !== filterTheme) return false;
        if (filterYear      && String(item.year) !== filterYear) return false;
        if (filterName      && !(item.name || '').toLowerCase().includes(filterName)) return false;
        if (filterCondition && (item.condition || '') !== filterCondition) return false;
        return true;
    });

    // Sort
    results.sort((a, b) => {
        let valA = a[sortCol] ?? '';
        let valB = b[sortCol] ?? '';
        // Numeric sort for year
        if (sortCol === 'year') { valA = Number(valA); valB = Number(valB); }
        // Date sort
        if (sortCol === 'created_at') { valA = new Date(valA); valB = new Date(valB); }
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    renderCollection(results);
}

function clearFilters() {
    const themeEl     = document.getElementById('filter-theme');
    const yearEl      = document.getElementById('filter-year');
    const nameEl      = document.getElementById('filter-name');
    const conditionEl = document.getElementById('filter-condition');
    if (themeEl)     themeEl.value     = '';
    if (yearEl)      yearEl.value      = '';
    if (nameEl)      nameEl.value      = '';
    if (conditionEl) conditionEl.value = '';
    if (document.body.dataset.page === 'wantlist') {
        applyWantlistControls();
    } else {
        applyControls();
    }
}

function renderCollection(data) {
    const list = document.getElementById('collection-list');

    // Update count
    const countEl = document.getElementById('collection-count');
    if (countEl) {
        const total = collectionCache.length;
        const showing = data.length;
        if (total === 0) {
            countEl.innerHTML = '';
        } else if (showing === total) {
            countEl.innerHTML = `> <span>${total}</span> set${total !== 1 ? 's' : ''} in database`;
        } else {
            countEl.innerHTML = `> Showing <span>${showing}</span> of <span>${total}</span> sets`;
        }
    }

    list.innerHTML = '';
    list.classList.remove('grid-view');
    if (currentView === 'grid') list.classList.add('grid-view');
    if (!data.length) {
        list.innerHTML = '<li style="color:#666; padding:10px;">No sets match your filters.</li>';
        return;
    }

    data.forEach(item => {
        const li = document.createElement('li');
        li.className = "collection-item";

        const infoDiv = document.createElement('div');
        infoDiv.className = "collection-item-info";
        infoDiv.innerHTML = `
            <img src="${item.img_url}" width="${currentView === 'grid' ? '100' : '50'}" style="margin-right:${currentView === 'grid' ? '0' : '10px'};border:1px solid #0f0;">
            <div>
                <strong>${item.name}</strong> (${item.year})${conditionBadge(item.condition)}<br>
                <small style="color:#00ffff;">Theme: ${item.theme}</small>
            </div>`;
        infoDiv.addEventListener('click', () => showModal(item));

        const removeBtn = document.createElement('button');
        removeBtn.className = "remove-btn";
        removeBtn.textContent = "REMOVE";
        removeBtn.addEventListener('click', () => deleteSet(item.id));

        li.appendChild(infoDiv);
        li.appendChild(removeBtn);
        list.appendChild(li);
    });
}

function showModal(item) {
    document.getElementById('modal-content').innerHTML = `
        <button class="modal-close" onclick="document.getElementById('set-modal').classList.remove('active')">✕</button>
        <h2>${item.name}</h2>
        <img src="${item.img_url}" alt="${item.name}">
        <div class="modal-meta">
            <div><span class="label">Set #: </span><span class="value">${item.set_num || 'N/A'}</span></div>
            <div><span class="label">Year: </span><span class="value">${item.year}</span></div>
            <div><span class="label">Theme: </span><span class="value">${item.theme}</span></div>
            <div style="margin-top:10px;">
                <span class="label">Condition: </span>
                ${conditionSelectHTML(item.condition || '')}
                <button onclick="updateCondition(${item.id})" style="margin-top:8px;width:100%;background:#00ff00;color:#000;border:none;padding:7px;font-family:'Courier New',monospace;font-weight:bold;cursor:pointer;">UPDATE CONDITION</button>
            </div>
        </div>
    `;
    document.getElementById('set-modal').classList.add('active');
}

async function updateCondition(id) {
    const condition = document.getElementById('condition-select')?.value || null;
    const { error } = await db.from('lego_collection').update({ condition }).eq('id', id);
    if (error) {
        alert("Error updating condition: " + error.message);
        return;
    }
    // Update cache in-place
    const item = collectionCache.find(i => i.id === id);
    if (item) item.condition = condition;
    applyControls();
    document.getElementById('set-modal').classList.remove('active');
}

function closeModal(e) {
    // Only close if clicking the dark backdrop, not the modal box itself
    if (e.target === document.getElementById('set-modal')) {
        document.getElementById('set-modal').classList.remove('active');
    }
}

async function deleteSet(id) {
    if (document.body.dataset.page === 'wantlist') return; // Safety guard — never delete from collection on wantlist page
    if (!confirm("Remove this set from your collection?")) return;
    const { error } = await db.from('lego_collection').delete().eq('id', id);
    if (error) {
        alert("Error removing set: " + error.message);
    } else {
        // Update cache in-place — no need to re-fetch all data from Supabase
        collectionCache = collectionCache.filter(i => i.id !== id);
        populateFilterDropdowns(collectionCache);
        applyControls();
    }
}

// --- WANT LIST ---

async function saveToWantList() {
    if (!currentSet) return;

    const { data: existing, error: checkError } = await db
        .from('lego_wantlist')
        .select('id')
        .eq('set_num', currentSet.set_num)
        .limit(1);

    if (checkError) { alert("Database Error: " + checkError.message); return; }
    if (existing && existing.length > 0) { alert(`"${currentSet.name}" is already on your want list!`); return; }

    const { error } = await db.from('lego_wantlist').insert([{
        set_num: currentSet.set_num,
        name: currentSet.name,
        img_url: currentSet.set_img_url,
        year: currentSet.year,
        theme: currentSet.theme_name
    }]);

    if (error) { alert("Database Error: " + error.message); }
    else { alert("Added to want list!"); }
}

let wantlistCache = [];

async function loadWantlist() {
    // Fetch view preference and wantlist data in parallel
    const [, { data, error }] = await Promise.all([
        loadViewPreference(),
        db.from('lego_wantlist').select('*').order('created_at', { ascending: false })
    ]);

    const btnList = document.getElementById('btn-list');
    const btnGrid = document.getElementById('btn-grid');
    if (currentView === 'grid') {
        if (btnGrid) btnGrid.classList.add('active');
        if (btnList) btnList.classList.remove('active');
    } else {
        if (btnList) btnList.classList.add('active');
        if (btnGrid) btnGrid.classList.remove('active');
    }

    if (error) {
        document.getElementById('collection-list').innerHTML = '<li>Error loading want list.</li>';
        return;
    }

    wantlistCache = data || [];
    populateFilterDropdowns(wantlistCache);
    applyWantlistControls();
}

function applyWantlistControls() {
    const sortSelect = document.getElementById('sort-select');
    const [sortCol, sortDir] = sortSelect ? sortSelect.value.split('|') : ['created_at', 'desc'];

    const filterTheme = (document.getElementById('filter-theme')?.value || '').toLowerCase();
    const filterYear  = document.getElementById('filter-year')?.value || '';
    const filterName  = (document.getElementById('filter-name')?.value || '').toLowerCase().trim();

    let results = wantlistCache.filter(item => {
        if (filterTheme && (item.theme || '').toLowerCase() !== filterTheme) return false;
        if (filterYear  && String(item.year) !== filterYear) return false;
        if (filterName  && !(item.name || '').toLowerCase().includes(filterName)) return false;
        return true;
    });

    results.sort((a, b) => {
        let valA = a[sortCol] ?? '';
        let valB = b[sortCol] ?? '';
        if (sortCol === 'year') { valA = Number(valA); valB = Number(valB); }
        if (sortCol === 'created_at') { valA = new Date(valA); valB = new Date(valB); }
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    renderWantlist(results);
}

function renderWantlist(data) {
    const list = document.getElementById('collection-list');

    const countEl = document.getElementById('collection-count');
    if (countEl) {
        const total = wantlistCache.length;
        const showing = data.length;
        if (total === 0) {
            countEl.innerHTML = '';
        } else if (showing === total) {
            countEl.innerHTML = `> <span>${total}</span> set${total !== 1 ? 's' : ''} on want list`;
        } else {
            countEl.innerHTML = `> Showing <span>${showing}</span> of <span>${total}</span> sets`;
        }
    }

    list.innerHTML = '';
    list.classList.remove('grid-view');
    if (currentView === 'grid') list.classList.add('grid-view');
    if (!data.length) {
        list.innerHTML = '<li style="color:#666; padding:10px;">No sets match your filters.</li>';
        return;
    }

    data.forEach(item => {
        const li = document.createElement('li');
        li.className = "collection-item";

        const infoDiv = document.createElement('div');
        infoDiv.className = "collection-item-info";
        infoDiv.innerHTML = `
            <img src="${item.img_url}" width="${currentView === 'grid' ? '100' : '50'}" style="margin-right:${currentView === 'grid' ? '0' : '10px'};border:1px solid #ff00ff;">
            <div>
                <strong>${item.name}</strong> (${item.year})<br>
                <small style="color:#00ffff;">Theme: ${item.theme}</small>
            </div>`;
        infoDiv.addEventListener('click', () => showModal(item));

        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display:flex;flex-direction:column;gap:5px;flex-shrink:0;margin-left:10px;';

        const addBtn = document.createElement('button');
        addBtn.className = "add-from-want-btn";
        addBtn.textContent = "→ COLLECT";
        addBtn.title = "Move to collection";
        addBtn.addEventListener('click', () => moveToCollection(item));

        const removeBtn = document.createElement('button');
        removeBtn.className = "remove-btn";
        removeBtn.textContent = "REMOVE";
        removeBtn.addEventListener('click', () => deleteFromWantlist(item.id));

        btnGroup.appendChild(addBtn);
        btnGroup.appendChild(removeBtn);
        li.appendChild(infoDiv);
        li.appendChild(btnGroup);
        list.appendChild(li);
    });
}

async function moveToCollection(item) {
    if (!confirm(`Move "${item.name}" to your collection?`)) return;

    const { data: existing } = await db.from('lego_collection').select('id').eq('set_num', item.set_num).limit(1);
    if (existing && existing.length > 0) {
        if (!confirm(`"${item.name}" is already in your collection. Remove it from want list anyway?`)) return;
    } else {
        const { error } = await db.from('lego_collection').insert([{
            set_num: item.set_num, name: item.name, img_url: item.img_url, year: item.year, theme: item.theme
        }]);
        if (error) { alert("Error saving to collection: " + error.message); return; }
    }

    await db.from('lego_wantlist').delete().eq('id', item.id);
    // Update cache in-place — no need to re-fetch all data from Supabase
    wantlistCache = wantlistCache.filter(i => i.id !== item.id);
    populateFilterDropdowns(wantlistCache);
    applyWantlistControls();
}

async function deleteFromWantlist(id) {
    if (!confirm("Remove this set from your want list?")) return;
    const { error } = await db.from('lego_wantlist').delete().eq('id', id);
    if (error) {
        alert("Error removing set: " + error.message);
    } else {
        // Update cache in-place — no need to re-fetch all data from Supabase
        wantlistCache = wantlistCache.filter(i => i.id !== id);
        populateFilterDropdowns(wantlistCache);
        applyWantlistControls();
    }
}

// --- CSV IMPORT ---

function closeImportModal(e) {
    if (e.target === document.getElementById('import-modal')) {
        document.getElementById('import-modal').classList.remove('active');
    }
}

function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return null;

    // Parse header — strip BOM, quotes, whitespace
    const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h =>
        h.trim().replace(/^"|"$/g, '').toLowerCase()
    );

    if (!headers.includes('set_num')) return null;

    return lines.slice(1).map(line => {
        // Handle quoted fields containing commas
        const fields = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') {
                inQuotes = !inQuotes;
            } else if (line[i] === ',' && !inQuotes) {
                fields.push(current.trim());
                current = '';
            } else {
                current += line[i];
            }
        }
        fields.push(current.trim());

        const row = {};
        headers.forEach((h, i) => { row[h] = (fields[i] || '').trim(); });
        return row;
    }).filter(row => row.set_num); // Skip blank rows
}

async function handleCSVFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const preview = document.getElementById('import-preview');
    preview.innerHTML = '<p style="color:#888;">⟳ Reading file...</p>';

    const text = await file.text();
    const rows = parseCSV(text);

    if (!rows) {
        preview.innerHTML = '<p style="color:#ff6666;">Invalid CSV — must have a <strong>set_num</strong> column.</p>';
        return;
    }

    preview.innerHTML = `<p style="color:#888;">⟳ Checking ${rows.length} set${rows.length !== 1 ? 's' : ''} against your collection...</p>`;

    // Fetch existing set_nums from collection to detect duplicates
    const { data: existing } = await db.from('lego_collection').select('set_num');
    const existingNums = new Set((existing || []).map(r => r.set_num));

    // Normalise set_num (add -1 suffix if missing)
    const normalise = s => /^\d+$/.test(s.trim()) ? `${s.trim()}-1` : s.trim();

    const toImport = rows.map(r => ({ ...r, set_num: normalise(r.set_num) }))
                         .filter(r => !existingNums.has(r.set_num));
    const skipped  = rows.length - toImport.length;

    if (toImport.length === 0) {
        preview.innerHTML = `<p style="color:#ffaa00;">All ${rows.length} sets are already in your collection. Nothing to import.</p>`;
        return;
    }

    preview.innerHTML = `
        <div style="border:1px solid #333;padding:12px;margin-top:10px;text-align:left;font-size:0.8em;max-height:200px;overflow-y:auto;">
            <div style="color:#888;margin-bottom:8px;">
                Ready to import <span style="color:#00ffff;">${toImport.length}</span> set${toImport.length !== 1 ? 's' : ''}
                ${skipped ? `<span style="color:#ffaa00;"> (${skipped} duplicate${skipped !== 1 ? 's' : ''} skipped)</span>` : ''}
            </div>
            ${toImport.map(r => `<div style="color:#00ff00;margin-bottom:2px;">+ ${r.set_num}${r.name ? ' — ' + r.name : ''}</div>`).join('')}
        </div>
        <button id="confirm-import-btn" onclick="confirmImport()" style="width:100%;margin-top:10px;background:#00ff00;color:#000;padding:10px;font-family:'Courier New',monospace;font-weight:bold;border:none;cursor:pointer;">
            ↑ IMPORT ${toImport.length} SET${toImport.length !== 1 ? 'S' : ''}
        </button>
    `;

    // Store pending rows on button for confirmImport to access
    document.getElementById('confirm-import-btn').dataset.pending = JSON.stringify(toImport);
}

async function confirmImport() {
    const btn = document.getElementById('confirm-import-btn');
    const toImport = JSON.parse(btn.dataset.pending || '[]');
    if (!toImport.length) return;

    const preview = document.getElementById('import-preview');
    btn.disabled = true;

    let imported = 0;
    let failed = 0;
    const failedSets = [];

    const updateProgress = (currentSet = '') => {
        preview.innerHTML = `
            <div style="border:1px solid #333;padding:15px;margin-top:10px;text-align:left;font-size:0.85em;">
                <div style="color:#888;margin-bottom:10px;">IMPORTING...</div>
                <div style="background:#111;border:1px solid #333;height:12px;margin-bottom:10px;box-sizing:border-box;">
                    <div style="background:#00ff00;height:100%;width:${Math.round(((imported + failed) / toImport.length) * 100)}%;transition:width 0.2s;"></div>
                </div>
                <div style="color:#00ffff;margin-bottom:4px;">${imported + failed} / ${toImport.length} processed</div>
                <div style="color:#00ff00;">✓ ${imported} added</div>
                ${failed ? `<div style="color:#ff6666;">✗ ${failed} failed</div>` : ''}
                ${currentSet ? `<div style="color:#555;margin-top:8px;font-size:0.8em;">⟳ ${currentSet}</div>` : ''}
            </div>
        `;
    };

    updateProgress();

    for (const row of toImport) {
        try {
            let { set_num, name, theme, year, condition } = row;

            updateProgress(set_num);

            // If name/theme/year missing, fetch from Rebrickable
            if (!name || !theme || !year) {
                const res = await fetch(`https://rebrickable.com/api/v3/lego/sets/${set_num}/`, {
                    headers: { 'Authorization': `key ${REBRICKABLE_API_KEY}` }
                });
                if (!res.ok) throw new Error('Not found on Rebrickable');
                const data = await res.json();
                name  = name  || data.name;
                year  = year  || data.year;
                theme = theme || await fetchTheme(data.theme_id);
            }

            const validConditions = CONDITIONS.map(c => c.value);
            const cleanCondition = validConditions.includes(condition) ? condition : null;

            const { error } = await db.from('lego_collection').insert([{
                set_num, name,
                img_url: `https://cdn.rebrickable.com/media/sets/${set_num}.jpg`,
                year: parseInt(year) || null,
                theme,
                condition: cleanCondition
            }]);

            if (error) throw new Error(error.message);
            imported++;
            updateProgress(set_num);
        } catch (err) {
            failed++;
            failedSets.push(`${row.set_num} (${err.message})`);
            updateProgress();
        }
    }

    // Final state
    preview.innerHTML = `
        <div style="border:1px solid #333;padding:15px;margin-top:10px;text-align:left;font-size:0.85em;">
            <div style="color:#00ff00;margin-bottom:8px;">✓ IMPORT COMPLETE</div>
            <div style="background:#111;border:1px solid #333;height:12px;margin-bottom:10px;">
                <div style="background:#00ff00;height:100%;width:100%;"></div>
            </div>
            <div style="color:#00ffff;">${imported} set${imported !== 1 ? 's' : ''} added to collection</div>
            ${failed ? `<div style="color:#ff6666;margin-top:6px;">✗ ${failed} failed:<br>${failedSets.map(s => `<span style="color:#884444;">${s}</span>`).join('<br>')}</div>` : ''}
        </div>
    `;

    // Reload collection cache with fresh data
    await loadCollection();
    document.getElementById('csv-file-input').value = '';
}


function exportWantlist() {
    db.from('lego_wantlist').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
        if (error || !data.length) return alert("No data to export.");
        const headers = ['set_num', 'name', 'theme', 'year', 'img_url'];
        const rows = data.map(item => headers.map(h => `"${(item[h] || '').toString().replace(/"/g, '""')}"`).join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lego_wantlist.csv';
        a.click();
        URL.revokeObjectURL(url);
    });
}

function exportCollection() {
    db.from('lego_collection').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
        if (error || !data.length) return alert("No data to export.");
        const headers = ['set_num', 'name', 'theme', 'year', 'condition', 'img_url'];
        const rows = data.map(item => headers.map(h => `"${(item[h] || '').toString().replace(/"/g, '""')}"`).join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lego_collection.csv';
        a.click();
        URL.revokeObjectURL(url);
    });
}
