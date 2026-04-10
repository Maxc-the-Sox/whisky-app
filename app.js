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
            whiskyRow += `<th onclick="openWhiskyModal(${c.idx})" class="whisky-header">
                <strong>${title}</strong><br><span style="font-size:11px; color:#aaa;">✏️ Bearbeiten</span>
            </th>`;
        });
        flightRow += `<th colspan="${span}" class="flight-header">Flight ${currentFlight}</th>`;
    }

    flightRow += `<th rowspan="2" style="background:#111;"><button class="add-whisky-btn" onclick="openWhiskyModal(null)">+ Whisky</button></th></tr>`;
    whiskyRow += `</tr>`;

    let html = `<thead>${flightRow}${whiskyRow}</thead><tbody>`;

    currentTasting.participants.forEach(pName => {
        html += `<tr><td style="background:#222; position:sticky; left:0; z-index:2;">${pName}</td>`;
        cols.forEach(c => {
            let r = currentTasting.ratings[pName]?.[c.idx];
            let overallValue = r && r.overall ? r.overall : '';
            html += `<td>
                <div style="display:flex; align-items:center; justify-content:center;">
                    <input type="number" step="0.1" class="inline-input" placeholder="-" value="${overallValue}" 
                           onchange="updateInlineRating('${pName}', ${c.idx}, this.value)">
                    <span class="edit-icon" onclick="openRatingModal('${pName}', ${c.idx})">📝</span>
                </div>
            </td>`;
        });
        html += `<td></td></tr>`;
    });
    
    html += `</tbody>`;
    table.innerHTML = html;
}

function updateInlineRating(participant, whiskyIndex, value) {
    if(!currentTasting.ratings[participant]) currentTasting.ratings[participant] = {};
    if(!currentTasting.ratings[participant][whiskyIndex]) {
        currentTasting.ratings[participant][whiskyIndex] = { nose: '', taste: '', finish: '', overall: '' };
    }
    currentTasting.ratings[participant][whiskyIndex].overall = value;
    saveTasting(); 
}

// --- MODALS STEUERN ---
function closeModal(id) { document.getElementById(id).style.display = "none"; }

function openWhiskyModal(index) {
    editingWhiskyIndex = index;
    if(index !== null) {
        let w = currentTasting.whiskies[index];
        document.getElementById('modal-whisky-title').innerText = "Whisky bearbeiten";
        ['name', 'distillery', 'type', 'country', 'age', 'abv', 'flight'].forEach(key => {
            document.getElementById('w-'+key).value = w[key] || '';
        });
    } else {
        document.getElementById('modal-whisky-title').innerText = "Neuer Whisky";
        ['w-name', 'w-distillery', 'w-type', 'w-country', 'w-age', 'w-abv'].forEach(id => document.getElementById(id).value = '');
        let highestFlight = 1;
        if(currentTasting.whiskies.length > 0) highestFlight = Math.max(...currentTasting.whiskies.map(w => parseInt(w.flight) || 1));
        document.getElementById('w-flight').value = highestFlight;
    }
    document.getElementById('modal-whisky').style.display = "block";
}

function saveWhiskyFromModal() {
    let wName = document.getElementById('w-name').value;
    if(!wName) return alert("Name fehlt!");

    let wData = {
        name: wName, distillery: document.getElementById('w-distillery').value,
        type: document.getElementById('w-type').value, country: document.getElementById('w-country').value,
        age: document.getElementById('w-age').value, abv: document.getElementById('w-abv').value,
        flight: document.getElementById('w-flight').value || 1
    };

    if(editingWhiskyIndex !== null) currentTasting.whiskies[editingWhiskyIndex] = wData;
    else { currentTasting.whiskies.push(wData); saveToMasterDB(wData); }

    closeModal('modal-whisky');
    saveTasting();
    renderGrid();
}

function openRatingModal(participantName, whiskyIndex) {
    currentRatingContext = { participant: participantName, whiskyIndex: whiskyIndex };
    let whisky = currentTasting.whiskies[whiskyIndex];
    let rating = currentTasting.ratings[participantName]?.[whiskyIndex] || { nose: '', taste: '', finish: '', overall: '' };

    document.getElementById('modal-rating-subtitle').innerText = `${participantName} bewertet: ${whisky.name}`;
    ['nose', 'taste', 'finish', 'overall'].forEach(key => document.getElementById('r-'+key).value = rating[key]);
    document.getElementById('modal-rating').style.display = "block";
}

function saveRatingFromModal() {
    let p = currentRatingContext.participant;
    let wIdx = currentRatingContext.whiskyIndex;
    if(!currentTasting.ratings[p]) currentTasting.ratings[p] = {};

    currentTasting.ratings[p][wIdx] = {
        nose: document.getElementById('r-nose').value, taste: document.getElementById('r-taste').value,
        finish: document.getElementById('r-finish').value, overall: document.getElementById('r-overall').value
    };

    closeModal('modal-rating');
    saveTasting();
    renderGrid();
}

// --- DATENBANK & SPEICHERN ---
function saveToMasterDB(wData) {
    let db = JSON.parse(localStorage.getItem('whiskyDB')) || [];
    if(!db.find(w => w.name === wData.name)) { db.push(wData); localStorage.setItem('whiskyDB', JSON.stringify(db)); }
}

function autoFillWhisky(input) {
    let db = JSON.parse(localStorage.getItem('whiskyDB')) || [];
    let known = db.find(w => w.name === input.value);
    if (known) {
        ['distillery', 'type', 'country', 'age', 'abv'].forEach(key => {
            document.getElementById('w-'+key).value = known[key] || '';
        });
    }
}

function updateDatalists() {
    let db = JSON.parse(localStorage.getItem('whiskyDB')) || [];
    document.getElementById('known-whiskies').innerHTML = db.map(w => `<option value="${w.name}"></option>`).join('');
    let dists = [...new Set(db.map(w => w.distillery).filter(Boolean))];
    document.getElementById('known-distilleries').innerHTML = dists.map(d => `<option value="${d}"></option>`).join('');
}

function saveTasting() {
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    let existingIndex = tastings.findIndex(t => t.id === currentTasting.id);
    if(existingIndex >= 0) tastings[existingIndex] = currentTasting;
    else tastings.push(currentTasting);
    localStorage.setItem('whiskyTastings', JSON.stringify(tastings));
}

// --- DASHBOARD ---
function calculateWinnerForDashboard(tasting) {
    if (!tasting.whiskies || tasting.whiskies.length === 0 || !tasting.ratings) return null;
    let bestWhisky = null; let highestAvg = -1;

    tasting.whiskies.forEach((w, index) => {
        let total = 0; let count = 0;
        if(tasting.participants) {
            tasting.participants.forEach(p => {
                let r = tasting.ratings[p]?.[index];
                if(r && r.overall && !isNaN(parseFloat(r.overall))) { total += parseFloat(r.overall); count++; }
            });
        }
        let avg = count > 0 ? (total / count) : 0;
        if (avg > highestAvg && avg > 0) { highestAvg = avg; bestWhisky = w; }
    });
    return { whisky: bestWhisky, score: highestAvg };
}

function loadDashboard() {
    const container = document.getElementById('tasting-list-container');
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    
    if(tastings.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#666;'>Noch keine Tastings gespeichert.</p>";
        return;
    }

    tastings.sort((a, b) => new Date(b.date) - new Date(a.date));
    let groupedByYear = {};
    tastings.forEach(t => {
        let year = t.date ? t.date.split('-')[0] : 'Unbekannt';
        if(!groupedByYear[year]) groupedByYear[year] = [];
        groupedByYear[year].push(t);
    });

    let html = '';
    let years = Object.keys(groupedByYear).sort((a, b) => b - a);
    
    years.forEach((year, index) => {
        let openAttr = index === 0 ? "open" : "";
        html += `<details class="year-details" ${openAttr}><summary class="year-summary">${year} (${groupedByYear[year].length})</summary>
            <ul style="list-style: none; padding: 0; margin-top: 15px;">`;
        
        groupedByYear[year].forEach(t => {
            let pCount = t.participants ? t.participants.length : (t.peopleCount || 0);
            let wCount = t.whiskies ? t.whiskies.length : 0;
            
            let winnerHtml = "";
            let winnerData = calculateWinnerForDashboard(t);
            if (winnerData && winnerData.whisky) {
                let w = winnerData.whisky;
                let wString = w.name;
                if(w.age) wString += ` (${w.age}J)`;
                if(w.distillery) wString += ` - ${w.distillery}`;
                winnerHtml = `<div style="margin-top: 8px; color:#f1c40f; font-size:14px; background:#222; padding:5px; border-radius:5px;">🏆 Sieger: ${wString} <br><span style="color:#aaa; font-size:12px;">Ø ${winnerData.score.toFixed(2)} Punkte</span></div>`;
            }

            // NEU: Excel Export Button in der Button-Leiste hinzugefügt
            html += `
            <li class="tasting-item">
                <strong>${t.name}</strong> <br>
                <span style="color:#bdc3c7; font-size:14px;">📅 ${t.date} | 👥 ${pCount} Personen | 🥃 ${wCount} Whiskys</span>
                ${winnerHtml}
                <div style="display: flex; gap: 8px; margin-top: 15px; flex-wrap: wrap;">
                    <button class="btn-secondary" style="margin-top: 0; padding: 8px; font-size: 14px; flex: 1; min-width: 80px;" onclick="resumeTasting('${t.id}')">✏️ Ansehen</button>
                    <button class="btn-secondary" style="margin-top: 0; padding: 8px; font-size: 14px; flex: 1; min-width: 80px; border-color: #27ae60; color: #27ae60;" onclick="exportTastingToCSV('${t.id}')">📊 Excel</button>
                    <button class="btn-secondary" style="margin-top: 0; padding: 8px; font-size: 14px; flex: 1; min-width: 80px; border-color: #e74c3c; color: #e74c3c;" onclick="deleteSingleTasting('${t.id}')">🗑️ Löschen</button>
                </div>
            </li>`;
        });
        html += `</ul></details>`;
    });
    container.innerHTML = html;
}

function resumeTasting(tastingId) {
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    let found = tastings.find(t => t.id === tastingId);
    if(found) {
        currentTasting = found; 
        if(!currentTasting.participants) currentTasting.participants = [];
        if(!currentTasting.whiskies) currentTasting.whiskies = [];
        if(!currentTasting.ratings) currentTasting.ratings = {};
        
        document.getElementById('grid-title').innerText = currentTasting.name;
        updateDatalists();
        renderGrid();
        navigateTo('view-grid');
    }
}

function deleteSingleTasting(tastingId) {
    if(confirm("Möchtest du dieses Tasting wirklich endgültig löschen?")) {
        let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
        tastings = tastings.filter(t => t.id !== tastingId);
        localStorage.setItem('whiskyTastings', JSON.stringify(tastings));
        loadDashboard(); 
    }
}

// --- NEU: EXCEL/CSV EXPORT ---
function exportTastingToCSV(tastingId) {
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    let t = tastings.find(x => x.id === tastingId);
    if(!t) return;

    // BOM für Excel (damit Umlaute richtig gelesen werden)
    let csv = "\uFEFF"; 
    csv += `Tasting:;${t.name}\nDatum:;${t.date}\nTeilnehmer:;${(t.participants || []).length}\n\n`;

    // Tabellenkopf
    let pNames = (t.participants || []).join(";");
    csv += `Flight;Whisky;Destille;Art;Land;Alter;Alk. %;${pNames};Durchschnitt\n`;

    // Zeilen (Whiskys)
    (t.whiskies || []).forEach((w, index) => {
        let total = 0, count = 0;
        let pScores = (t.participants || []).map(p => {
            let r = t.ratings[p]?.[index];
            if(r && r.overall && !isNaN(parseFloat(r.overall))) {
                total += parseFloat(r.overall);
                count++;
                // Komma statt Punkt für deutsches Excel
                return parseFloat(r.overall).toFixed(1).replace('.', ','); 
            }
            return "-";
        });
        
        let avg = count > 0 ? (total / count).toFixed(2).replace('.', ',') : "0,00";
        let abv = (w.abv || '').toString().replace('.', ',');

        csv += `${w.flight || 1};${w.name};${w.distillery || ''};${w.type || ''};${w.country || ''};${w.age || ''};${abv};${pScores.join(";")};${avg}\n`;
    });

    // Download anstoßen
    let blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    let url = URL.createObjectURL(blob);
    let link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `DramScore_${t.name.replace(/[^a-z0-9äöüß]/gi, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- AUSWERTUNG ---
function finishAndShowResults() {
    saveTasting();
    if(currentTasting.whiskies.length === 0) { alert("Keine Whiskys vorhanden!"); return exitToDashboard(); }

    document.getElementById('results-title').innerText = currentTasting.name;
    const container = document.getElementById('podium-container');
    container.innerHTML = '';

    let results = currentTasting.whiskies.map((w, index) => {
        let total = 0; let count = 0;
        currentTasting.participants.forEach(p => {
            let r = currentTasting.ratings[p]?.[index];
            if(r && r.overall && !isNaN(parseFloat(r.overall))) { total += parseFloat(r.overall); count++; }
        });
        let avg = count > 0 ? (total / count).toFixed(2) : 0;
        return { whisky: w, avg: parseFloat(avg) };
    });

    results.sort((a, b) => b.avg - a.avg);

    results.forEach((res, i) => {
        let rankClass = ""; let medal = `${i+1}. Platz`;
        if(i === 0 && res.avg > 0) { rankClass = "winner"; medal = "🏆 Platz 1 (Sieger)"; }
        else if(i === results.length - 1 && res.avg > 0 && results.length > 1) { rankClass = "loser"; medal = "📉 Letzter Platz"; }

        container.innerHTML += `
            <div class="result-card ${rankClass}">
                <div style="color: var(--secondary-text); font-size: 14px;">${medal}</div>
                <h3>${res.whisky.name} ${res.whisky.age ? `(${res.whisky.age}J)` : ''}</h3>
                <div style="font-size: 14px;">${res.whisky.distillery || ''} | ${res.whisky.country || ''}</div>
                <div class="score-badge">Ø ${res.avg.toFixed(2)} Punkte</div>
            </div>
        `;
    });
    navigateTo('view-results');
}

function exitToDashboard() {
    currentTasting = { id: null, name: '', date: '', participants: [], whiskies: [], ratings: {} };
    loadDashboard();
    navigateTo('view-dashboard');
}

// --- EINSTELLUNGEN & BACKUP ---
function clearTastings() {
    if(confirm("Bist du sicher? Alle Tastings werden gelöscht!")) {
        localStorage.removeItem('whiskyTastings');
        alert("Alle Tastings gelöscht.");
        loadDashboard();
    }
}

function clearMasterDB() {
    if(confirm("Bist du sicher? Die Whisky- und Teilnehmer-Datenbank wird geleert!")) {
        localStorage.removeItem('whiskyDB');
        localStorage.removeItem('participantDB');
        alert("Master-Datenbank geleert.");
    }
}

function exportDatabase() {
    let data = {
        tastings: JSON.parse(localStorage.getItem('whiskyTastings')) || [],
        whiskies: JSON.parse(localStorage.getItem('whiskyDB')) || [],
        participants: JSON.parse(localStorage.getItem('participantDB')) || []
    };
    let json = JSON.stringify(data, null, 2);
    let blob = new Blob([json], { type: "application/json" });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `DramScore_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function importDatabase(event) {
    let file = event.target.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function(e) {
        try {
            let data = JSON.parse(e.target.result);
            if (data.tastings || data.whiskies) {
                if(confirm("Backup laden? Deine aktuellen Daten auf DIESEM Gerät werden überschrieben!")) {
                    if(data.tastings) localStorage.setItem('whiskyTastings', JSON.stringify(data.tastings));
                    if(data.whiskies) localStorage.setItem('whiskyDB', JSON.stringify(data.whiskies));
                    if(data.participants) localStorage.setItem('participantDB', JSON.stringify(data.participants));
                    alert("Datenbank erfolgreich geladen!");
                    loadDashboard();
                }
            } else { alert("Kein gültiges DramScore-Backup."); }
        } catch(err) { alert("Fehler beim Lesen der Datei."); }
    };
    reader.readAsText(file);
    event.target.value = ''; 
}