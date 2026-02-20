// --- CONFIGURATION ---
const REBRICKABLE_API_KEY = '05a143eb0b36a4439e8118910912d050';
const SUPABASE_URL = 'https://sgmibyooymrocvojchxu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnbWlieW9veW1yb2N2b2pjaHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1Mzk0OTYsImV4cCI6MjA4NzExNTQ5Nn0.nLXsVr6mvsCQJijHsO2wkw49e0J4JZ-2oiLTpKZGmu0';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentSet = null;

window.onload = () => {
    // Check if the dashboard container exists (index.html)
    if (document.getElementById('last-added-container')) {
        loadLastAdded();
    }
    // Check if the full list exists (collection.html)
    if (document.getElementById('collection-list')) {
        loadCollection();
    }
};

async function searchLego() {
    const input = document.getElementById('set-input').value.trim();
    if (!input) return alert("Enter a set number!");
    const setNum = input.includes('-') ? input : `${input}-1`;
    const setUrl = `https://rebrickable.com/api/v3/lego/sets/${setNum}/`;
    const container = document.getElementById('result-container');
    container.style.display = 'block';
    container.innerHTML = '<p>Accessing Rebrickable...</p>';

    try {
        const setRes = await fetch(setUrl, { headers: { 'Authorization': `key ${REBRICKABLE_API_KEY}` } });
        if (!setRes.ok) throw new Error("Set not found.");
        const setData = await setRes.json();

        // Fetch Theme Name
        const themeUrl = `https://rebrickable.com/api/v3/lego/themes/${setData.theme_id}/`;
        const themeRes = await fetch(themeUrl, { headers: { 'Authorization': `key ${REBRICKABLE_API_KEY}` } });
        const themeData = await themeRes.json();

        currentSet = { ...setData, theme_name: themeData.name || "Unknown Theme" };
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
        <button class="save-btn" onclick="saveCurrentSet()">+ ADD TO COLLECTION</button>
    `;
}

async function saveCurrentSet() {
    if (!currentSet) return;
    const { error } = await db.from('lego_collection').insert([{ 
        set_num: currentSet.set_num, 
        name: currentSet.name, 
        img_url: currentSet.set_img_url,
        year: currentSet.year,
        theme: currentSet.theme_name 
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
        .select('*').order('created_at', { ascending: false }).limit(1).single();

    if (error || !data) {
        container.innerHTML = "<p style='color:#666;'>No data available.</p>";
        return;
    }

    container.innerHTML = `
        <div class="last-added-card">
            <img src="${data.img_url}" width="60" style="border: 1px solid #00ff00;">
            <div>
                <div style="color: #fff;">${data.name}</div>
                <div style="font-size: 0.8em; color: #00ffff;">${data.theme} (${data.year})</div>
            </div>
        </div>
    `;
}

async function loadCollection() {
    const { data, error } = await db.from('lego_collection').select('*').order('created_at', { ascending: false });
    const list = document.getElementById('collection-list');
    if (error) return;
    list.innerHTML = data.length ? '' : '<li>No sets saved yet.</li>';
    data.forEach(item => {
        const li = document.createElement('li');
        li.className = "collection-item";

        const infoDiv = document.createElement('div');
        infoDiv.className = "collection-item-info";
        infoDiv.innerHTML = `
            <img src="${item.img_url}" width="50" style="margin-right:10px;border:1px solid #0f0;">
            <div>
                <strong>${item.name}</strong> (${item.year})<br>
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
        </div>
    `;
    document.getElementById('set-modal').classList.add('active');
}

function closeModal(e) {
    // Only close if clicking the dark backdrop, not the modal box itself
    if (e.target === document.getElementById('set-modal')) {
        document.getElementById('set-modal').classList.remove('active');
    }
}

async function deleteSet(id) {
    if (!confirm("Remove this set from your collection?")) return;
    const { error } = await db.from('lego_collection').delete().eq('id', id);
    if (error) {
        alert("Error removing set: " + error.message);
    } else {
        loadCollection(); // Refresh the list
    }
}

function exportCollection() {
    db.from('lego_collection').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
        if (error || !data.length) return alert("No data to export.");
        const headers = ['set_num', 'name', 'theme', 'year', 'img_url'];
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
