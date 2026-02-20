// --- CONFIGURATION ---
const REBRICKABLE_API_KEY = '05a143eb0b36a4439e8118910912d050';
const SUPABASE_URL = 'https://sgmibyooymrocvojchxu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnbWlieW9veW1yb2N2b2pjaHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1Mzk0OTYsImV4cCI6MjA4NzExNTQ5Nn0.nLXsVr6mvsCQJijHsO2wkw49e0J4JZ-2oiLTpKZGmu0';

// We rename the constant to 'db' to avoid the "already declared" SyntaxError
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentSet = null;

// --- INITIALIZATION ---
window.onload = () => {
    console.log("System Online. Loading collection...");
    loadCollection();
};

// --- SEARCH FUNCTIONS ---
async function searchLego() {
    const input = document.getElementById('set-input').value.trim();
    if (!input) return alert("Enter a set number!");

    const setNum = input.includes('-') ? input : `${input}-1`;
    const url = `https://rebrickable.com/api/v3/lego/sets/${setNum}/`;

    const container = document.getElementById('result-container');
    container.style.display = 'block';
    container.innerHTML = '<p>Scanning Rebrickable...</p>';

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `key ${REBRICKABLE_API_KEY}` }
        });

        if (!response.ok) throw new Error("Set not found.");

        const data = await response.json();
        currentSet = data;
        renderSearchResult(data);
    } catch (err) {
        container.innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
}

function renderSearchResult(set) {
    const container = document.getElementById('result-container');
    container.innerHTML = `
        <h2>${set.name} (${set.year})</h2>
        <img src="${set.set_img_url}" style="max-width:250px; border:1px solid #0f0;">
        <p>Parts: ${set.num_parts}</p>
        <button onclick="saveCurrentSet()" style="background:#ff00ff; color:white;">+ ADD TO COLLECTION</button>
    `;
}

// --- SUPABASE DATABASE FUNCTIONS ---

async function saveCurrentSet() {
    if (!currentSet) return;

    // We use 'db' here to match our renamed constant
    const { data, error } = await db
        .from('lego_collection')
        .insert([
            { 
                set_num: currentSet.set_num, 
                name: currentSet.name, 
                img_url: currentSet.set_img_url 
            }
        ]);

    if (error) {
        alert("Database Error: " + error.message);
    } else {
        alert("Saved to Supabase!");
        loadCollection();
    }
}

async function loadCollection() {
    const { data, error } = await db
        .from('lego_collection')
        .select('*')
        .order('created_at', { ascending: false });

    if (!error) {
        renderCollectionList(data);
    }
}

async function deleteSet(id) {
    if (!confirm("Remove this set?")) return;

    const { error } = await db
        .from('lego_collection')
        .delete()
        .eq('id', id);

    if (!error) loadCollection();
}

function renderCollectionList(items) {
    const listElement = document.getElementById('collection-list');
    listElement.innerHTML = '';

    items.forEach((item) => {
        const li = document.createElement('li');
        li.className = "collection-item";
        li.innerHTML = `
            <div style="display: flex; align-items: center;">
                <img src="${item.img_url}" width="50" style="margin-right:10px;">
                <span>${item.name} (${item.set_num})</span>
            </div>
            <button class="remove-btn" onclick="deleteSet(${item.id})">X</button>
        `;
        listElement.appendChild(li);
    });
}
