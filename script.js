// --- CONFIGURATION ---
const REBRICKABLE_API_KEY = '05a143eb0b36a4439e8118910912d050';
const SUPABASE_URL = 'https://sgmibyooymrocvojchxu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnbWlieW9veW1yb2N2b2pjaHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1Mzk0OTYsImV4cCI6MjA4NzExNTQ5Nn0.nLXsVr6mvsCQJijHsO2wkw49e0J4JZ-2oiLTpKZGmu0';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentSet = null;

window.onload = () => {
    // Show the last set added if we are on the search page
    if (document.getElementById('last-added-container')) {
        loadLastAdded();
    }
    // Load full collection if we are on the collection page
    if (document.getElementById('collection-list')) {
        loadCollection();
    }
};

// --- SEARCH LOGIC ---
async function searchLego() {
    const input = document.getElementById('set-input').value.trim();
    if (!input) return alert("Enter a set number!");

    const setNum = input.includes('-') ? input : `${input}-1`;
    const setUrl = `https://rebrickable.com/api/v3/lego/sets/${setNum}/`;
    const container = document.getElementById('result-container');

    container.style.display = 'block';
    container.innerHTML = '<p>Accessing Rebrickable...</p>';

    try {
        // 1. Fetch Set Data
        const setRes = await fetch(setUrl, { headers: { 'Authorization': `key ${REBRICKABLE_API_KEY}` } });
        if (!setRes.ok) throw new Error("Set not found.");
        const setData = await setRes.json();

        // 2. Fetch Theme Name
        const themeUrl = `https://rebrickable.com/api/v3/lego/themes/${setData.theme_id}/`;
        const themeRes = await fetch(themeUrl, { headers: { 'Authorization': `key ${REBRICKABLE_API_KEY}` } });
        const themeData = await themeRes.json();

        // 3. Combine Data
        currentSet = {
            ...setData,
            theme_name: themeData.name || "Unknown Theme"
        };

        renderSearchResult(currentSet);
    } catch (err) {
        container.innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
}

function renderSearchResult(set) {
    document.getElementById('result-container').innerHTML = `
        <h2>${set.name}</h2>
        <div class="set-meta">
            <strong>Year:</strong> ${set.year} | 
            <strong>Theme:</strong> ${set.theme_name} | 
            <strong>Set #:</strong> ${set.set_num}
        </div>
        <img src="${set.set_img_url}" style="max-width:250px; border:1px solid #0f0; margin-bottom: 10px;">
        <p>Parts: ${set.num_parts}</p>
        <button class="save-btn" onclick="saveCurrentSet()">+ ADD TO COLLECTION</button>
    `;
}

// --- DATABASE LOGIC ---
async function saveCurrentSet() {
    if (!currentSet) return;
    
    // We omit 'id' because Supabase Identity generates it automatically
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
        if (document.getElementById('last-added-container')) loadLastAdded();
    }
}

async function loadLastAdded() {
    const container = document.getElementById('last-added-container');
    const { data, error } = await db.from('lego_collection')
        .select('*').order('created_at', { ascending: false }).limit(1).single();

    if (error || !data) {
        container.innerHTML = "<p style='color:#666;'>No data in database.</p>";
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
    if (error) { list.innerHTML = `<li>Error: ${error.message}</li>`; return; }
    
    list.innerHTML = data.length ? '' : '<li>No sets saved yet.</li>';
    data.forEach(item => {
        const li = document.createElement('li');
        li.className = "collection-item";
        li.innerHTML = `
            <div style="display:flex;align-items:center;">
                <img src="${item.img_url}" width="50" style="margin-right:10px;border:1px solid #0f0;">
                <div>
                    <strong>${item.name}</strong> (${item.year})<br>
                    <small style="color:#00ffff;">Theme: ${item.theme}</small>
                </div>
            </div>
            <button class="remove-btn" onclick="deleteSet(${item.id})">REMOVE</button>`;
        list.appendChild(li);
    });
}

async function deleteSet(id) {
    if (!confirm("Remove this set?")) return;
    const { error } = await db.from('lego_collection').delete().eq('id', id);
    if (!error) loadCollection();
}

async function exportCollection() {
    const { data, error } = await db.from('lego_collection').select('set_num, name, year, theme');
    if (error || !data.length) return alert("Export failed.");

    let csv = "Set Number,Name,Year,Theme\n" + 
              data.map(i => `${i.set_num},"${i.name}",${i.year},"${i.theme}"`).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "lego_collection.csv"; a.click();
}
