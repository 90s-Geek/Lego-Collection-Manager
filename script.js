// --- CONFIGURATION ---
const REBRICKABLE_API_KEY = '05a143eb0b36a4439e8118910912d050';
const SUPABASE_URL = 'https://sgmibyooymrocvojchxu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnbWlieW9veW1yb2N2b2pjaHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1Mzk0OTYsImV4cCI6MjA4NzExNTQ5Nn0.nLXsVr6mvsCQJijHsO2wkw49e0J4JZ-2oiLTpKZGmu0';

// Initialize Supabase Client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State variable to hold the set currently being viewed
let currentSet = null;

// --- INITIALIZATION ---
// Load the collection from Supabase when the page opens
window.onload = loadCollection;

// --- SEARCH FUNCTIONS ---
async function searchLego() {
    const input = document.getElementById('set-input').value.trim();
    if (!input) return alert("Enter a set number!");

    // Standardize set number: Rebrickable usually needs a suffix (e.g., 6080-1)
    const setNum = input.includes('-') ? input : `${input}-1`;
    const url = `https://rebrickable.com/api/v3/lego/sets/${setNum}/`;

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `key ${REBRICKABLE_API_KEY}` }
        });

        if (response.status === 404) throw new Error("Set not found. Try adding '-1'.");
        if (!response.ok) throw new Error("API Error: Check your Rebrickable key.");

        const data = await response.json();
        currentSet = data; // Store globally so we can save it later
        renderSearchResult(data);
    } catch (err) {
        console.error(err);
        alert(err.message);
    }
}

function renderSearchResult(set) {
    const container = document.getElementById('result-container');
    container.style.display = 'block';
    
    document.getElementById('set-title').innerText = `${set.name} (${set.year})`;
    document.getElementById('set-meta').innerText = `Parts: ${set.num_parts} | Set ID: ${set.set_num}`;
    document.getElementById('set-image').innerHTML = `<img src="${set.set_img_url}" alt="Lego Set" style="max-width:300px; border:2px solid #0f0;">`;
}

// --- SUPABASE DATABASE FUNCTIONS ---

// SAVE: Send the current set to your 'lego_collection' table
async function saveCurrentSet() {
    if (!currentSet) return;

    const { data, error } = await supabase
        .from('lego_collection')
        .insert([
            { 
                set_num: currentSet.set_num, 
                name: currentSet.name, 
                img_url: currentSet.set_img_url 
            }
        ]);

    if (error) {
        console.error("Save failed:", error.message);
        alert("Error: Make sure you created the 'lego_collection' table in Supabase!");
    } else {
        alert("Saved to your Supabase database!");
        loadCollection(); // Refresh the display list
    }
}

// LOAD: Fetch all saved sets from Supabase
async function loadCollection() {
    const { data, error } = await supabase
        .from('lego_collection')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Fetch failed:", error.message);
    } else {
        renderCollectionList(data);
    }
}

// DELETE: Remove a set from the database
async function deleteSet(id) {
    const { error } = await supabase
        .from('lego_collection')
        .delete()
        .eq('id', id);

    if (error) {
        alert("Delete failed: " + error.message);
    } else {
        loadCollection();
    }
}

// --- UI RENDERING ---
function renderCollectionList(items) {
    const listElement = document.getElementById('collection-list');
    listElement.innerHTML = ''; // Clear the list

    items.forEach((item) => {
        const li = document.createElement('li');
        li.style.cssText = "border: 1px solid #444; margin: 10px 0; padding: 10px; display: flex; align-items: center; justify-content: space-between;";
        
        li.innerHTML = `
            <div style="display: flex; align-items: center;">
                <img src="${item.img_url}" width="60" style="margin-right: 15px;">
                <span><strong>${item.name}</strong> (${item.set_num})</span>
            </div>
            <button onclick="deleteSet(${item.id})" style="background:red; color:white; border:none; padding:5px; cursor:pointer;">REMOVE</button>
        `;
        listElement.appendChild(li);
    });
}
