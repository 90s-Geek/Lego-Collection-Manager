// --- CONFIGURATION ---
const REBRICKABLE_API_KEY = '05a143eb0b36a4439e8118910912d050';
const SUPABASE_URL = 'https://sgmibyooymrocvojchxu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnbWlieW9veW1yb2N2b2pjaHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1Mzk0OTYsImV4cCI6MjA4NzExNTQ5Nn0.nLXsVr6mvsCQJijHsO2wkw49e0J4JZ-2oiLTpKZGmu0';

// Initialize Supabase Client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State variable to hold the set currently being viewed in the search result
let currentSet = null;

// --- INITIALIZATION ---
// This runs as soon as the page finishes loading
window.onload = () => {
    console.log("App Initialized. Loading collection...");
    loadCollection();
};

// --- SEARCH FUNCTIONS ---
async function searchLego() {
    const input = document.getElementById('set-input').value.trim();
    if (!input) return alert("Please enter a LEGO set number.");

    // Standardize set number: Rebrickable usually expects '6080-1'
    const setNum = input.includes('-') ? input : `${input}-1`;
    const url = `https://rebrickable.com/api/v3/lego/sets/${setNum}/`;

    // Visual feedback
    const container = document.getElementById('result-container');
    container.style.display = 'block';
    container.innerHTML = '<p>Scanning database...</p>';

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `key ${REBRICKABLE_API_KEY}` }
        });

        if (response.status === 404) throw new Error("Set not found. Try a different number.");
        if (!response.ok) throw new Error("Network error. Check your API key.");

        const data = await response.json();
        currentSet = data; // Store the data globally for the 'Save' function
        renderSearchResult(data);
    } catch (err) {
        container.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
    }
}

function renderSearchResult(set) {
    const container = document.getElementById('result-container');
    container.innerHTML = `
        <h2 id="set-title">${set.name} (${set.year})</h2>
        <div id="set-image">
            <img src="${set.set_img_url}" alt="${set.name}" style="max-width:300px; border:2px solid #0f0;">
        </div>
        <p id="set-meta">Parts: ${set.num_parts} | Set ID: ${set.set_num}</p>
        <button onclick="saveCurrentSet()" style="margin-top: 10px;">+ ADD TO COLLECTION</button>
    `;
}

// --- SUPABASE DATABASE FUNCTIONS ---

// SAVE: Adds the searched set to Supabase
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
        console.error("Save Error:", error.message);
        alert("Could not save to database. Check your RLS policies!");
    } else {
        alert(`${currentSet.name} saved successfully!`);
        loadCollection(); // Refresh the list view below
    }
}

// VIEW/LOAD: Fetches the entire collection from Supabase
async function loadCollection() {
    const listElement = document.getElementById('collection-list');
    
    // Fetch all items from the table
    const { data, error } = await supabase
        .from('lego_collection')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Fetch Error:", error.message);
        listElement.innerHTML = `<li style="color:red;">Failed to connect to Supabase.</li>`;
        return;
    }

    renderCollectionList(data);
}

// DELETE: Removes a set from the database
async function deleteSet(id) {
    if (!confirm("Remove this set from your collection?")) return;

    const { error } = await supabase
        .from('lego_collection')
        .delete()
        .eq('id', id);

    if (error) {
        alert("Delete error: " + error.message);
    } else {
        loadCollection(); // Refresh the list
    }
}

// UI RENDERING: Builds the HTML list for the saved sets
function renderCollectionList(items) {
    const listElement = document.getElementById('collection-list');
    listElement.innerHTML = ''; // Clear current display

    if (items.length === 0) {
        listElement.innerHTML = '<li>Collection is empty.</li>';
        return;
    }

    items.forEach((item) => {
        const li = document.createElement('li');
        li.className = "collection-item"; // Matches the CSS in your HTML
        
        li.innerHTML = `
            <div style="display: flex; align-items: center;">
                <img src="${item.img_url}" width="60" style="margin-right: 15px; border: 1px solid #0f0;">
                <div>
                    <strong>${item.name}</strong><br>
                    <small>Set #${item.set_num}</small>
                </div>
            </div>
            <button class="remove-btn" onclick="deleteSet(${item.id})">REMOVE</button>
        `;
        listElement.appendChild(li);
    });
}
