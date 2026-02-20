// Replace with your real key from Rebrickable Settings -> API
const API_KEY = '05a143eb0b36a4439e8118910912d050'; 

async function searchLego() {
    const input = document.getElementById('set-input').value.trim();
    if (!input) return alert("Enter a set number!");

    // Rebrickable usually needs a suffix like -1 (e.g., 6080-1)
    const setNum = input.includes('-') ? input : `${input}-1`;
    const url = `https://rebrickable.com/api/v3/lego/sets/${setNum}/`;

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `key ${API_KEY}` }
        });

        if (response.status === 404) throw new Error("Set not found. Try adding '-1' or '-2'.");
        if (!response.ok) throw new Error("API Error");

        const data = await response.json();
        renderSet(data);
    } catch (err) {
        alert(err.message);
    }
}

function renderSet(set) {
    const container = document.getElementById('result-container');
    container.style.display = 'block';
    
    document.getElementById('set-title').innerText = `${set.name} (${set.year})`;
    document.getElementById('set-meta').innerText = `Parts: ${set.num_parts} | Set ID: ${set.set_num}`;
    document.getElementById('set-image').innerHTML = `<img src="${set.set_img_url}" alt="Lego Set">`;
}
