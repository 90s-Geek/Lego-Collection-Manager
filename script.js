// --- CONFIGURATION ---
const REBRICKABLE_API_KEY = '05a143eb0b36a4439e8118910912d050';
const SUPABASE_URL = 'https://sgmibyooymrocvojchxu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnbWlieW9veW1yb2N2b2pjaHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1Mzk0OTYsImV4cCI6MjA4NzExNTQ5Nn0.nLXsVr6mvsCQJijHsO2wkw49e0J4JZ-2oiLTpKZGmu0';

// FIX: Variables here must match the ones defined above
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentSet = null;

window.onload = () => {
    if (document.getElementById('collection-list')) {
        loadCollection();
    }
};

// --- SEARCH (index.html) ---
async function searchLego() {
    const input = document.getElementById('set-input').value.trim();
    if (!input) return alert("Enter a set number!");

    const setNum = input.includes('-') ? input : `${input}-1`;
    const url = `https://rebrickable.com/api/v3/lego/sets/${setNum}/`;
    const container = document.getElementById('result-container');

    container.style.display = 'block';
    container.innerHTML = '<p>Accessing Rebrickable...</p>';

    try {
        // FIX: Changed REBRICKABLE_KEY to REBRICKABLE_API_KEY
        const response = await fetch(url, { headers: { 'Authorization': `key ${REBRICKABLE_API_KEY}` } });
        if (!response.ok) throw new Error("Set not found.");
        const data = await response.json();
        currentSet = data;
        renderSearchResult(data);
    } catch (err) {
        container.innerHTML = `<p style="color:red;">${err.message}</p>`;
    }
}

// ... rest of your functions (renderSearchResult, saveCurrentSet, etc.) stay the same
