// ==========================================
// FIREBASE SETUP & CLOUD SYNC
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCAn1PDTbgIhdGMnCCuP0DBqGQ1wAf1FQ0",
  authDomain: "dramscore-8328d.firebaseapp.com",
  databaseURL: "https://dramscore-8328d-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "dramscore-8328d",
  storageBucket: "dramscore-8328d.firebasestorage.app",
  messagingSenderId: "1093541141102",
  appId: "1:1093541141102:web:3c09236f1e57478574647f"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

window.onload = function() {
    database.ref('dramscore_db').once('value').then((snapshot) => {
        if (!snapshot.exists()) {
            syncToCloud();
        }
    });

    database.ref('dramscore_db').on('value', (snapshot) => {
        if(snapshot.exists()) {
            const data = snapshot.val();
            if(data.tastings) localStorage.setItem('whiskyTastings', data.tastings);
            if(data.whiskies) localStorage.setItem('whiskyDB', data.whiskies);
            if(data.participants) localStorage.setItem('participantDB', data.participants);
            
            if(document.getElementById('view-dashboard').style.display !== 'none') {
                loadDashboard();
            }
            updateParticipantDatalist();
        }
    });

    document.getElementById('setup-date').valueAsDate = new Date();
};

function syncToCloud() {
    database.ref('dramscore_db').set({
        tastings: localStorage.getItem('whiskyTastings') || "[]",
        whiskies: localStorage.getItem('whiskyDB') || "[]",
        participants: localStorage.getItem('participantDB') || "[]"
    });
}

// ==========================================
// APP LOGIK
// ==========================================

let currentTasting = { id: null, number: '', name: '', date: '', participants: [], whiskies: [], ratings: {} };
let editingWhiskyIndex = null;
let currentRatingContext = { participant: null, whiskyIndex: null };

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
        if(!pDB.includes(name)) { 
            pDB.push(name); 
            localStorage.setItem('participantDB', JSON.stringify(pDB)); 
            syncToCloud(); 
        }
        updateParticipantList(); updateParticipantDatalist(); input.value = '';
    }
}

function addLiveParticipant() {
    const input = document.getElementById('live-participant-name');
    const name = input.value.trim();
    if(name && !currentTasting.participants.includes(name)) {
        currentTasting.participants.push(name);
        let pDB = JSON.parse(localStorage.getItem('participantDB')) || [];
        if(!pDB.includes(name)) { 
            pDB.push(name); 
            localStorage.setItem('participantDB', JSON.stringify(pDB)); 
            syncToCloud(); 
        }
        updateParticipantDatalist();
        input.value = '';
        closeModal('modal-participant');
        renderGrid();
    }
}

function removeLiveParticipant(name) {
    if(confirm(`${name} entfernen?`)) {
        currentTasting.participants = currentTasting.participants.filter(p => p !== name);
        if(currentTasting.ratings[name]) delete currentTasting.ratings[name];
        renderGrid();
    }
}

function removeWhisky(idx) {
    let wName = currentTasting.whiskies[idx].name;
    if(confirm(`${wName} wirklich löschen? Alle Wertungen dafür gehen verloren.`)) {
        currentTasting.whiskies.splice(idx, 1);
        for(let p in currentTasting.ratings) {
            let newRatings = {};
            for(let rIdx in currentTasting.ratings[p]) {
                let ri = parseInt(rIdx);
                if(ri < idx) newRatings[ri] = currentTasting.ratings[p][ri];
                if(ri > idx) newRatings[ri-1] = currentTasting.ratings[p][ri];
            }
            currentTasting.ratings[p] = newRatings;
        }
        renderGrid();
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

// --- LIVE GRID ---
function startTastingGrid() {
    currentTasting.number = document.getElementById('setup-number').value || '';
    currentTasting.name = document.getElementById('setup-name').value || 'Unbenanntes Tasting';
    currentTasting.date = document.getElementById('setup-date').value;
    
    if(!currentTasting.id) currentTasting.id = 't_' + Date.now();
    if(currentTasting.participants.length === 0) return alert("Bitte füge mindestens einen Teilnehmer hinzu!");
    
    document.getElementById('grid-edit-number').value = currentTasting.number;
    document.getElementById('grid-edit-name').value = currentTasting.name;
    document.getElementById('grid-edit-date').value = currentTasting.date;
    
    updateDatalists();
    renderGrid();
    navigateTo('view-grid');
}

function updateTastingHeader() {
    currentTasting.number = document.getElementById('grid-edit-number').value;
    currentTasting.name = document.getElementById('grid-edit-name').value;
    currentTasting.date = document.getElementById('grid-edit-date').value;
}

function renderGrid() {
    const table = document.getElementById('tasting-table');
    let cols = currentTasting.whiskies.map((w, i) => ({ w: w, idx: i, f: parseInt(w.flight) || 1 }));
    cols.sort((a, b) => a.f - b.f);

    let flightRow = `<tr><th rowspan="2" style="background:#111; color:#3498db; font-size:12px;" onclick="document.getElementById('modal-participant').style.display='block'">➕ Person</th>`;
    let whiskyRow = `<tr>`;

    if (cols.length > 0) {
        let currentFlight = cols[0].f;
        let span = 0;
        cols.forEach((c) => {
            if (c.f !== currentFlight) {
                flightRow += `<th colspan="${span}" class="flight-header">Flight ${currentFlight}</th>`;
                currentFlight = c.f; span = 1;
            } else { span++; }
            
            // ÄNDERUNG: Hier wird geprüft, ob es NA/NAS ist oder eine Zahl
            let ageStr = c.w.age ? (isNaN(c.w.age) ? ` (${c.w.age})` : ` (${c.w.age}J)`) : '';
            let title = c.w.name + ageStr;
            let caskInfo = c.w.cask ? `<br><span style="font-size:12px; color:#aaa; font-style:italic; font-weight:normal;">${c.w.cask}</span>` : "";
            
            whiskyRow += `<th class="whisky-header">
                <div onclick="openWhiskyModal(${c.idx})"><strong>${title}</strong>${caskInfo}<br><span style="font-size:11px; color:#aaa;">✏️</span></div>
                <div onclick="removeWhisky(${c.idx})" style="margin-top:8px; color:#e74c3c; font-size:14px;">🗑️</div>
            </th>`;
        });
        flightRow += `<th colspan="${span}" class="flight-header">Flight ${currentFlight}</th>`;
    }
    flightRow += `<th rowspan="2" style="background:#111;"><button class="add-whisky-btn" onclick="openWhiskyModal(null)">+🥃</button></th></tr>`;
    whiskyRow += `</tr>`;

    let html = `<thead>${flightRow}${whiskyRow}</thead><tbody>`;
    currentTasting.participants.forEach(pName => {
        html += `<tr><td style="background:#222; position:sticky; left:0; z-index:2;" onclick="removeLiveParticipant('${pName}')">${pName} <span style="font-size:10px; color:#666;">🗑️</span></td>`;
        cols.forEach(c => {
            let r = currentTasting.ratings[pName]?.[c.idx];
            let val = r && r.overall ? r.overall : '';
            html += `<td><div style="display:flex; align-items:center; justify-content:center;">
                <input type="number" step="0.1" class="inline-input" placeholder="-" value="${val}" onchange="updateInlineRating('${pName}', ${c.idx}, this.value)">
                <span class="edit-icon" onclick="openRatingModal('${pName}', ${c.idx})">📝</span>
            </div></td>`;
        });
        html += `<td></td></tr>`;
    });
    table.innerHTML = html + `</tbody>`;
}

function updateInlineRating(p, idx, val) {
    if(!currentTasting.ratings[p]) currentTasting.ratings[p] = {};
    if(!currentTasting.ratings[p][idx]) currentTasting.ratings[p][idx] = { nose: '', taste: '', finish: '', overall: '' };
    currentTasting.ratings[p][idx].overall = val;
}

function closeModal(id) { document.getElementById(id).style.display = "none"; }

function openWhiskyModal(index) {
    editingWhiskyIndex = index;
    if(index !== null) {
        let w = currentTasting.whiskies[index];
        ['name', 'distillery', 'cask', 'type', 'country', 'age', 'abv', 'flight'].forEach(key => {
            if(document.getElementById('w-'+key)) document.getElementById('w-'+key).value = w[key] || '';
        });
    } else {
        ['w-name', 'w-distillery', 'w-cask', 'w-type', 'w-country', 'w-age', 'w-abv'].forEach(id => document.getElementById(id).value = '');
        let high = currentTasting.whiskies.length > 0 ? Math.max(...currentTasting.whiskies.map(w => parseInt(w.flight) || 1)) : 1;
        document.getElementById('w-flight').value = high;
    }
    document.getElementById('modal-whisky').style.display = "block";
}

function saveWhiskyFromModal() {
    let wName = document.getElementById('w-name').value;
    if(!wName) return alert("Name fehlt!");
    let wData = {
        name: wName, 
        distillery: document.getElementById('w-distillery').value,
        cask: document.getElementById('w-cask').value,
        type: document.getElementById('w-type').value, 
        country: document.getElementById('w-country').value,
        age: document.getElementById('w-age').value, 
        abv: document.getElementById('w-abv').value,
        flight: document.getElementById('w-flight').value || 1
    };
    if(editingWhiskyIndex !== null) currentTasting.whiskies[editingWhiskyIndex] = wData;
    else { 
        currentTasting.whiskies.push(wData); 
        saveToMasterDB(wData); 
    }
    closeModal('modal-whisky');
    renderGrid();
}

function openRatingModal(p, idx) {
    currentRatingContext = { participant: p, whiskyIndex: idx };
    let r = currentTasting.ratings[p]?.[idx] || { nose: '', taste: '', finish: '', overall: '' };
    document.getElementById('modal-rating-subtitle').innerText = `${p} bewertet: ${currentTasting.whiskies[idx].name}`;
    ['nose', 'taste', 'finish', 'overall'].forEach(key => document.getElementById('r-'+key).value = r[key]);
    document.getElementById('modal-rating').style.display = "block";
}

function saveRatingFromModal() {
    let p = currentRatingContext.participant; let idx = currentRatingContext.whiskyIndex;
    if(!currentTasting.ratings[p]) currentTasting.ratings[p] = {};
    currentTasting.ratings[p][idx] = {
        nose: document.getElementById('r-nose').value, taste: document.getElementById('r-taste').value,
        finish: document.getElementById('r-finish').value, overall: document.getElementById('r-overall').value
    };
    closeModal('modal-rating');
    renderGrid();
}

function saveTasting() {
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    let idx = tastings.findIndex(t => t.id === currentTasting.id);
    if(idx >= 0) tastings[idx] = currentTasting; else tastings.push(currentTasting);
    localStorage.setItem('whiskyTastings', JSON.stringify(tastings));
    syncToCloud(); 
}

function calculateWinnerForDashboard(t) {
    if (!t.whiskies || t.whiskies.length === 0 || !t.ratings) return null;
    let best = null; let highAvg = -1;
    t.whiskies.forEach((w, i) => {
        let tot = 0, count = 0;
        if(t.participants) {
            t.participants.forEach(p => {
                let r = t.ratings[p]?.[i];
                if(r && r.overall && !isNaN(parseFloat(r.overall))) { tot += parseFloat(r.overall); count++; }
            });
        }
        let avg = count > 0 ? (tot / count) : 0;
        if (avg > highAvg && avg > 0) { highAvg = avg; best = w; }
    });
    return { whisky: best, score: highAvg };
}

function loadDashboard() {
    const container = document.getElementById('tasting-list-container');
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    if(tastings.length === 0) return container.innerHTML = "<p style='text-align:center;'>Noch keine Tastings.</p>";
    tastings.sort((a, b) => new Date(b.date) - new Date(a.date));
    let html = '';
    let years = [...new Set(tastings.map(t => t.date.split('-')[0]))].sort((a, b) => b - a);
    years.forEach((y, i) => {
        let openAttr = i === 0 ? "open" : "";
        html += `<details class="year-details" ${openAttr}><summary class="year-summary">${y} (${tastings.filter(t=>t.date.startsWith(y)).length})</summary><ul style="list-style:none; padding:0; margin-top:15px;">`;
        tastings.filter(t => t.date.startsWith(y)).forEach(t => {
            let winData = calculateWinnerForDashboard(t);
            
            let caskDashInfo = (winData && winData.whisky && winData.whisky.cask) ? `<br><span style="font-size:12px; color:#aaa; font-style:italic;">${winData.whisky.cask}</span>` : "";
            let winH = (winData && winData.whisky) ? `<div style="margin-top: 8px; color:#f1c40f; font-size:14px; background:#222; padding:5px; border-radius:5px;">🏆 Sieger: ${winData.whisky.name} ${caskDashInfo}<br><span style="color:#aaa; font-size:12px;">Ø ${winData.score.toFixed(2)} Punkte</span></div>` : "";
            
            let numDisplay = t.number ? `<span style="color:var(--accent-color);">#${t.number}</span> ` : "";
            
            html += `<li class="tasting-item">
                <strong>${numDisplay}${t.name}</strong> <br>
                <span style="color:#bdc3c7; font-size:14px;">📅 ${t.date} | 👥 ${t.participants.length} | 🥃 ${t.whiskies.length}</span>
                ${winH}
                <div style="display: flex; gap: 8px; margin-top: 15px; flex-wrap: wrap;">
                    <button class="btn-secondary" style="margin-top: 0; padding: 8px; font-size: 14px; flex: 1; min-width: 80px; border-color: #f1c40f; color: #f1c40f;" onclick="showTastingResults('${t.id}')">🏆 Wertung</button>
                    <button class="btn-secondary" style="margin-top: 0; padding: 8px; font-size: 14px; flex: 1; min-width: 80px; border-color: #27ae60; color: #27ae60;" onclick="exportTastingToCSV('${t.id}')">📊 Excel</button>
                    <button class="btn-secondary" style="margin-top: 0; padding: 8px; font-size: 14px; flex: 1; min-width: 80px;" onclick="resumeTasting('${t.id}')">✏️ Bearbeiten</button>
                    <button class="btn-secondary" style="margin-top: 0; padding: 8px; font-size: 14px; flex: 1; min-width: 80px; border-color: #e74c3c; color: #e74c3c;" onclick="deleteSingleTasting('${t.id}')">🗑️ Löschen</button>
                </div></li>`;
        });
        html += `</ul></details>`;
    });
    container.innerHTML = html;
}

function resumeTasting(id) {
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    currentTasting = JSON.parse(JSON.stringify(tastings.find(t => t.id === id))); 
    
    document.getElementById('grid-edit-number').value = currentTasting.number || '';
    document.getElementById('grid-edit-name').value = currentTasting.name || '';
    document.getElementById('grid-edit-date').value = currentTasting.date || '';
    
    renderGrid(); navigateTo('view-grid');
}

function showTastingResults(id) {
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    currentTasting = JSON.parse(JSON.stringify(tastings.find(t => t.id === id))); 
    
    const container = document.getElementById('podium-container');
    container.innerHTML = '';
    
    let numDisplay = currentTasting.number ? `#${currentTasting.number} ` : "";
    document.getElementById('results-title').innerText = numDisplay + currentTasting.name;

    let res = currentTasting.whiskies.map((w, index) => {
        let tot = 0, count = 0;
        currentTasting.participants.forEach(p => {
            let r = currentTasting.ratings[p]?.[index];
            if(r && r.overall && !isNaN(parseFloat(r.overall))) { tot += parseFloat(r.overall); count++; }
        });
        let avg = count > 0 ? (tot/count).toFixed(2) : 0;
        return { name: w.name, age: w.age, cask: w.cask, avg: parseFloat(avg) };
    }).sort((a,b)=>b.avg - a.avg);

    res.forEach((r, i) => {
        let rankClass = (i === 0 && r.avg > 0) ? "winner" : (i === res.length-1 && res.length > 1) ? "loser" : "";
        let caskHtml = r.cask ? `<div style="font-size:13px; color:#aaa; font-style:italic; margin-top:-5px; margin-bottom:8px;">${r.cask}</div>` : '';
        
        // ÄNDERUNG: NA Logik in den Resultaten
        let ageStr = r.age ? (isNaN(r.age) ? ` (${r.age})` : ` (${r.age}J)`) : '';
        
        container.innerHTML += `<div class="result-card ${rankClass}">
            <div style="color:var(--secondary-text); font-size:14px;">${i+1}. Platz</div>
            <h3>${r.name}${ageStr}</h3>
            ${caskHtml}
            <div class="score-badge">Ø ${r.avg.toFixed(2)} Punkte</div>
        </div>`;
    });
    
    navigateTo('view-results');
}

function finishAndShowResults() {
    saveTasting();
    showTastingResults(currentTasting.id);
}

function exitToDashboard() {
    currentTasting = { id: null, number: '', name: '', date: '', participants: [], whiskies: [], ratings: {} };
    loadDashboard(); navigateTo('view-dashboard');
}

function saveToMasterDB(w) {
    let db = JSON.parse(localStorage.getItem('whiskyDB')) || [];
    if(!db.find(x => x.name === w.name)) { 
        db.push(w); 
        localStorage.setItem('whiskyDB', JSON.stringify(db)); 
        syncToCloud(); 
    }
}

function autoFillWhisky(i) {
    let db = JSON.parse(localStorage.getItem('whiskyDB')) || [];
    let w = db.find(x => x.name === i.value);
    if(w) {
        ['distillery', 'cask', 'type', 'country', 'age', 'abv'].forEach(k => {
            if(document.getElementById('w-'+k)) document.getElementById('w-'+k).value = w[k] || '';
        });
    }
}

function updateDatalists() {
    let db = JSON.parse(localStorage.getItem('whiskyDB')) || [];
    document.getElementById('known-whiskies').innerHTML = db.map(w => `<option value="${w.name}"></option>`).join('');
    let dists = [...new Set(db.map(w => w.distillery).filter(Boolean))];
    document.getElementById('known-distilleries').innerHTML = dists.map(d => `<option value="${d}"></option>`).join('');
}

function exportTastingToCSV(id) {
    let t = JSON.parse(localStorage.getItem('whiskyTastings')).find(x => x.id === id);
    let csv = "\uFEFFFlight;Whisky;Fass;Durchschnitt\n";
    t.whiskies.forEach((w, i) => {
        let tot=0, c=0;
        t.participants.forEach(p => { let r=t.ratings[p]?.[i]; if(r&&r.overall){tot+=parseFloat(r.overall); c++;}});
        let avg = c>0 ? (tot/c).toFixed(2) : "0,00";
        csv += `${w.flight || 1};${w.name};${w.cask || ''};${avg.replace('.', ',')}\n`;
    });
    let a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    a.download = `DramScore_${t.name}.csv`; a.click();
}

function deleteSingleTasting(id) {
    if(confirm("Tasting wirklich löschen?")) {
        let t = JSON.parse(localStorage.getItem('whiskyTastings')).filter(x => x.id !== id);
        localStorage.setItem('whiskyTastings', JSON.stringify(t)); 
        syncToCloud(); loadDashboard();
    }
}

function exportDatabase() {
    let data = { tastings: JSON.parse(localStorage.getItem('whiskyTastings')), whiskies: JSON.parse(localStorage.getItem('whiskyDB')), participants: JSON.parse(localStorage.getItem('participantDB')) };
    let a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:"application/json"}));
    a.download = `DramScore_Backup.json`; a.click();
}

function importDatabase(event) {
    let reader = new FileReader();
    reader.onload = function(e) {
        let d = JSON.parse(e.target.result);
        localStorage.setItem('whiskyTastings', JSON.stringify(d.tastings || []));
        localStorage.setItem('whiskyDB', JSON.stringify(d.whiskies || []));
        localStorage.setItem('participantDB', JSON.stringify(d.participants || []));
        syncToCloud(); location.reload();
    };
    reader.readAsText(event.target.files[0]);
}

function exportAllTastingsToCSV() {
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    if(tastings.length === 0) return alert("Keine Tastings vorhanden!");
    
    let csv = "\uFEFFNr.;Tasting;Datum;Flight;Whisky;Fass;Destille;Art;Land;Alter;Alk. %;Durchschnitt\n";
    
    tastings.forEach(t => {
        if(!t.whiskies) return;
        t.whiskies.forEach((w, i) => {
            let tot = 0, c = 0;
            if(t.participants) {
                t.participants.forEach(p => { 
                    let r = t.ratings[p]?.[i]; 
                    if(r && r.overall && !isNaN(parseFloat(r.overall))) { tot += parseFloat(r.overall); c++; }
                });
            }
            let avg = c > 0 ? (tot/c).toFixed(2) : "0,00";
            let abv = (w.abv || '').toString().replace('.', ',');
            csv += `${t.number || ''};${t.name};${t.date};${w.flight || 1};${w.name};${w.cask || ''};${w.distillery || ''};${w.type || ''};${w.country || ''};${w.age || ''};${abv};${avg.replace('.', ',')}\n`;
        });
    });
    
    let a = document.createElement("a"); 
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
    a.download = `DramScore_Alle_Tastings.csv`; a.click();
}

// ==========================================
// HALL OF FAME / STATISTIKEN
// ==========================================

function loadStats() {
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    let globalWhiskys = {};
    let allParticipants = new Set();
    
    tastings.forEach(t => {
        if(t.participants) t.participants.forEach(p => allParticipants.add(p));
        if(t.whiskies) {
            t.whiskies.forEach((w, i) => {
                let key = w.name + (w.distillery ? `_${w.distillery}` : '');
                if(!globalWhiskys[key]) globalWhiskys[key] = { name: w.name, dist: w.distillery, age: w.age, cask: w.cask, tot: 0, count: 0 };
                if(t.participants) {
                    t.participants.forEach(p => {
                        let r = t.ratings && t.ratings[p] ? t.ratings[p][i] : null;
                        if(r && r.overall && !isNaN(parseFloat(r.overall))) {
                            globalWhiskys[key].tot += parseFloat(r.overall);
                            globalWhiskys[key].count++;
                        }
                    });
                }
            });
        }
    });
    
    let globalArr = Object.values(globalWhiskys).filter(w => w.count > 0).map(w => {
        w.avg = w.tot / w.count;
        return w;
    });
    
    let globalTop10 = [...globalArr].sort((a,b) => b.avg - a.avg).slice(0, 10);
    let globalFlop10 = [...globalArr].sort((a,b) => a.avg - b.avg).slice(0, 10);
    
    let gHtml = '';
    globalTop10.forEach((w, idx) => {
        let borderCol = idx === 0 ? '#f1c40f' : (idx === 1 ? '#bdc3c7' : (idx === 2 ? '#cd7f32' : '#444'));
        let caskHtml = w.cask ? `<br><span style="font-size:12px; color:#aaa; font-style:italic;">${w.cask}</span>` : '';
        // ÄNDERUNG: NA Logik in Top 10
        let ageStr = w.age ? (isNaN(w.age) ? ` (${w.age})` : ` (${w.age}J)`) : '';
        
        gHtml += `<div class="result-card" style="border-color: ${borderCol};"><div style="display:flex; justify-content:space-between; align-items:center;"><div style="text-align:left;"><strong>${w.name}${ageStr}</strong>${caskHtml}<br><span style="font-size:12px; color:#ccc;">${w.dist || '-'}</span></div><div class="score-badge" style="margin:0;">Ø ${w.avg.toFixed(2)}</div></div></div>`;
    });
    document.getElementById('global-top-container').innerHTML = gHtml || "<p style='text-align:center;'>Noch keine Daten.</p>";
    
    let fHtml = '';
    globalFlop10.forEach((w, idx) => {
        let caskHtml = w.cask ? `<br><span style="font-size:12px; color:#aaa; font-style:italic;">${w.cask}</span>` : '';
        // ÄNDERUNG: NA Logik in Flop 10
        let ageStr = w.age ? (isNaN(w.age) ? ` (${w.age})` : ` (${w.age}J)`) : '';
        
        fHtml += `<div class="result-card" style="border-color: #e74c3c; opacity: 0.9;"><div style="display:flex; justify-content:space-between; align-items:center;"><div style="text-align:left;"><strong>${w.name}${ageStr}</strong>${caskHtml}<br><span style="font-size:12px; color:#ccc;">${w.dist || '-'}</span></div><div class="score-badge" style="background:#e74c3c; margin:0;">Ø ${w.avg.toFixed(2)}</div></div></div>`;
    });
    document.getElementById('global-flop-container').innerHTML = fHtml || "<p style='text-align:center;'>Noch keine Daten.</p>";
    
    let pSelect = document.getElementById('stat-participant-select');
    pSelect.innerHTML = '<option value="">-- Teilnehmer auswählen --</option>';
    Array.from(allParticipants).sort().forEach(p => { pSelect.innerHTML += `<option value="${p}">${p}</option>`; });
}

function showParticipantStats() {
    let pName = document.getElementById('stat-participant-select').value;
    let container = document.getElementById('participant-stat-container');
    if(!pName) { container.innerHTML = ''; return; }
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    let myWhiskys = [];
    let distStats = {};
    tastings.forEach(t => {
        if(!t.participants || !t.participants.includes(pName) || !t.whiskies) return;
        t.whiskies.forEach((w, i) => {
            let r = t.ratings && t.ratings[pName] ? t.ratings[pName][i] : null;
            if(r && r.overall && !isNaN(parseFloat(r.overall))) {
                let score = parseFloat(r.overall);
                myWhiskys.push({ name: w.name, dist: w.distillery, age: w.age, cask: w.cask, score: score, tasting: t.name });
                if(w.distillery) {
                    if(!distStats[w.distillery]) distStats[w.distillery] = { tot: 0, count: 0 };
                    distStats[w.distillery].tot += score;
                    distStats[w.distillery].count++;
                }
            }
        });
    });
    if(myWhiskys.length === 0) { container.innerHTML = "<p style='text-align:center;'>Keine Daten.</p>"; return; }
    let top10 = [...myWhiskys].sort((a,b) => b.score - a.score).slice(0, 10);
    let bottom10 = [...myWhiskys].sort((a,b) => a.score - b.score).slice(0, 10);
    let bestDist = { name: '-', avg: 0 };
    Object.keys(distStats).forEach(d => {
        let avg = distStats[d].tot / distStats[d].count;
        if(avg > bestDist.avg) { bestDist = { name: d, avg: avg, count: distStats[d].count }; }
    });
    let html = `<div style="background:#222; padding:15px; border-radius:8px; margin-bottom:20px; text-align:center; border: 1px solid #444;"><div>🥃 ${myWhiskys.length} bewertet</div><div style="color:#3498db; font-weight:bold;">${bestDist.name}</div><div style="font-size:12px; color:#aaa;">Lieblings-Destille (Ø ${bestDist.avg.toFixed(2)})</div></div>`;
    
    html += `<h3 style="color:#2ecc71; text-align:center;">🏆 Top 10</h3>`;
    top10.forEach((w, idx) => {
        let borderCol = idx === 0 ? '#f1c40f' : (idx === 1 ? '#bdc3c7' : (idx === 2 ? '#cd7f32' : '#444'));
        let caskHtml = w.cask ? `<br><span style="font-size:12px; color:#aaa; font-style:italic;">${w.cask}</span>` : '';
        // ÄNDERUNG: NA Logik in persönlicher Top 10
        let ageStr = w.age ? (isNaN(w.age) ? ` (${w.age})` : ` (${w.age}J)`) : '';
        
        html += `<div class="result-card" style="border-color: ${borderCol};"><div style="display:flex; justify-content:space-between; align-items:center;"><div style="text-align:left;"><strong>${w.name}${ageStr}</strong>${caskHtml}<br><span style="font-size:11px; color:#999;">in: ${w.tasting}</span></div><div class="score-badge" style="background:#2ecc71; margin:0;">${w.score.toFixed(2)}</div></div></div>`;
    });
    
    html += `<h3 style="color:#e74c3c; text-align:center; margin-top:20px;">☠️ Flop 10</h3>`;
    bottom10.forEach((w, idx) => {
        let caskHtml = w.cask ? `<br><span style="font-size:12px; color:#aaa; font-style:italic;">${w.cask}</span>` : '';
        // ÄNDERUNG: NA Logik in persönlicher Flop 10
        let ageStr = w.age ? (isNaN(w.age) ? ` (${w.age})` : ` (${w.age}J)`) : '';
        
        html += `<div class="result-card" style="border-color: #e74c3c; opacity: 0.9;"><div style="display:flex; justify-content:space-between; align-items:center;"><div style="text-align:left;"><strong>${w.name}${ageStr}</strong>${caskHtml}<br><span style="font-size:11px; color:#999;">in: ${w.tasting}</span></div><div class="score-badge" style="background:#e74c3c; margin:0;">${w.score.toFixed(2)}</div></div></div>`;
    });
    container.innerHTML = html;
}