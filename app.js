let currentTasting = { id: null, name: '', date: '', participants: [], whiskies: [], ratings: {} };
let editingWhiskyIndex = null;
let currentRatingContext = { participant: null, whiskyIndex: null };

window.onload = function() {
    loadDashboard();
    document.getElementById('setup-date').valueAsDate = new Date();
    updateParticipantDatalist();
};

function navigateTo(viewId) {
    document.querySelectorAll('.view').forEach(view => view.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
    
    // Wenn wir ins Setup gehen, Felder mit aktuellen Werten füllen
    if(viewId === 'view-setup') {
        document.getElementById('setup-name').value = currentTasting.name;
        document.getElementById('setup-date').value = currentTasting.date;
        updateParticipantList();
    }
    window.scrollTo(0, 0);
}

// --- SETUP & TEILNEHMER ---
function addParticipant() {
    const input = document.getElementById('setup-participant-name');
    const name = input.value.trim();
    if(name && !currentTasting.participants.includes(name)) {
        currentTasting.participants.push(name);
        let pDB = JSON.parse(localStorage.getItem('participantDB')) || [];
        if(!pDB.includes(name)) { pDB.push(name); localStorage.setItem('participantDB', JSON.stringify(pDB)); }
        updateParticipantList(); updateParticipantDatalist(); input.value = '';
    }
}

function updateParticipantList() {
    const ul = document.getElementById('participant-list');
    ul.innerHTML = '';
    currentTasting.participants.forEach(name => {
        ul.innerHTML += `<li>${name} <span style="color:#e74c3c; cursor:pointer; margin-left:5px;" onclick="removeParticipant('${name}')">✕</span></li>`;
    });
}

function removeParticipant(name) {
    currentTasting.participants = currentTasting.participants.filter(p => p !== name);
    updateParticipantList();
}

function updateParticipantDatalist() {
    let pDB = JSON.parse(localStorage.getItem('participantDB')) || [];
    let list = document.getElementById('known-participants');
    list.innerHTML = '';
    pDB.forEach(p => list.innerHTML += `<option value="${p}"></option>`);
}

// --- LIVE GRID STARTEN ---
function startTastingGrid() {
    currentTasting.name = document.getElementById('setup-name').value || 'Unbenanntes Tasting';
    currentTasting.date = document.getElementById('setup-date').value;
    if(!currentTasting.id) currentTasting.id = 't_' + Date.now();

    if(currentTasting.participants.length === 0) return alert("Bitte füge mindestens einen Teilnehmer hinzu!");

    document.getElementById('grid-title').innerText = currentTasting.name;
    updateDatalists();
    renderGrid();
    saveTasting(); // Speichert den Stand (inkl. neuer Teilnehmer)
    navigateTo('view-grid');
}

// --- TABELLE GENERIEREN ---
function renderGrid() {
    const table = document.getElementById('tasting-table');
    let cols = currentTasting.whiskies.map((w, i) => ({ w: w, idx: i, f: parseInt(w.flight) || 1 }));
    cols.sort((a, b) => a.f - b.f);

    let flightRow = `<tr><th rowspan="2" style="background:#111;">Teilnehmer</th>`;
    let whiskyRow = `<tr>`;

    if (cols.length > 0) {
        let currentFlight = cols[0].f;
        let span = 0;
        cols.forEach((c) => {
            if (c.f !== currentFlight) {
                flightRow += `<th colspan="${span}" class="flight-header">Flight ${currentFlight}</th>`;
                currentFlight = c.f; span = 1;
            } else { span++; }
            let title = c.w.name + (c.w.age ? ` (${c.w.age}J)` : '');
            whiskyRow += `<th onclick="openWhiskyModal(${c.idx})" class="whisky-header"><strong>${title}</strong><br>✏️</th>`;
        });
        flightRow += `<th colspan="${span}" class="flight-header">Flight ${currentFlight}</th>`;
    }
    flightRow += `<th rowspan="2" style="background:#111;"><button class="add-whisky-btn" onclick="openWhiskyModal(null)">+🥃</button></th></tr>`;
    whiskyRow += `</tr>`;

    let html = `<thead>${flightRow}${whiskyRow}</thead><tbody>`;

    currentTasting.participants.forEach(pName => {
        html += `<tr><td style="background:#222; position:sticky; left:0; z-index:2;">${pName}</td>`;
        cols.forEach(c => {
            let r = currentTasting.ratings[pName]?.[c.idx];
            let overallValue = r && r.overall ? r.overall : '';
            html += `<td><input type="number" step="0.1" class="inline-input" value="${overallValue}" onchange="updateInlineRating('${pName}', ${c.idx}, this.value)"> <span onclick="openRatingModal('${pName}', ${c.idx})">📝</span></td>`;
        });
        html += `<td></td></tr>`;
    });
    table.innerHTML = html + `</tbody>`;
}

function updateInlineRating(participant, whiskyIndex, value) {
    if(!currentTasting.ratings[participant]) currentTasting.ratings[participant] = {};
    if(!currentTasting.ratings[participant][whiskyIndex]) currentTasting.ratings[participant][whiskyIndex] = { nose: '', taste: '', finish: '', overall: '' };
    currentTasting.ratings[participant][whiskyIndex].overall = value;
    saveTasting(); 
}

// --- MODALS ---
function closeModal(id) { document.getElementById(id).style.display = "none"; }

function openWhiskyModal(index) {
    editingWhiskyIndex = index;
    if(index !== null) {
        let w = currentTasting.whiskies[index];
        ['name', 'distillery', 'type', 'country', 'age', 'abv', 'flight'].forEach(key => document.getElementById('w-'+key).value = w[key] || '');
    } else {
        ['w-name', 'w-distillery', 'w-type', 'w-country', 'w-age', 'w-abv'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('w-flight').value = currentTasting.whiskies.length > 0 ? Math.max(...currentTasting.whiskies.map(w => parseInt(w.flight))) : 1;
    }
    document.getElementById('modal-whisky').style.display = "block";
}

function saveWhiskyFromModal() {
    let wData = {
        name: document.getElementById('w-name').value, distillery: document.getElementById('w-distillery').value,
        type: document.getElementById('w-type').value, country: document.getElementById('w-country').value,
        age: document.getElementById('w-age').value, abv: document.getElementById('w-abv').value,
        flight: document.getElementById('w-flight').value || 1
    };
    if(!wData.name) return alert("Name fehlt!");
    if(editingWhiskyIndex !== null) currentTasting.whiskies[editingWhiskyIndex] = wData;
    else { currentTasting.whiskies.push(wData); saveToMasterDB(wData); }
    closeModal('modal-whisky'); saveTasting(); renderGrid();
}

function openRatingModal(p, idx) {
    currentRatingContext = { participant: p, whiskyIndex: idx };
    let r = currentTasting.ratings[p]?.[idx] || { nose: '', taste: '', finish: '', overall: '' };
    document.getElementById('modal-rating-subtitle').innerText = `${p}: ${currentTasting.whiskies[idx].name}`;
    ['nose', 'taste', 'finish', 'overall'].forEach(k => document.getElementById('r-'+k).value = r[k]);
    document.getElementById('modal-rating').style.display = "block";
}

function saveRatingFromModal() {
    let p = currentRatingContext.participant; let idx = currentRatingContext.whiskyIndex;
    if(!currentTasting.ratings[p]) currentTasting.ratings[p] = {};
    currentTasting.ratings[p][idx] = {
        nose: document.getElementById('r-nose').value, taste: document.getElementById('r-taste').value,
        finish: document.getElementById('r-finish').value, overall: document.getElementById('r-overall').value
    };
    closeModal('modal-rating'); saveTasting(); renderGrid();
}

// --- DB ---
function saveToMasterDB(w) {
    let db = JSON.parse(localStorage.getItem('whiskyDB')) || [];
    if(!db.find(x => x.name === w.name)) { db.push(w); localStorage.setItem('whiskyDB', JSON.stringify(db)); }
}
function autoFillWhisky(i) {
    let w = (JSON.parse(localStorage.getItem('whiskyDB')) || []).find(x => x.name === i.value);
    if(w) ['distillery', 'type', 'country', 'age', 'abv'].forEach(k => document.getElementById('w-'+k).value = w[k] || '');
}
function updateDatalists() {
    let db = JSON.parse(localStorage.getItem('whiskyDB')) || [];
    document.getElementById('known-whiskies').innerHTML = db.map(w => `<option value="${w.name}">`).join('');
}

function saveTasting() {
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    let idx = tastings.findIndex(t => t.id === currentTasting.id);
    if(idx >= 0) tastings[idx] = currentTasting; else tastings.push(currentTasting);
    localStorage.setItem('whiskyTastings', JSON.stringify(tastings));
}

function loadDashboard() {
    const container = document.getElementById('tasting-list-container');
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    if(tastings.length === 0) return container.innerHTML = "<p>Noch keine Tastings.</p>";
    tastings.sort((a, b) => new Date(b.date) - new Date(a.date));
    let html = '';
    let years = [...new Set(tastings.map(t => t.date.split('-')[0]))].sort((a, b) => b - a);
    years.forEach(y => {
        html += `<details open><summary class="year-summary">${y}</summary><ul style="list-style:none;padding:0;">`;
        tastings.filter(t => t.date.startsWith(y)).forEach(t => {
            html += `<li class="tasting-item"><strong>${t.name}</strong> (${t.date})<br>
            <button class="btn-secondary" onclick="resumeTasting('${t.id}')">✏️</button>
            <button class="btn-secondary" style="border-color:#e74c3c;color:#e74c3c" onclick="deleteSingleTasting('${t.id}')">🗑️</button></li>`;
        });
        html += `</ul></details>`;
    });
    container.innerHTML = html;
}

function resumeTasting(id) {
    currentTasting = JSON.parse(localStorage.getItem('whiskyTastings')).find(t => t.id === id);
    startTastingGrid();
}

function deleteSingleTasting(id) {
    if(confirm("Löschen?")) {
        let t = JSON.parse(localStorage.getItem('whiskyTastings')).filter(x => x.id !== id);
        localStorage.setItem('whiskyTastings', JSON.stringify(t)); loadDashboard();
    }
}

// --- EXPORT/IMPORT ---
function exportDatabase() {
    let data = { tastings: JSON.parse(localStorage.getItem('whiskyTastings')), whiskies: JSON.parse(localStorage.getItem('whiskyDB')), participants: JSON.parse(localStorage.getItem('participantDB')) };
    let blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    let a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = "DramScore_Backup.json"; a.click();
}

function importDatabase(e) {
    let reader = new FileReader();
    reader.onload = (f) => {
        let d = JSON.parse(f.target.result);
        localStorage.setItem('whiskyTastings', JSON.stringify(d.tastings)); localStorage.setItem('whiskyDB', JSON.stringify(d.whiskies)); localStorage.setItem('participantDB', JSON.stringify(d.participants));
        location.reload();
    };
    reader.readAsText(e.target.files[0]);
}

function finishAndShowResults() {
    saveTasting();
    const container = document.getElementById('podium-container');
    container.innerHTML = '';
    let res = currentTasting.whiskies.map((w, i) => {
        let scores = currentTasting.participants.map(p => parseFloat(currentTasting.ratings[p]?.[i]?.overall || 0)).filter(s => s > 0);
        return { name: w.name, avg: scores.length ? (scores.reduce((a,b)=>a+b)/scores.length).toFixed(2) : 0 };
    }).sort((a,b)=>b.avg - a.avg);
    res.forEach(r => container.innerHTML += `<div class="result-card"><h3>${r.name}</h3><div class="score-badge">${r.avg}</div></div>`);
    navigateTo('view-results');
}

function exitToDashboard() { currentTasting = { id: null, name: '', date: '', participants: [], whiskies: [], ratings: {} }; loadDashboard(); navigateTo('view-dashboard'); }