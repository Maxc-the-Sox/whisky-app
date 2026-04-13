// ==========================================
// FIREBASE & IMGBB SETUP
// ==========================================
const IMGBB_API_KEY = "fe4b31bdb30879fdf3f123b5c5c5a845";

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
        if (!snapshot.exists()) syncToCloud();
    });

    database.ref('dramscore_db').on('value', (snapshot) => {
        if(snapshot.exists()) {
            const data = snapshot.val();
            if(data.tastings) localStorage.setItem('whiskyTastings', data.tastings);
            if(data.whiskies) localStorage.setItem('whiskyDB', data.whiskies);
            if(data.participants) localStorage.setItem('participantDB', data.participants);
            if(data.icons) localStorage.setItem('participantIcons', data.icons);
            
            initHats();
            if(document.getElementById('view-dashboard').style.display !== 'none') loadDashboard();
            updateParticipantDatalist();
        }
    });
    document.getElementById('setup-date').valueAsDate = new Date();
    initHats();
};

function syncToCloud() {
    database.ref('dramscore_db').set({
        tastings: localStorage.getItem('whiskyTastings') || "[]",
        whiskies: localStorage.getItem('whiskyDB') || "[]",
        participants: localStorage.getItem('participantDB') || "[]",
        icons: localStorage.getItem('participantIcons') || "{}"
    });
}

// ==========================================
// HÜTE & ICONS 
// ==========================================
const HATS = ['🤠', '🎩', '🎓', '🧢', '👑', '🪖', '🕵️‍♂️', '🧑‍🍳', '🧑‍🔬', '🧙‍♂️', '🏴‍☠️', '🥷'];

function initHats() {
    let opts = HATS.map(h => `<option value="${h}">${h}</option>`).join('');
    if(document.getElementById('setup-expert-icon')) document.getElementById('setup-expert-icon').innerHTML = opts;
    if(document.getElementById('expert-change-icon')) document.getElementById('expert-change-icon').innerHTML = opts;
}

function updateSetupIcon() {
    let p = document.getElementById('setup-expert-select').value;
    let icons = JSON.parse(localStorage.getItem('participantIcons') || '{}');
    if(p && icons[p]) {
        document.getElementById('setup-expert-icon').value = icons[p];
    } else {
        document.getElementById('setup-expert-icon').value = '🤠';
    }
}

function updateModalIcon() {
    let p = document.getElementById('expert-change-select').value;
    let icons = JSON.parse(localStorage.getItem('participantIcons') || '{}');
    if(p && icons[p]) {
        document.getElementById('expert-change-icon').value = icons[p];
    } else {
        document.getElementById('expert-change-icon').value = '🤠';
    }
}

function saveParticipantIcon(name, icon) {
    if(!name) return;
    let icons = JSON.parse(localStorage.getItem('participantIcons') || '{}');
    icons[name] = icon;
    localStorage.setItem('participantIcons', JSON.stringify(icons));
    syncToCloud();
}


// ==========================================
// BILD-KOMPRESSOR & UPLOAD
// ==========================================
function previewImage(event) {
    let file = event.target.files[0];
    if(file) {
        let prev = document.getElementById('w-image-preview');
        prev.src = URL.createObjectURL(file);
        prev.style.display = 'inline-block';
    }
}

async function compressAndUploadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200; 
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
                const formData = new FormData();
                formData.append("image", base64Data);
                fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData })
                .then(res => res.json()).then(data => resolve(data.data.url)).catch(err => reject(err));
            };
        };
    });
}

async function uploadGroupPhoto(event) {
    let file = event.target.files[0]; if (!file) return;
    let btn = document.getElementById('btn-group-photo');
    let status = document.getElementById('group-photo-status');
    btn.innerText = "⏳ Lade Foto hoch..."; btn.disabled = true; status.style.display = "none";
    try {
        let url = await compressAndUploadImage(file);
        currentTasting.image = url; saveTasting(); 
        btn.innerText = "📸 Foto ändern"; status.style.display = "block";
    } catch(e) { alert("Upload fehlgeschlagen!"); btn.innerText = "📸 Gruppenfoto"; }
    btn.disabled = false;
}

function updateGroupPhotoUI() {
    let btn = document.getElementById('btn-group-photo');
    let status = document.getElementById('group-photo-status');
    if (currentTasting.image) { btn.innerText = "📸 Foto ändern"; status.style.display = "block"; } 
    else { btn.innerText = "📸 Gruppenfoto"; status.style.display = "none"; }
}

function showImageFullscreen(url) {
    document.getElementById('fullscreen-image').src = url;
    document.getElementById('modal-image-view').style.display = 'flex';
}

// ==========================================
// APP LOGIK
// ==========================================

let currentTasting = { id: null, number: '', name: '', date: '', image: '', participants: [], whiskies: [], ratings: {}, comments: [], motto: '', expert: '', expertIcon: '' };
let editingWhiskyIndex = null;
let currentRatingContext = { participant: null, whiskyIndex: null };
let currentDetailWhisky = null; 
let currentCommentTastingId = null; 

function navigateTo(viewId) {
    document.querySelectorAll('.view').forEach(view => view.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
    window.scrollTo(0, 0);
}

function formatTime(ts) {
    if(!ts || isNaN(ts)) return '';
    let d = new Date(ts);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + d.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'}) + ' Uhr';
}

function isSameWhisky(w1, w2) {
    return w1.name === w2.name && (w1.distillery || '') === (w2.distillery || '') && (w1.age || '') === (w2.age || '') && (w1.cask || '') === (w2.cask || '') && (w1.finish || '') === (w2.finish || '');
}

function addParticipant() {
    const input = document.getElementById('setup-participant-name');
    const name = input.value.trim();
    if(name && !currentTasting.participants.includes(name)) {
        currentTasting.participants.push(name);
        let pDB = JSON.parse(localStorage.getItem('participantDB')) || [];
        if(!pDB.includes(name)) { pDB.push(name); localStorage.setItem('participantDB', JSON.stringify(pDB)); syncToCloud(); }
        updateParticipantList(); updateParticipantDatalist(); input.value = '';
    }
}

function updateParticipantList() {
    const ul = document.getElementById('participant-list'); ul.innerHTML = '';
    currentTasting.participants.forEach(name => { ul.innerHTML += `<li>${name} <span style="color:#e74c3c; cursor:pointer;" onclick="removeParticipant('${name}')">✕</span></li>`; });
    updateExpertSelect();
}

function removeParticipant(name) { 
    if(name === currentTasting.expert) {
        currentTasting.expert = '';
        currentTasting.expertIcon = '';
    }
    currentTasting.participants = currentTasting.participants.filter(p => p !== name); updateParticipantList(); 
}

function updateParticipantDatalist() {
    let pDB = JSON.parse(localStorage.getItem('participantDB')) || [];
    let list = document.getElementById('known-participants'); list.innerHTML = '';
    pDB.forEach(p => list.innerHTML += `<option value="${p}"></option>`);
}

function updateExpertSelect(selectedExpertName = '') {
    const select = document.getElementById('setup-expert-select');
    select.innerHTML = '<option value="">-- Bitte wählen --</option>';
    if(currentTasting.participants.length === 0) { select.innerHTML = '<option value="">-- Zuerst Teilnehmer hinzufügen --</option>'; return; }
    currentTasting.participants.forEach(p => {
        const option = document.createElement('option'); option.value = p; option.innerText = p;
        if(p === selectedExpertName) option.selected = true;
        select.appendChild(option);
    });
    updateSetupIcon();
}

function addLiveParticipant() {
    const input = document.getElementById('live-participant-name');
    const name = input.value.trim();
    if(name && !currentTasting.participants.includes(name)) {
        currentTasting.participants.push(name);
        let pDB = JSON.parse(localStorage.getItem('participantDB')) || [];
        if(!pDB.includes(name)) { pDB.push(name); localStorage.setItem('participantDB', JSON.stringify(pDB)); syncToCloud(); }
        updateParticipantDatalist(); input.value = ''; closeModal('modal-participant'); renderGrid();
    }
}

function removeLiveParticipant(name) {
    if(confirm(`${name} entfernen?`)) {
        if(name === currentTasting.expert) {
            currentTasting.expert = '';
            currentTasting.expertIcon = '';
        }
        currentTasting.participants = currentTasting.participants.filter(p => p !== name);
        if(currentTasting.ratings[name]) delete currentTasting.ratings[name];
        renderGrid();
    }
}

function removeWhisky(idx) {
    let wName = currentTasting.whiskies[idx].name;
    if(confirm(`${wName} wirklich löschen?`)) {
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

function startTastingGrid() {
    currentTasting.number = document.getElementById('setup-number').value || '';
    currentTasting.name = document.getElementById('setup-name').value || 'Unbenanntes Tasting';
    currentTasting.date = document.getElementById('setup-date').value;
    currentTasting.motto = document.getElementById('setup-motto').value || '';
    currentTasting.expert = document.getElementById('setup-expert-select').value || '';
    currentTasting.expertIcon = document.getElementById('setup-expert-icon').value || '🤠';
    
    if(currentTasting.expert) saveParticipantIcon(currentTasting.expert, currentTasting.expertIcon);

    if(!currentTasting.id) currentTasting.id = 't_' + Date.now();
    if(currentTasting.participants.length === 0) return alert("Teilnehmer fehlen!");
    if(!currentTasting.whiskies) currentTasting.whiskies = [];
    if(!currentTasting.ratings) currentTasting.ratings = {};
    if(!currentTasting.comments) currentTasting.comments = [];
    document.getElementById('grid-edit-number').value = currentTasting.number;
    document.getElementById('grid-edit-name').value = currentTasting.name;
    document.getElementById('grid-edit-date').value = currentTasting.date;
    updateGroupPhotoUI(); updateExpertDisplay();
    updateDatalists(); renderGrid(); navigateTo('view-grid');
}

function updateTastingHeader() {
    currentTasting.number = document.getElementById('grid-edit-number').value;
    currentTasting.name = document.getElementById('grid-edit-name').value;
    currentTasting.date = document.getElementById('grid-edit-date').value;
}

function openMottoModal() { document.getElementById('live-motto-text').value = currentTasting.motto || ''; document.getElementById('modal-motto').style.display = 'block'; }
function saveMottoFromModal() { currentTasting.motto = document.getElementById('live-motto-text').value; saveTasting(); closeModal('modal-motto'); }

function openExpertChangeModal() {
    const select = document.getElementById('expert-change-select'); select.innerHTML = '<option value="">-- Keiner --</option>';
    currentTasting.participants.forEach(p => { const option = document.createElement('option'); option.value = p; option.innerText = p; if(p === currentTasting.expert) option.selected = true; select.appendChild(option); });
    updateModalIcon(); document.getElementById('modal-change-expert').style.display = 'block';
}

function saveExpertChange() { 
    currentTasting.expert = document.getElementById('expert-change-select').value; 
    currentTasting.expertIcon = document.getElementById('expert-change-icon').value || '🤠';
    if(currentTasting.expert) saveParticipantIcon(currentTasting.expert, currentTasting.expertIcon);
    updateExpertDisplay(); renderGrid(); saveTasting(); closeModal('modal-change-expert'); 
}

function updateExpertDisplay() { 
    document.getElementById('grid-expert-name').innerText = currentTasting.expert || 'Keiner festgelegt'; 
    document.getElementById('grid-expert-icon-display').innerText = currentTasting.expertIcon || '🤠'; 
}

function renderGrid() {
    const table = document.getElementById('tasting-table');
    let cols = currentTasting.whiskies.map((w, i) => ({ w: w, idx: i, f: parseInt(w.flight) || 1 }));
    cols.sort((a, b) => a.f - b.f);
    let flightRow = `<tr><th rowspan="2" style="background:#111; color:#3498db; font-size:12px;" onclick="document.getElementById('modal-participant').style.display='block'">➕ Person</th>`;
    let whiskyRow = `<tr>`;
    if (cols.length > 0) {
        let currentFlight = cols[0].f; let span = 0;
        cols.forEach((c) => {
            if (c.f !== currentFlight) { flightRow += `<th colspan="${span}" class="flight-header">Flight ${currentFlight}</th>`; currentFlight = c.f; span = 1; } else { span++; }
            let ageStr = c.w.age ? (isNaN(c.w.age) ? ` (${c.w.age})` : ` (${c.w.age}J)`) : '';
            whiskyRow += `<th class="whisky-header"><div onclick="openWhiskyModal(${c.idx})"><strong>${c.w.name}${ageStr}${c.w.image ? " 📸" : ""}</strong><br><span style="font-size:11px; color:#aaa;">✏️ Bearbeiten</span></div><div onclick="removeWhisky(${c.idx})" style="margin-top:8px; color:#e74c3c;">🗑️</div></th>`;
        });
        flightRow += `<th colspan="${span}" class="flight-header">Flight ${currentFlight}</th>`;
    }
    flightRow += `<th rowspan="2" style="background:#111;"><button class="add-whisky-btn" onclick="openWhiskyModal(null)">+🥃</button></th></tr>`;
    whiskyRow += `</tr>`;
    let html = `<thead>${flightRow}${whiskyRow}</thead><tbody>`;
    currentTasting.participants.forEach(pName => {
        let isExpert = pName === currentTasting.expert;
        let icon = currentTasting.expertIcon || '🤠';
        let displayName = isExpert ? `<strong>${icon} ${pName}</strong>` : pName;
        html += `<tr><td style="background:#222; position:sticky; left:0; z-index:2;" onclick="removeLiveParticipant('${pName}')">${displayName} <span style="font-size:10px; color:#666;">🗑️</span></td>`;
        cols.forEach(c => {
            let r = currentTasting.ratings[pName]?.[c.idx];
            let val = r && r.overall ? (r.overall === 'skip' ? '🙈' : r.overall) : '';
            html += `<td><div style="display:flex; align-items:center; justify-content:center;"><input type="text" class="inline-input" placeholder="-" value="${val}" onchange="updateInlineRating('${pName}', ${c.idx}, this.value)"><span class="edit-icon" onclick="openRatingModal('${pName}', ${c.idx})">📝</span></div></td>`;
        });
        html += `<td></td></tr>`;
    });
    table.innerHTML = html + `</tbody>`;
}

function updateInlineRating(p, idx, val) {
    if(!currentTasting.ratings[p]) currentTasting.ratings[p] = {};
    if(!currentTasting.ratings[p][idx]) currentTasting.ratings[p][idx] = { nose: '', taste: '', finish: '', overall: '' };
    if (val === '🙈') val = 'skip';
    currentTasting.ratings[p][idx].overall = val;
}

function closeModal(id) { document.getElementById(id).style.display = "none"; }

function calculateAge() {
    let v = parseInt(document.getElementById('w-vintage').value);
    let b = parseInt(document.getElementById('w-bottled').value);
    if (!isNaN(v) && !isNaN(b) && b >= v) {
        document.getElementById('w-age').value = b - v;
    }
}

function searchWhiskyBase() {
    let n = document.getElementById('w-name').value || '';
    let d = document.getElementById('w-distillery').value || '';
    let a = document.getElementById('w-age').value || '';
    let v = document.getElementById('w-vintage').value || '';
    let b = document.getElementById('w-bottled').value || '';
    let c = document.getElementById('w-cask').value || '';
    let f = document.getElementById('w-finish').value || '';
    
    let query = `site:whiskybase.com ${n} ${d} ${a} ${v} ${b} ${c} ${f}`.replace(/\s+/g, ' ').trim();
    if(query === 'site:whiskybase.com') return alert('Bitte zuerst einen Namen oder eine Destille eintragen!');
    window.open('https://www.google.com/search?q=' + encodeURIComponent(query), '_blank');
}


function openGlobalWhiskyEdit() {
    closeModal('modal-whisky-details'); 
    editingWhiskyIndex = 'global';
    
    document.getElementById('w-image-input').value = "";
    document.getElementById('w-image-preview').style.display = "none";
    document.getElementById('w-image-hidden').value = "";
    
    let w = currentDetailWhisky;
    ['name', 'distillery', 'cask', 'finish', 'type', 'country', 'age', 'abv', 'vintage', 'bottled', 'wbLink'].forEach(key => {
        if(document.getElementById('w-'+key)) document.getElementById('w-'+key).value = w[key] || '';
    });
    document.getElementById('w-flight').value = w.flight || 1;
    
    if(w.image) {
        document.getElementById('w-image-preview').src = w.image;
        document.getElementById('w-image-preview').style.display = "inline-block";
        document.getElementById('w-image-hidden').value = w.image;
    }
    
    document.getElementById('modal-whisky').style.display = "block";
}

function updateWhiskyGlobally(oldW, newW) {
    let db = JSON.parse(localStorage.getItem('whiskyDB')) || [];
    let dbIndex = db.findIndex(w => isSameWhisky(w, oldW));
    if(dbIndex >= 0) db[dbIndex] = newW; 
    else db.push(newW);
    localStorage.setItem('whiskyDB', JSON.stringify(db));

    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    tastings.forEach(t => {
        if(t.whiskies) {
            t.whiskies.forEach((w, i) => {
                if(isSameWhisky(w, oldW)) {
                    let flight = w.flight; 
                    t.whiskies[i] = { ...newW, flight: flight, comments: w.comments };
                }
            });
        }
    });
    localStorage.setItem('whiskyTastings', JSON.stringify(tastings));
    syncToCloud();
}


function openWhiskyModal(index) {
    editingWhiskyIndex = index;
    document.getElementById('w-image-input').value = ""; document.getElementById('w-image-preview').style.display = "none"; document.getElementById('w-image-hidden').value = "";
    if(index !== null) {
        let w = currentTasting.whiskies[index];
        ['name', 'distillery', 'cask', 'finish', 'type', 'country', 'age', 'abv', 'flight', 'vintage', 'bottled', 'wbLink'].forEach(key => { if(document.getElementById('w-'+key)) document.getElementById('w-'+key).value = w[key] || ''; });
        if(w.image) { document.getElementById('w-image-preview').src = w.image; document.getElementById('w-image-preview').style.display = "inline-block"; document.getElementById('w-image-hidden').value = w.image; }
    } else {
        ['w-name', 'w-distillery', 'w-cask', 'w-finish', 'w-type', 'w-country', 'w-age', 'w-abv', 'w-vintage', 'w-bottled', 'w-wbLink'].forEach(id => {
            if(document.getElementById(id)) document.getElementById(id).value = '';
        });
        let high = currentTasting.whiskies.length > 0 ? Math.max(...currentTasting.whiskies.map(w => parseInt(w.flight) || 1)) : 1;
        document.getElementById('w-flight').value = high;
    }
    document.getElementById('modal-whisky').style.display = "block";
}

async function saveWhiskyFromModal() {
    let wName = document.getElementById('w-name').value; if(!wName) return alert("Name!");
    let btn = document.getElementById('btn-save-whisky'); let fileInput = document.getElementById('w-image-input');
    btn.innerText = "⏳ Upload..."; btn.disabled = true;
    let finalImageUrl = document.getElementById('w-image-hidden').value;
    if(fileInput.files.length > 0) { try { finalImageUrl = await compressAndUploadImage(fileInput.files[0]); } catch(e) { alert("Fail!"); } }
    
    let wData = { 
        name: wName, distillery: document.getElementById('w-distillery').value, cask: document.getElementById('w-cask').value, 
        finish: document.getElementById('w-finish').value, type: document.getElementById('w-type').value, 
        country: document.getElementById('w-country').value, age: document.getElementById('w-age').value, 
        vintage: document.getElementById('w-vintage').value, bottled: document.getElementById('w-bottled').value,
        wbLink: document.getElementById('w-wbLink').value,
        abv: document.getElementById('w-abv').value, flight: document.getElementById('w-flight').value || 1, 
        image: finalImageUrl, comments: [] 
    };

    if(editingWhiskyIndex === 'global') {
        wData.comments = currentDetailWhisky.comments || [];
        updateWhiskyGlobally(currentDetailWhisky, wData);
        btn.innerText = "Speichern"; btn.disabled = false; closeModal('modal-whisky');
        showDetailCard(encodeURIComponent(JSON.stringify(wData)).replace(/'/g, "%27"));
        if(document.getElementById('view-cabinet').style.display !== 'none') loadCabinet();
        if(document.getElementById('view-dashboard').style.display !== 'none') loadDashboard();
        if(document.getElementById('view-grid').style.display !== 'none') renderGrid();
        return;
    }
    
    if(editingWhiskyIndex !== null) { wData.comments = currentTasting.whiskies[editingWhiskyIndex].comments || []; currentTasting.whiskies[editingWhiskyIndex] = wData; } 
    else { currentTasting.whiskies.push(wData); saveToMasterDB(wData); }
    btn.innerText = "Speichern"; btn.disabled = false; closeModal('modal-whisky'); renderGrid();
}

function renderWhiskyComments() {
    let list = document.getElementById('detail-comments-list'); list.innerHTML = '';
    if (!currentDetailWhisky.comments || currentDetailWhisky.comments.length === 0) { list.innerHTML = '<div style="font-size:13px; color:#888; font-style:italic; text-align:center;">Noch keine Stimmen.</div>'; return; }
    currentDetailWhisky.comments.forEach(c => {
        let ts = c.timestamp || parseInt(c.id.split('_')[1]);
        list.innerHTML += `<div class="comment-box"><div class="comment-author">${c.name} <span class="comment-time">${formatTime(ts)}</span></div><div class="comment-text">${c.text}</div><div class="comment-delete" onclick="deleteWhiskyComment('${c.id}')">🗑️</div></div>`;
    });
}

function addWhiskyComment() {
    let nI = document.getElementById('w-comment-name'); let tI = document.getElementById('w-comment-text');
    if(!nI.value || !tI.value) return alert("Pflichtfelder!");
    if(!currentDetailWhisky.comments) currentDetailWhisky.comments = [];
    let now = Date.now();
    currentDetailWhisky.comments.push({ id: 'c_' + now, timestamp: now, name: nI.value.trim(), text: tI.value.trim() });
    nI.value = ''; tI.value = ''; updateWhiskyInAllDBs(currentDetailWhisky); renderWhiskyComments();
}

function deleteWhiskyComment(id) { if(confirm("Löschen?")) { currentDetailWhisky.comments = currentDetailWhisky.comments.filter(c => c.id !== id); updateWhiskyInAllDBs(currentDetailWhisky); renderWhiskyComments(); } }

function updateWhiskyInAllDBs(updatedWhisky) {
    let db = JSON.parse(localStorage.getItem('whiskyDB')) || [];
    let idx = db.findIndex(w => isSameWhisky(w, updatedWhisky));
    if(idx >= 0) db[idx].comments = updatedWhisky.comments; else db.push(updatedWhisky);
    localStorage.setItem('whiskyDB', JSON.stringify(db));
    let t = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    t.forEach(x => { if(x.whiskies) x.whiskies.forEach(w => { if(isSameWhisky(w, updatedWhisky)) w.comments = updatedWhisky.comments; }); });
    localStorage.setItem('whiskyTastings', JSON.stringify(t)); syncToCloud();
}

function showDetailCard(encodedObj) {
    currentDetailWhisky = JSON.parse(decodeURIComponent(encodedObj));
    let w = currentDetailWhisky;
    
    let ageStr = w.age ? (isNaN(w.age) ? w.age : `${w.age} Jahre`) : '-';
    
    document.getElementById('detail-name').innerText = w.name;
    document.getElementById('detail-distillery').innerText = w.distillery || '';
    document.getElementById('detail-type').innerText = w.type || '-';
    document.getElementById('detail-country').innerText = w.country || '-';
    document.getElementById('detail-vintage').innerText = w.vintage || '-';
    document.getElementById('detail-bottled').innerText = w.bottled || '-';
    document.getElementById('detail-age').innerText = ageStr;
    document.getElementById('detail-abv').innerText = w.abv ? `${w.abv}%` : '-';
    document.getElementById('detail-cask').innerText = w.cask || '-';
    document.getElementById('detail-finish').innerText = w.finish || '-';
    
    let wbBtn = document.getElementById('detail-wb-link');
    if(w.wbLink && w.wbLink.trim() !== '') {
        wbBtn.href = w.wbLink;
        wbBtn.style.display = 'block';
        
        let linkText = "Webseite";
        let linkIcon = "🔗";
        try {
            let urlObj = new URL(w.wbLink);
            let domain = urlObj.hostname.replace('www.', '');
            if(domain.includes('whiskybase.com')) {
                linkText = "Whiskybase";
                linkIcon = "🥃";
            } else {
                linkText = domain;
                linkIcon = "🔗";
            }
        } catch(e) {
            linkText = "Webseite";
        }
        wbBtn.innerText = `${linkIcon} Auf ${linkText} ansehen`;
        
    } else {
        wbBtn.style.display = 'none';
    }
    
    let img = document.getElementById('detail-img'); if(w.image) { img.src = w.image; img.style.display = 'block'; } else { img.style.display = 'none'; }
    renderWhiskyComments(); document.getElementById('modal-whisky-details').style.display = 'block';
}

function openRatingModal(p, idx) {
    currentRatingContext = { participant: p, whiskyIndex: idx };
    let r = currentTasting.ratings[p]?.[idx] || { nose: '', taste: '', finish: '', overall: '' };
    document.getElementById('modal-rating-subtitle').innerText = `${p} bewertet: ${currentTasting.whiskies[idx].name}`;
    ['nose', 'taste', 'finish', 'overall'].forEach(key => { let val = r[key]; document.getElementById('r-'+key).value = (val === 'skip' ? '' : val); });
    document.getElementById('modal-rating').style.display = "block";
}

function saveRatingFromModal() {
    let p = currentRatingContext.participant; let idx = currentRatingContext.whiskyIndex;
    if(!currentTasting.ratings[p]) currentTasting.ratings[p] = {};
    currentTasting.ratings[p][idx] = { nose: document.getElementById('r-nose').value, taste: document.getElementById('r-taste').value, finish: document.getElementById('r-finish').value, overall: document.getElementById('r-overall').value };
    closeModal('modal-rating'); renderGrid();
}

function skipRatingFromModal() {
    let p = currentRatingContext.participant; let idx = currentRatingContext.whiskyIndex;
    if(!currentTasting.ratings[p]) currentTasting.ratings[p] = {};
    currentTasting.ratings[p][idx] = { nose: '', taste: '', finish: '', overall: 'skip' };
    closeModal('modal-rating'); renderGrid();
}

function saveTasting() {
    if(!currentTasting.whiskies) currentTasting.whiskies = []; if(!currentTasting.participants) currentTasting.participants = []; if(!currentTasting.ratings) currentTasting.ratings = {}; if(!currentTasting.comments) currentTasting.comments = [];
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    let idx = tastings.findIndex(t => t.id === currentTasting.id);
    if(idx >= 0) tastings[idx] = currentTasting; else tastings.push(currentTasting);
    localStorage.setItem('whiskyTastings', JSON.stringify(tastings)); syncToCloud(); 
}

function calculateWinnerForDashboard(t) {
    if (!t.whiskies || t.whiskies.length === 0 || !t.ratings) return null;
    let best = null; let highAvg = -1;
    t.whiskies.forEach((w, i) => {
        let tot = 0, count = 0;
        if(t.participants) { t.participants.forEach(p => { let r = t.ratings[p]?.[i]; if(r && r.overall && !isNaN(parseFloat(r.overall))) { tot += parseFloat(r.overall); count++; } }); }
        let avg = count > 0 ? (tot / count) : 0;
        if (avg > highAvg && avg > 0) { highAvg = avg; best = w; }
    });
    return { whisky: best, score: highAvg };
}

function loadFeed() {
    let feed = []; let db = JSON.parse(localStorage.getItem('whiskyDB')) || [];
    db.forEach(w => { if(w.comments) { w.comments.forEach(c => { let ts = c.timestamp || parseInt(c.id.split('_')[1]); if(!isNaN(ts)) feed.push({ type: 'whisky', target: w, comment: c, time: ts }); }); } });
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    tastings.forEach(t => { if(t.comments) { t.comments.forEach(c => { let ts = c.timestamp || parseInt(c.id.split('_')[1]); if(!isNaN(ts)) feed.push({ type: 'tasting', target: t, comment: c, time: ts }); }); } });
    feed.sort((a,b) => b.time - a.time); feed = feed.slice(0, 15); 
    let container = document.getElementById('feed-container-main');
    if(feed.length === 0) { container.innerHTML = "<p style='text-align:center; color:#888; font-size:14px; margin-top:30px;'>Noch keine Kommentare.</p>"; return; }
    let html = '<div class="feed-container">';
    feed.forEach(item => {
        let timeStr = formatTime(item.time);
        if(item.type === 'whisky') {
            let w = item.target; let ageStr = w.age ? (isNaN(w.age) ? w.age : w.age+'J') : '-';
            html += `<div class="feed-item" onclick="showDetailCard('${encodeURIComponent(JSON.stringify(w)).replace(/'/g, "%27")}')"><div style="font-size:13px; color:var(--accent-color); margin-bottom:5px;">🗣️ <strong>${item.comment.name}</strong> bei:</div><div style="background:#111; padding:8px; border-radius:5px; border:1px solid #333; margin-bottom:5px;">🥃 <strong>${w.name}</strong> (${ageStr})</div><div style="font-style:italic; font-size:13px; color:#ddd;">"${item.comment.text}"</div><div class="feed-time">🕒 ${timeStr}</div></div>`;
        } else {
            let t = item.target;
            html += `<div class="feed-item" onclick="showTastingResults('${t.id}')"><div style="font-size:13px; color:#3498db; margin-bottom:5px;">🗣️ <strong>${item.comment.name}</strong> bei:</div><div style="background:#111; padding:8px; border-radius:5px; border:1px solid #333; margin-bottom:5px;">🏆 <strong>Tasting ${t.name}</strong></div><div style="font-style:italic; font-size:13px; color:#ddd;">"${item.comment.text}"</div><div class="feed-time">🕒 ${timeStr}</div></div>`;
        }
    });
    container.innerHTML = html + '</div>';
}

function loadDashboard() {
    const container = document.getElementById('tasting-list-container');
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    if(tastings.length === 0) return container.innerHTML = "<p style='text-align:center;'>Noch keine Tastings.</p>";
    tastings.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let html = '';
    
    let experts = [...new Set(tastings.map(t => t.expert || ''))];
    let pIcons = JSON.parse(localStorage.getItem('participantIcons') || '{}');
    
    experts.sort((a, b) => {
        if(a === '') return 1;
        if(b === '') return -1;
        return a.localeCompare(b);
    });

    experts.forEach(expert => {
        let expertTastings = tastings.filter(t => (t.expert || '') === expert);
        if(expertTastings.length === 0) return;

        let icon = pIcons[expert] || '🤠';
        let title = expert ? `${icon} Tastings von ${expert}` : `🥃 Gemeinschaftliche Tastings`;
        
        html += `<h2 style="margin-top: 35px; border-bottom: 1px solid #444; padding-bottom: 5px; color: var(--accent-color);">${title}</h2>`;

        let years = [...new Set(expertTastings.map(t => t.date.split('-')[0]))].sort((a, b) => b - a);
        years.forEach((y, i) => {
            let openAttr = i === 0 ? "open" : "";
            html += `<details class="year-details" ${openAttr}><summary class="year-summary">${y} (${expertTastings.filter(t=>t.date.startsWith(y)).length})</summary><ul style="list-style:none; padding:0; margin-top:15px;">`;
            
            expertTastings.filter(t => t.date.startsWith(y)).forEach(t => {
                let winData = calculateWinnerForDashboard(t);
                
                let cF = [];
                if(winData && winData.whisky && winData.whisky.cask) cF.push(`Fass: ${winData.whisky.cask}`);
                if(winData && winData.whisky && winData.whisky.finish) cF.push(`Finish: ${winData.whisky.finish}`);
                let caskDashInfo = cF.length > 0 ? `<br><span style="font-size:12px; color:#aaa; font-style:italic;">${cF.join('<br>')}</span>` : "";
                
                let clickCard = (winData && winData.whisky) ? `onclick="showDetailCard('${encodeURIComponent(JSON.stringify(winData.whisky)).replace(/'/g, "%27")}')" style="cursor:pointer;"` : "";
                let imgIcon = (winData && winData.whisky && winData.whisky.image) ? ' 📸' : '';
                
                let winH = (winData && winData.whisky) ? `<div ${clickCard} style="margin-top: 8px; color:#f1c40f; font-size:14px; background:#222; padding:5px; border-radius:5px;">🏆 Sieger: ${winData.whisky.name}${imgIcon} ${caskDashInfo}<br><span style="color:#aaa; font-size:12px;">Ø ${parseFloat(winData.score).toFixed(2)} Punkte</span></div>` : "";
                
                let numDisplay = t.number ? `<span style="color:var(--accent-color);">#${t.number}</span> ` : "";
                let groupImgIcon = t.image ? ` <span style="cursor:pointer;" onclick="showImageFullscreen('${t.image}')">📸</span>` : '';
                
                let tIcon = t.expertIcon || pIcons[t.expert] || '🤠';
                let expertDisplay = t.expert ? ` | ${tIcon} ${t.expert}` : '';

                html += `<li class="tasting-item">
                    <strong>${numDisplay}${t.name}${groupImgIcon}</strong> <br>
                    <span style="color:#bdc3c7; font-size:14px;">📅 ${t.date} | 👥 ${t.participants ? t.participants.length : 0} | 🥃 ${t.whiskies ? t.whiskies.length : 0}${expertDisplay}</span>
                    ${winH}
                    <div style="display: flex; gap: 8px; margin-top: 15px; flex-wrap: wrap;">
                        <button class="btn-secondary" style="margin-top: 0; padding: 8px; font-size: 14px; flex: 1; min-width: 80px; border-color: #f1c40f; color: #f1c40f;" onclick="showTastingResults('${t.id}')">🏆 Wertung</button>
                        <button class="btn-secondary" style="margin-top: 0; padding: 8px; font-size: 14px; flex: 1; min-width: 80px; border-color: #3498db; color: #3498db;" onclick="openTastingComments('${t.id}')">💬 Stimmen am Tisch</button>
                        <button class="btn-secondary" style="margin-top: 0; padding: 8px; font-size: 14px; flex: 1; min-width: 80px;" onclick="resumeTasting('${t.id}')">✏️ Bearbeiten</button>
                        <button class="btn-secondary" style="margin-top: 0; padding: 8px; font-size: 14px; flex: 1; min-width: 80px; border-color: #e74c3c; color: #e74c3c;" onclick="deleteSingleTasting('${t.id}')">🗑️ Löschen</button>
                    </div></li>`;
            });
            html += `</ul></details>`;
        });
    });
    container.innerHTML = html;
}

// GEÄNDERT: showTastingResults mit neuem Podium-Design (V61)
function showTastingResults(id) {
    closeModal('modal-whisky-details'); 
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    let foundTasting = tastings.find(t => t.id === id); if(!foundTasting) return;
    currentTasting = JSON.parse(JSON.stringify(foundTasting)); 
    if(!currentTasting.whiskies) currentTasting.whiskies = []; if(!currentTasting.participants) currentTasting.participants = []; if(!currentTasting.ratings) currentTasting.ratings = {}; if(!currentTasting.comments) currentTasting.comments = [];
    
    let dateDisp = currentTasting.date ? ` • 📅 ${currentTasting.date.split('-').reverse().join('.')}` : "";
    document.getElementById('results-title').innerText = (currentTasting.number ? '#'+currentTasting.number+' ' : '') + currentTasting.name + dateDisp;
    
    let icon = currentTasting.expertIcon || '🤠';
    let expertHtml = currentTasting.expert ? `${icon} Whisky-Experte: ${currentTasting.expert}` : 'Kein Experte festgelegt';
    document.getElementById('results-expert').innerText = expertHtml;
    let nonExperts = currentTasting.participants.filter(p => p !== currentTasting.expert);
    document.getElementById('results-participants').innerText = `👥 Am Tisch (${currentTasting.participants.length}): ${nonExperts.join(', ')}`;

    let groupPhoto = document.getElementById('results-group-photo');
    if (currentTasting.image) { groupPhoto.src = currentTasting.image; groupPhoto.style.display = "block"; } else { groupPhoto.style.display = "none"; }

    let mottoCont = document.getElementById('results-motto-container');
    if(currentTasting.motto && currentTasting.motto.trim() !== '') {
        mottoCont.innerHTML = `<details class="motto-details"><summary class="motto-summary">📜 Motto & Einleitung lesen</summary><div class="motto-text">${currentTasting.motto}</div></details>`;
    } else { mottoCont.innerHTML = ''; }

    // Rankings berechnen
    let res = currentTasting.whiskies.map((w, index) => {
        let tot = 0, count = 0;
        currentTasting.participants.forEach(p => { let r = currentTasting.ratings[p]?.[index]; if(r && r.overall && !isNaN(parseFloat(r.overall))) { tot += parseFloat(r.overall); count++; } });
        w.avg = count > 0 ? parseFloat((tot/count).toFixed(2)) : 0; return w;
    }).sort((a,b)=>b.avg - a.avg);

    const pod = document.getElementById('podium-container'); pod.innerHTML = '';
    
    if(res.length === 0) { pod.innerHTML = '<p style="text-align:center;">Noch keine Whiskys bewertet.</p>'; }
    else {
        let html = '';
        res.forEach((r, i) => {
            let isFirst = (i === 0);
            let isPodium = (i < 3);
            let isLast = (i === res.length - 1 && res.length > 1);
            
            let rankClass = isFirst ? "rank-1" : (i === 1 ? "rank-2" : (i === 2 ? "rank-3" : "middle-rank"));
            if(isLast) rankClass = "rank-last";
            
            let medalEmoji = isFirst ? "🥇" : (i === 1 ? "🥈" : (i === 2 ? "🥉" : ""));
            
            // Header fürs Mittelfeld
            if(i === 3 && res.length > 4) {
                html += `<div class="middle-field-header"><span>Das solide Mittelfeld</span></div>`;
            }
            
            let cF = []; if(r.cask) cF.push(`Fass: ${r.cask}`); if(r.finish) cF.push(`Finish: ${r.finish}`);
            let caskHtml = cF.length > 0 ? `<div style="font-size:13px; color:#aaa; font-style:italic; margin-bottom:8px;">${cF.join('<br>')}</div>` : "";
            let ageStr = r.age ? (isNaN(r.age) ? ` (${r.age})` : ` (${r.age}J)`) : '';
            let imgIcon = r.image ? ' 📸' : '';
            
            html += `<div class="result-card ${rankClass}" onclick="showDetailCard('${encodeURIComponent(JSON.stringify(r)).replace(/'/g, "%27")}')">`;
            
            if(isLast) html += `<div class="lantern-label">🏮 Die rote Laterne des Abends</div>`;
            
            html += `<div style="font-size:14px; color:var(--secondary-text);">${medalEmoji} ${i+1}. Platz</div>
                     <h3 style="margin: 5px 0;">${r.name}${ageStr}${imgIcon}</h3>
                     ${caskHtml}
                     <div class="${isFirst ? 'score-badge-large' : 'score-badge'}">Ø ${r.avg.toFixed(2)} Punkte</div>
                     </div>`;
        });
        pod.innerHTML = html;
    }
    
    renderResultsTastingComments(); navigateTo('view-results');
}

function openTastingComments(id) { currentCommentTastingId = id; let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || []; let t = tastings.find(x => x.id === id); if(!t) return; document.getElementById('tasting-comments-subtitle').innerText = t.name; renderTastingComments(); document.getElementById('modal-tasting-comments').style.display = 'block'; }
function renderTastingComments() { let list = document.getElementById('tasting-comments-list'); list.innerHTML = ''; let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || []; let t = tastings.find(x => x.id === currentCommentTastingId); if (!t.comments || t.comments.length === 0) { list.innerHTML = '<div style="font-size: 13px; color: #888; font-style: italic; text-align: center;">Noch keine Stimmen am Tisch vorhanden.</div>'; return; } t.comments.forEach(c => { let ts = c.timestamp || parseInt(c.id.split('_')[1]); list.innerHTML += `<div class="comment-box"><div class="comment-author">${c.name} <span class="comment-time">${formatTime(ts)}</span></div><div class="comment-text">${c.text}</div><div class="comment-delete" onclick="deleteTastingComment('${c.id}')">🗑️</div></div>`; }); }
function addTastingComment() { let nI = document.getElementById('t-comment-name'); let tI = document.getElementById('t-comment-text'); if(!nI.value || !tI.value) return alert("Bitte Name und deine Stimme eingeben!"); let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || []; let idx = tastings.findIndex(x => x.id === currentCommentTastingId); if(idx === -1) return; if(!tastings[idx].comments) tastings[idx].comments = []; let now = Date.now(); tastings[idx].comments.push({ id: 'c_' + now, timestamp: now, name: nI.value.trim(), text: tI.value.trim() }); localStorage.setItem('whiskyTastings', JSON.stringify(tastings)); syncToCloud(); nI.value = ''; tI.value = ''; renderTastingComments(); if(document.getElementById('view-feed').style.display !== 'none') loadFeed(); }
function deleteTastingComment(id) { if(confirm("Eintrag wirklich löschen?")) { let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || []; let tIndex = tastings.findIndex(x => x.id === currentCommentTastingId); if(tIndex === -1) return; tastings[tIndex].comments = tastings[tIndex].comments.filter(c => c.id !== id); localStorage.setItem('whiskyTastings', JSON.stringify(tastings)); syncToCloud(); renderTastingComments(); if(document.getElementById('view-feed').style.display !== 'none') loadFeed(); } }

function renderResultsTastingComments() { let list = document.getElementById('results-comments-list'); list.innerHTML = ''; if (!currentTasting.comments || currentTasting.comments.length === 0) { list.innerHTML = '<div style="font-size: 13px; color: #888; font-style: italic; text-align: center;">Noch keine Stimmen zum Abend vorhanden.</div>'; return; } currentTasting.comments.forEach(c => { let ts = c.timestamp || parseInt(c.id.split('_')[1]); list.innerHTML += `<div class="comment-box"><div class="comment-author">${c.name} <span class="comment-time">${formatTime(ts)}</span></div><div class="comment-text">${c.text}</div><div class="comment-delete" onclick="deleteResultsTastingComment('${c.id}')">🗑️</div></div>`; }); }
function addResultsTastingComment() { let nI = document.getElementById('r-comment-name'); let tI = document.getElementById('r-comment-text'); if(!nI.value || !tI.value) return alert("Bitte Name und deine Stimme eingeben!"); if(!currentTasting.comments) currentTasting.comments = []; let now = Date.now(); currentTasting.comments.push({ id: 'c_' + now, timestamp: now, name: nI.value.trim(), text: tI.value.trim() }); saveTasting(); nI.value = ''; tI.value = ''; renderResultsTastingComments(); }
function deleteResultsTastingComment(id) { if(confirm("Eintrag wirklich löschen?")) { currentTasting.comments = currentTasting.comments.filter(c => c.id !== id); saveTasting(); renderResultsTastingComments(); } }


function resumeTasting(id) {
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || [];
    let found = tastings.find(t => t.id === id); if(!found) return;
    currentTasting = JSON.parse(JSON.stringify(found)); 
    document.getElementById('grid-edit-number').value = currentTasting.number || '';
    document.getElementById('grid-edit-name').value = currentTasting.name || '';
    document.getElementById('grid-edit-date').value = currentTasting.date || '';
    updateGroupPhotoUI(); updateParticipantList(); updateExpertSelect(currentTasting.expert); updateExpertDisplay();
    renderGrid(); navigateTo('view-grid');
}

function finishAndShowResults() { saveTasting(); showTastingResults(currentTasting.id); }
function exitToDashboard() { currentTasting = { id: null, number: '', name: '', date: '', image: '', participants: [], whiskies: [], ratings: {}, comments: [], motto: '', expert: '' }; loadDashboard(); navigateTo('view-dashboard'); }
function saveToMasterDB(w) { let db = JSON.parse(localStorage.getItem('whiskyDB')) || []; if(!db.find(x => isSameWhisky(x, w))) { db.push(w); localStorage.setItem('whiskyDB', JSON.stringify(db)); syncToCloud(); } }
function autoFillWhisky(i) { let db = JSON.parse(localStorage.getItem('whiskyDB')) || []; let w = db.find(x => x.name === i.value); if(w) { ['distillery', 'cask', 'finish', 'type', 'country', 'age', 'abv', 'vintage', 'bottled', 'wbLink'].forEach(k => { if(document.getElementById('w-'+k)) document.getElementById('w-'+k).value = w[k] || ''; }); if(w.image) { document.getElementById('w-image-preview').src = w.image; document.getElementById('w-image-preview').style.display = "inline-block"; document.getElementById('w-image-hidden').value = w.image; } } }
function updateDatalists() { let db = JSON.parse(localStorage.getItem('whiskyDB')) || []; document.getElementById('known-whiskies').innerHTML = db.map(w => `<option value="${w.name}"></option>`).join(''); let dists = [...new Set(db.map(w => w.distillery).filter(Boolean))]; document.getElementById('known-distilleries').innerHTML = dists.map(d => `<option value="${d}"></option>`).join(''); }

function exportTastingToCSV(id) { 
    let t = JSON.parse(localStorage.getItem('whiskyTastings')).find(x => x.id === id); 
    let csv = "\uFEFFFlight;Whisky;Fass;Finish;Bild-Link;Whiskybase;Durchschnitt\n"; 
    if(t.whiskies) { 
        t.whiskies.forEach((w, i) => { 
            let tot=0, c=0; 
            if(t.participants) { 
                t.participants.forEach(p => { 
                    let r=t.ratings[p]?.[i]; 
                    if(r && r.overall && !isNaN(parseFloat(r.overall))){tot+=parseFloat(r.overall); c++;} 
                }); 
            } 
            let avg = c>0 ? (tot/c).toFixed(2) : "0,00"; 
            csv += `${w.flight || 1};${w.name};${w.cask || ''};${w.finish || ''};${w.image || ''};${w.wbLink || ''};${avg.replace('.', ',')}\n`; 
        }); 
    } 
    let a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'})); 
    a.download = `DramScore_${t.name}.csv`; a.click(); 
}

function deleteSingleTasting(id) { if(confirm("Tasting wirklich löschen?")) { let t = JSON.parse(localStorage.getItem('whiskyTastings')).filter(x => x.id !== id); localStorage.setItem('whiskyTastings', JSON.stringify(t)); syncToCloud(); loadDashboard(); } }
function exportDatabase() { let data = { tastings: JSON.parse(localStorage.getItem('whiskyTastings')), whiskies: JSON.parse(localStorage.getItem('whiskyDB')), participants: JSON.parse(localStorage.getItem('participantDB')), icons: JSON.parse(localStorage.getItem('participantIcons') || '{}') }; let a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:"application/json"})); a.download = `DramScore_Backup.json`; a.click(); }
function importDatabase(event) { let reader = new FileReader(); reader.onload = function(e) { let d = JSON.parse(e.target.result); localStorage.setItem('whiskyTastings', JSON.stringify(d.tastings || [])); localStorage.setItem('whiskyDB', JSON.stringify(d.whiskies || [])); localStorage.setItem('participantDB', JSON.stringify(d.participants || [])); if(d.icons) localStorage.setItem('participantIcons', JSON.stringify(d.icons)); syncToCloud(); location.reload(); }; reader.readAsText(event.target.files[0]); }

function exportAllTastingsToCSV() { 
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || []; 
    if(tastings.length === 0) return alert("Keine Tastings vorhanden!"); 
    let csv = "\uFEFFNr.;Tasting;Datum;Tasting-Bild;Flight;Whisky;Fass;Finish;Destille;Art;Land;Alter;Jahrgang;Abgefüllt;Alk. %;Whisky-Bild;Whiskybase;Durchschnitt\n"; 
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
            csv += `${t.number || ''};${t.name};${t.date};${t.image || ''};${w.flight || 1};${w.name};${w.cask || ''};${w.finish || ''};${w.distillery || ''};${w.type || ''};${w.country || ''};${w.age || ''};${w.vintage || ''};${w.bottled || ''};${abv};${w.image || ''};${w.wbLink || ''};${avg.replace('.', ',')}\n`; 
        }); 
    }); 
    let a = document.createElement("a"); 
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'})); 
    a.download = `DramScore_Alle_Tastings.csv`; 
    a.click(); 
}

// ==========================================
// HALL OF FAME / STATISTIKEN
// ==========================================

function loadStats() {
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || []; let globalWhiskys = {}; let allParticipants = new Set();
    tastings.forEach(t => { if(t.participants) t.participants.forEach(p => allParticipants.add(p)); if(t.whiskies) { t.whiskies.forEach((w, i) => { let key = w.name + '|' + (w.distillery || '') + '|' + (w.age || '') + '|' + (w.cask || '') + '|' + (w.finish || ''); if(!globalWhiskys[key]) globalWhiskys[key] = { ...w, tot: 0, count: 0 }; if(t.participants) { t.participants.forEach(p => { let r = t.ratings && t.ratings[p] ? t.ratings[p][i] : null; if(r && r.overall && !isNaN(parseFloat(r.overall))) { globalWhiskys[key].tot += parseFloat(r.overall); globalWhiskys[key].count++; } }); } }); } });
    let globalArr = Object.values(globalWhiskys).filter(w => w.count > 0).map(w => { w.avg = w.tot / w.count; return w; });
    let globalTop10 = [...globalArr].sort((a,b) => b.avg - a.avg).slice(0, 10);
    let globalFlop10 = [...globalArr].sort((a,b) => a.avg - b.avg).slice(0, 10);
    let gHtml = ''; globalTop10.forEach((w, idx) => { let borderCol = idx === 0 ? '#f1c40f' : (idx === 1 ? '#bdc3c7' : (idx === 2 ? '#cd7f32' : '#444')); let cF = []; if(w.cask) cF.push(`Fass: ${w.cask}`); if(w.finish) cF.push(`Finish: ${w.finish}`); let caskHtml = cF.length > 0 ? `<br><span style="font-size:12px; color:#aaa; font-style:italic;">${cF.join('<br>')}</span>` : ""; gHtml += `<div class="result-card" style="border-color: ${borderCol};" onclick="showDetailCard('${encodeURIComponent(JSON.stringify(w)).replace(/'/g, "%27")}')"><div style="display:flex; justify-content:space-between; align-items:center;"><div style="text-align:left;"><strong>${w.name}${w.age ? ' ('+w.age+'J)' : ''}${w.image ? ' 📸' : ''}</strong>${caskHtml}<br><span style="font-size:12px; color:#ccc;">${w.distillery || '-'}</span></div><div class="score-badge" style="margin:0;">Ø ${parseFloat(w.avg).toFixed(2)}</div></div></div>`; });
    document.getElementById('global-top-container').innerHTML = gHtml || "<p>Keine Daten.</p>";
    let fHtml = ''; globalFlop10.forEach((w) => { let cF = []; if(w.cask) cF.push(`Fass: ${w.cask}`); if(w.finish) cF.push(`Finish: ${w.finish}`); let caskHtml = cF.length > 0 ? `<br><span style="font-size:12px; color:#aaa; font-style:italic;">${cF.join('<br>')}</span>` : ""; fHtml += `<div class="result-card" style="border-color: #e74c3c;" onclick="showDetailCard('${encodeURIComponent(JSON.stringify(w)).replace(/'/g, "%27")}')"><div style="display:flex; justify-content:space-between; align-items:center;"><div style="text-align:left;"><strong>${w.name}${w.age ? ' ('+w.age+'J)' : ''}${w.image ? ' 📸' : ''}</strong>${caskHtml}<br><span style="font-size:12px; color:#ccc;">${w.distillery || '-'}</span></div><div class="score-badge" style="background:#e74c3c; margin:0;">Ø ${parseFloat(w.avg).toFixed(2)}</div></div></div>`; });
    document.getElementById('global-flop-container').innerHTML = fHtml || "<p>Keine Daten.</p>";
    let pSelect = document.getElementById('stat-participant-select'); pSelect.innerHTML = '<option value="">-- Auswahl --</option>'; Array.from(allParticipants).sort().forEach(p => { pSelect.innerHTML += `<option value="${p}">${p}</option>`; });
}

function showParticipantStats() {
    let pName = document.getElementById('stat-participant-select').value; let container = document.getElementById('participant-stat-container'); if(!pName) { container.innerHTML = ''; return; }
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || []; let myWhiskys = []; let distStats = {};
    tastings.forEach(t => { if(!t.participants || !t.participants.includes(pName) || !t.whiskies) return; t.whiskies.forEach((w, i) => { let r = t.ratings && t.ratings[pName] ? t.ratings[pName][i] : null; if(r && r.overall && !isNaN(parseFloat(r.overall))) { let score = parseFloat(r.overall); myWhiskys.push({ ...w, score: score, tasting: t.name, tastingId: t.id }); if(w.distillery) { if(!distStats[w.distillery]) distStats[w.distillery] = { tot: 0, count: 0 }; distStats[w.distillery].tot += score; distStats[w.distillery].count++; } } }); });
    if(myWhiskys.length === 0) { container.innerHTML = "<p>Keine Daten.</p>"; return; }
    let top10 = [...myWhiskys].sort((a,b) => b.score - a.score).slice(0, 10);
    let bestDist = { name: '-', avg: 0 }; Object.keys(distStats).forEach(d => { let avg = distStats[d].tot / distStats[d].count; if(avg > bestDist.avg) bestDist = { name: d, avg: avg }; });
    let html = `<div style="background:#222; padding:15px; border-radius:8px; margin-bottom:20px; text-align:center; border: 1px solid #444;"><div>🥃 ${myWhiskys.length} bewertet</div><div style="color:#3498db; font-weight:bold;">${bestDist.name}</div><div style="font-size:12px; color:#aaa;">Lieblings-Destille (Ø ${parseFloat(bestDist.avg).toFixed(2)})</div></div><h3 style="color:#2ecc71; text-align:center;">🏆 Top 10</h3>`;
    top10.forEach((w, idx) => { let bc = idx === 0 ? '#f1c40f' : (idx === 1 ? '#bdc3c7' : (idx === 2 ? '#cd7f32' : '#444')); html += `<div class="result-card" style="border-color: ${bc};" onclick="showDetailCard('${encodeURIComponent(JSON.stringify(w)).replace(/'/g, "%27")}')"><div style="display:flex; justify-content:space-between; align-items:center;"><div style="text-align:left;"><strong>${w.name}</strong><br><span style="font-size:11px; color:#999;">in: <span style="color:#3498db; text-decoration:underline;" onclick="event.stopPropagation(); showTastingResults('${w.tastingId}')">${w.tasting}</span></span></div><div class="score-badge" style="background:#2ecc71; margin:0;">${parseFloat(w.score).toFixed(2)}</div></div></div>`; });
    container.innerHTML = html;
}

function loadCabinet() {
    let tastings = JSON.parse(localStorage.getItem('whiskyTastings')) || []; let cabinetWhiskys = {};
    tastings.forEach(t => { if(t.whiskies) { t.whiskies.forEach((w, i) => { let key = w.name + '|' + (w.distillery || '') + '|' + (w.age || '') + '|' + (w.cask || '') + '|' + (w.finish || ''); if(!cabinetWhiskys[key]) { cabinetWhiskys[key] = { ...w, tot: 0, count: 0, tastingsRef: [], comments: w.comments || [] }; } else if (w.comments && w.comments.length > 0) { cabinetWhiskys[key].comments = w.comments; } let tLabel = t.number ? `#${t.number} ${t.name}` : t.name; if(!cabinetWhiskys[key].tastingsRef.find(tr => tr.id === t.id)) { cabinetWhiskys[key].tastingsRef.push({ id: t.id, label: tLabel }); } if(t.participants) { t.participants.forEach(p => { let r = t.ratings && t.ratings[p] ? t.ratings[p][i] : null; if(r && r.overall && !isNaN(parseFloat(r.overall))) { cabinetWhiskys[key].tot += parseFloat(r.overall); cabinetWhiskys[key].count++; } }); } }); } });
    let arr = Object.values(cabinetWhiskys).sort((a,b) => a.name.localeCompare(b.name)); let html = '';
    arr.forEach(w => {
        let avg = w.count > 0 ? (w.tot / w.count).toFixed(2) : "0.00";
        let ageStr = w.age ? (isNaN(w.age) ? w.age : `${w.age}J`) : '-';
        let tStr = w.tastingsRef.map(tr => `<span style="color: #3498db; text-decoration: underline;" onclick="event.stopPropagation(); showTastingResults('${tr.id}')">${tr.label}</span>`).join(', ');
        html += `<div class="result-card cabinet-card" onclick="showDetailCard('${encodeURIComponent(JSON.stringify(w)).replace(/'/g, "%27")}')"><div style="display: flex; gap: 15px;">${w.image ? `<img src="${w.image}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid #555;">` : `<div style="width: 80px; height: 80px; border-radius: 8px; background: #222; border: 1px dashed #555; display: flex; align-items: center; justify-content: center; font-size: 24px;">🥃</div>`}<div style="flex: 1; text-align:left;"><h3 style="margin: 0;">${w.name}</h3><div style="font-size: 12px; color: #ccc;">${w.distillery || '-'}</div><div style="margin-top: 10px; font-size: 11px; color: #999; border-top: 1px solid #444; padding-top: 6px;">🗓️ ${tStr}</div></div><div class="score-badge" style="margin: 0; font-size: 16px;">Ø ${avg}</div></div></div>`;
    });
    document.getElementById('cabinet-container').innerHTML = html || "<p>Schrank leer.</p>";
}

function filterCabinet() {
    let q = document.getElementById('search-cabinet').value.toLowerCase();
    document.querySelectorAll('.cabinet-card').forEach(c => { c.style.display = c.innerText.toLowerCase().includes(q) ? 'block' : 'none'; });
}
