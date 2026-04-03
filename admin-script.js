/* Smart Election Admin Control V3 Premium */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxrBQ5yDzwfAmyTWgNW2ZFXMD99MQftiuLlPdSGyEHCO9_LqgXU4V67GJhQCxQ-s_je6w/exec";

let partyChart, regionChart;
let globalData = { voters: [], candidates: [], parties: [], votes: [] };

// 1. Authentication V3 (SHA-256 Hashing)
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkAuth() {
    const input = document.getElementById('adminPass').value;
    const inputHash = await sha256(input);

    const secureHash = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

    if (inputHash === secureHash) {
        loginSuccess();
    } else {
        const err = document.getElementById('authError');
        err.classList.remove('d-none');
        err.classList.add('animate__animated', 'animate__shakeX');
        setTimeout(() => err.classList.remove('animate__shakeX'), 500);
    }
}

function loginSuccess() {
    sessionStorage.setItem('admin_auth', 'true');
    document.getElementById('authOverlay').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('authOverlay').classList.add('d-none');
        document.getElementById('adminContent').classList.remove('d-none');
        reloadData();
    }, 400);
}

function logout() {
    sessionStorage.removeItem('admin_auth');
    location.reload();
}

// Auto-login Check on Refresh
window.onload = () => {
    if (sessionStorage.getItem('admin_auth') === 'true') {
        document.getElementById('authOverlay').classList.add('d-none');
        document.getElementById('adminContent').classList.remove('d-none');
        reloadData();
    }

    // 🔀 Tab Sychronizer and Fix for Mobile Tabs
    document.querySelectorAll('[data-bs-toggle="pill"]').forEach(btn => {
        btn.addEventListener('show.bs.tab', function (e) {
            const target = e.target.getAttribute('data-bs-target');
            // Sync all identical buttons (Sidebar vs Mobile)
            document.querySelectorAll(`[data-bs-target="${target}"]`).forEach(el => {
                if (el !== e.target) el.classList.add('active');
            });
            // Untoggle others
            const others = document.querySelectorAll(`[data-bs-toggle="pill"]:not([data-bs-target="${target}"])`);
            others.forEach(el => el.classList.remove('active'));
        });

        // Manual Trigger for Mobile devices that might miss Bootstrap event
        btn.onclick = function (e) {
            const targetId = this.getAttribute('data-bs-target').substring(1);
            const pane = document.getElementById(targetId);
            if (pane) {
                // Remove active from all panes
                document.querySelectorAll('.tab-pane').forEach(p => {
                    p.classList.remove('show', 'active');
                });
                // Add active to target pane
                pane.classList.add('show', 'active');

                // Sync UI Buttons
                const allTriggers = document.querySelectorAll('[data-bs-toggle="pill"]');
                allTriggers.forEach(t => t.classList.remove('active'));
                document.querySelectorAll(`[data-bs-target="#${targetId}"]`).forEach(t => t.classList.add('active'));
            }
        };
    });
};

// 2. Data Fetching
async function reloadData() {
    showTableLoaders();
    try {
        const response = await fetch(SCRIPT_URL);
        globalData = await response.json();

        // Populate Settings UI
        if (globalData.settings) {
            const startInput = document.getElementById('startTime');
            const endInput = document.getElementById('endTime');

            // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
            const formatDateForInput = (dateStr) => {
                if (!dateStr) return "";
                if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateStr)) return dateStr;
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return dateStr;
                const pad = (n) => n.toString().padStart(2, '0');
                const y = d.getFullYear();
                const m = pad(d.getMonth() + 1);
                const day = pad(d.getDate());
                const h = pad(d.getHours());
                const min = pad(d.getMinutes());
                return `${y}-${m}-${day}T${h}:${min}`;
            };

            if (startInput && globalData.settings.startTime) {
                startInput.value = formatDateForInput(globalData.settings.startTime);
            }
            if (endInput && globalData.settings.endTime) {
                endInput.value = formatDateForInput(globalData.settings.endTime);
            }
            
            if (globalData.settings.seatDivisor) {
                document.getElementById('seatDivisor').value = globalData.settings.seatDivisor;
            }
            if (globalData.settings.seatFormula) {
                const seatFormulaEl = document.getElementById('seatFormula');
                if (seatFormulaEl) seatFormulaEl.value = globalData.settings.seatFormula;
            }
        }

        updateUI();
    } catch (err) {
        console.error("API Fetch Error:", err);
    }
}

function showTableLoaders() {
    const loadingHTML = `<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary spinner-border-sm me-2"></div> กำลังโหลดข้อมูล...</td></tr>`;
    document.getElementById('voterTableBody').innerHTML = loadingHTML;
    document.getElementById('candidateTableBody').innerHTML = loadingHTML;
    document.getElementById('partyTableBody').innerHTML = loadingHTML;
}

// 3. UI Rendering V3
function updateUI() {
    const votes = globalData.votes || [];
    const voters = globalData.voters || [];

    // Updates Metrics
    document.getElementById('totalVotes').textContent = votes.length.toLocaleString();
    document.getElementById('totalVoters').textContent = voters.length.toLocaleString();

    const rate = voters.length > 0 ? Math.round((votes.length / voters.length) * 100) : 0;
    document.getElementById('voteRate').textContent = rate + "%";

    // Animate Progress Bar
    const progressBar = document.getElementById('rateProgress');
    if (progressBar) {
        progressBar.style.width = rate + "%";
        if (rate > 80) progressBar.className = "progress-bar bg-success";
        else if (rate > 40) progressBar.className = "progress-bar bg-primary";
        else progressBar.className = "progress-bar bg-warning";
    }

    // Chart Data Preparation
    const partyCounts = {};
    const regionCounts = { 'east': 0, 'south': 0, 'north': 0, 'central': 0 };
    votes.forEach(v => {
        partyCounts[v.party] = (partyCounts[v.party] || 0) + 1;
        if (regionCounts.hasOwnProperty(v.region)) regionCounts[v.region]++;
    });
    renderCharts(partyCounts, regionCounts);

    // Render Tables
    renderVotersTable();
    renderCandidatesTable();
    renderPartiesTable();
    renderVotesLogTable();
    renderCandidateSummary();
    renderFullReport();
}

let editingId = null;

function renderVotersTable() {
    const body = document.getElementById('voterTableBody');
    body.innerHTML = '';

    // Create a Set for O(1) loop up
    const votedNames = new Set((globalData.votes || []).map(v => v.voter));

    (globalData.voters || []).slice().reverse().forEach(v => {
        const hasVoted = votedNames.has(v.name);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="ps-4"><div class="avatar-sm bg-primary-soft text-primary rounded-circle d-flex align-items-center justify-content-center" style="width:38px; height:38px;"><i class="bi bi-person-fill"></i></div></td>
            <td><div class="fw-bold text-bold">${v.name}</div><div class="small text-muted">ID: ${v.id}</div></td>
            <td><span class="badge bg-light text-dark rounded-pill px-3 fw-semibold border">${formatRegionName(v.region)}</span></td>
            <td>
                ${hasVoted ? '<span class="text-primary fw-bold small"><i class="bi bi-check-circle-fill me-1"></i> ใช้สิทธิแล้ว</span>' : '<span class="text-muted small fw-medium"><i class="bi bi-clock me-1"></i> ยังไม่มา</span>'}
            </td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-primary border-0 rounded-3 p-2 me-1" onclick="editEntry('VOTER', '${v.id}')"><i class="bi bi-pencil-square"></i></button>
                <button class="btn btn-sm btn-outline-danger border-0 rounded-3 p-2" onclick="deleteEntry('VOTER', '${v.id}')"><i class="bi bi-trash3-fill"></i></button>
            </td>
        `;
        body.appendChild(row);
    });
}

function renderCandidatesTable() {
    const body = document.getElementById('candidateTableBody');
    body.innerHTML = '';

    (globalData.candidates || []).forEach(c => {
        // ดึงค่ามาพักไว้ก่อนเพื่อความชัวร์ (เผื่อกรณีคอลัมน์ใน Sheet สลับกัน)
        // เราจะอ้างอิงจากคีย์ที่ดึงมาจาก Sheet Header โดยตรง
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="ps-4 fw-bold text-primary">เบอร์ ${c.number || '-'}</td>
            <td class="fw-bold text-bold">${c.name || 'ไม่มีชื่อ'}</td>
            <td><span class="badge bg-info-soft text-info rounded-pill px-3 fw-bold">${c.party || 'ไม่ระบุพรรค'}</span></td>
            <td><span class="badge bg-light text-dark rounded-pill px-3 fw-semibold border">${formatRegionName(c.region)}</span></td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-primary border-0 rounded-3 p-2 me-1" onclick="editEntry('CANDIDATE', '${c.id}')"><i class="bi bi-pencil-square"></i></button>
                <button class="btn btn-sm btn-outline-danger border-0 rounded-3 p-2" onclick="deleteEntry('CANDIDATE', '${c.id}')"><i class="bi bi-trash3-fill"></i></button>
            </td>
        `;
        body.appendChild(row);
    });
}

function renderPartiesTable() {
    const body = document.getElementById('partyTableBody');
    const overviewBody = document.getElementById('overviewPartyBody');
    const divisor = parseFloat(document.getElementById('seatDivisor').value) || 1;
    const formulaEl = document.getElementById('seatFormula');
    const formulaStr = formulaEl ? formulaEl.value : "(party * divisor) / total";
    const total = globalData.votes.length;

    body.innerHTML = '';
    if (overviewBody) overviewBody.innerHTML = '';

    const partyVotes = {};
    globalData.votes.forEach(v => {
        partyVotes[v.party] = (partyVotes[v.party] || 0) + 1;
    });

    (globalData.parties || []).forEach(p => {
        const party = partyVotes[p.name] || 0;
        const percent = total > 0 ? ((party / total) * 100).toFixed(1) : "0.0";

        let seats = "0.00";
        if (total > 0) {
            try {
                const calc = new Function('party', 'total', 'divisor', `return ${formulaStr}`);
                seats = calc(party, total, divisor).toFixed(2);
            } catch (e) {
                seats = "Err!";
            }
        }

        // 1. Render in Parties Tab
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="ps-4 fw-bold text-primary">เบอร์ ${p.number || '-'}</td>
            <td class="fw-bold text-bold">${p.name}</td>
            <td class="text-center"><span class="badge bg-light text-dark border px-3">${party.toLocaleString()}</span></td>
            <td class="text-center text-muted small">${percent}%</td>
            <td class="text-center"><span class="fw-bold text-primary" style="font-size: 1.1rem;">${seats}</span></td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-primary border-0 rounded-3 p-2 me-1" onclick="editEntry('PARTY', '${p.id}')"><i class="bi bi-pencil-square"></i></button>
                <button class="btn btn-sm btn-outline-danger border-0 rounded-3 p-2" onclick="deleteEntry('PARTY', '${p.id}')"><i class="bi bi-trash3-fill"></i></button>
            </td>
        `;
        body.appendChild(row);

        // 2. Render in Overview Tab (If exists)
        if (overviewBody) {
            const overviewRow = document.createElement('tr');
            overviewRow.innerHTML = `
                <td class="fw-bold"><span class="text-primary me-2">เบอร์ ${p.number || '-'}</span> ${p.name}</td>
                <td class="text-center"><span class="badge bg-light text-dark border px-3">${party.toLocaleString()}</span></td>
                <td class="text-center text-muted small">${percent}%</td>
                <td class="text-center"><span class="badge bg-primary-soft text-primary px-3 py-2 rounded-pill fs-6">${seats}</span></td>
            `;
            overviewBody.appendChild(overviewRow);
        }
    });

    const displayDivisor = document.getElementById('displayDivisor');
    if (displayDivisor) displayDivisor.textContent = divisor;
    
    const status = document.getElementById('calcStatus');
    if (status) {
        status.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> ข้อมูลอัปเดตอัตโนมัติเรียบร้อย`;
        status.classList.add('animate__animated', 'animate__fadeIn');
        setTimeout(() => status.classList.remove('animate__animated', 'animate__fadeIn'), 1000);
    }
}


function renderVotesLogTable() {
    const body = document.getElementById('votesLogTableBody');
    if (!body) return;

    body.innerHTML = '';
    const votes = (globalData.votes || []).slice().reverse(); // ล่าสุดอยู่บน

    if (votes.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">ยังไม่มีข้อมูลการลงคะแนน</td></tr>';
        return;
    }

    votes.forEach(v => {
        const row = document.createElement('tr');
        const date = v.timestamp ? new Date(v.timestamp).toLocaleString('th-TH') : '-';
        row.innerHTML = `
            <td class="small text-muted">${date}</td>
            <td class="fw-bold">${v.voter || '-'}</td>
            <td><span class="badge bg-light text-dark border">${formatRegionName(v.region)}</span></td>
            <td><span class="text-primary fw-medium">${v.candidate || '-'}</span></td>
            <td><span class="text-success fw-medium">${v.party || '-'}</span></td>
            <td class="small text-muted font-monospace">${v.ip || '-'}</td>
        `;
        body.appendChild(row);
    });
}

function exportToCSV() {
    const votes = globalData.votes || [];
    if (votes.length === 0) {
        alert("ไม่มีข้อมูลให้ส่งออก");
        return;
    }

    const headers = ["Timestamp", "Voter", "Region", "Candidate", "Party", "IP Address"];
    const rows = votes.map(v => [
        v.timestamp,
        v.voter,
        formatRegionName(v.region),
        v.candidate,
        v.party,
        v.ip
    ]);

    let csvContent = "\uFEFF"; // Add BOM for Excel Thai support
    csvContent += headers.join(",") + "\n";
    rows.forEach(row => {
        csvContent += row.map(field => `"${field}"`).join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `election_report_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderCandidateSummary() {
    const body = document.getElementById('overviewCandidateBody');
    if (!body) return;

    const candVotes = {};
    const candRegion = {};
    globalData.votes.forEach(v => {
        if (v.candidate && v.candidate !== 'ไม่ได้เลือก' && v.candidate !== 'ไม่ประสงค์ลงคะแนน') {
            candVotes[v.candidate] = (candVotes[v.candidate] || 0) + 1;
            candRegion[v.candidate] = v.region;
        }
    });

    const sortedCands = Object.keys(candVotes).sort((a, b) => candVotes[b] - candVotes[a]);

    body.innerHTML = '';
    if (sortedCands.length === 0) {
        body.innerHTML = '<tr><td colspan="3" class="text-center py-3 text-muted small">ยังไม่มีข้อมูล</td></tr>';
        return;
    }

    sortedCands.forEach(name => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="fw-bold">${name}</td>
            <td><span class="badge bg-light text-dark border">${formatRegionName(candRegion[name]) || '-'}</span></td>
            <td class="text-center"><span class="badge bg-primary px-3 fw-bold">${candVotes[name].toLocaleString()}</span></td>
        `;
        body.appendChild(row);
    });
}

function renderFullReport() {
    const reportDate = document.getElementById('reportDate');
    if (!reportDate) return;

    reportDate.innerText = new Date().toLocaleString('th-TH');

    // Metrics
    const votes = globalData.votes || [];
    const voters = globalData.voters || [];
    const noVotes = votes.filter(v => v.candidate === 'ไม่ประสงค์ลงคะแนน' || v.candidate === 'ไม่ได้เลือก').length;

    document.getElementById('reportTotalVotes').innerText = votes.length.toLocaleString();
    document.getElementById('reportTotalVoters').innerText = voters.length.toLocaleString();
    document.getElementById('reportVoteRate').innerText = (voters.length > 0 ? Math.round((votes.length / voters.length) * 100) : 0) + "%";
    document.getElementById('reportNoVote').innerText = noVotes.toLocaleString();

    // Party List
    const partyStats = {};
    votes.forEach(v => { if (v.party && v.party !== 'ไม่ประสงค์ลงคะแนน') partyStats[v.party] = (partyStats[v.party] || 0) + 1; });

    const partyContainer = document.getElementById('reportPartyList');
    partyContainer.innerHTML = '';
    (globalData.parties || []).forEach(p => {
        const count = partyStats[p.name] || 0;
        const col = document.createElement('div');
        col.className = 'col';
        col.innerHTML = `
            <div class="d-flex justify-content-between p-3 border rounded-4 bg-light bg-opacity-50">
                <span class="fw-bold"><span class="text-primary me-2">เบอร์ ${p.number}</span> ${p.name}</span>
                <span class="fw-bold">${count.toLocaleString()} คะแนน</span>
            </div>
        `;
        partyContainer.appendChild(col);
    });

    // Regional Winners
    const regionWinners = {};
    votes.forEach(v => {
        if (v.candidate && v.candidate !== 'ไม่ประสงค์ลงคะแนน' && v.candidate !== 'ไม่ได้เลือก') {
            if (!regionWinners[v.region]) regionWinners[v.region] = {};
            regionWinners[v.region][v.candidate] = (regionWinners[v.region][v.candidate] || 0) + 1;
        }
    });

    const winnerTable = document.getElementById('reportRegionalWinners');
    winnerTable.innerHTML = '';
    ['central', 'north', 'south', 'east'].forEach(r => {
        const cands = regionWinners[r] || {};
        const topCand = Object.keys(cands).reduce((a, b) => cands[a] > cands[b] ? a : b, null);
        const winCount = topCand ? cands[topCand] : 0;

        // Find candidate party
        const candData = globalData.candidates.find(c => c.name === topCand);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="fw-bold">${formatRegionName(r)}</td>
            <td>${topCand || '<span class="text-muted">ยังไม่มีข้อมูล</span>'}</td>
            <td class="text-center">${candData ? candData.party : '-'}</td>
            <td class="text-center fw-bold">${winCount.toLocaleString()}</td>
        `;
        winnerTable.appendChild(row);
    });
}

async function saveSettings() {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;

    const btn = document.querySelector('button[onclick="saveSettings()"]');
    const originalText = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> กำลังบันทึก...`;

        await callAPI('UPDATE_SETTINGS', { startTime, endTime });
        await reloadData(); // Sync with server for certainty
        alert("บันทึกการตั้งค่าเวลาเรียบร้อยแล้ว");
    } catch (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function saveFormula() {
    const seatDivisor = document.getElementById('seatDivisor').value;
    const seatFormulaEl = document.getElementById('seatFormula');
    const seatFormula = seatFormulaEl ? seatFormulaEl.value : "(party * divisor) / total";

    const btn = document.getElementById('btnSaveFormula');
    if (!btn) return;

    const originalText = btn.innerHTML;
    try {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

        // We fetch current settings from API response and map it to save all settings fields together to avoid overriding missing fields
        const currentData = globalData.settings || {};
        const updateData = {
            ...currentData,
            seatDivisor: seatDivisor,
            seatFormula: seatFormula
        };

        await callAPI('UPDATE_SETTINGS', updateData);
        alert("บันทึกสูตรคำนวณเรียบร้อยแล้ว");
    } catch (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// 4. API Core Actions (Optimized for Speed)
async function callAPI(action, data = {}, id = null) {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, data, id })
        });

        const res = await response.json();
        if (res.result === "success") {
            // ไม่ต้อง reloadData() ทั้งหมดทุุกครั้ง ให้แก้ไขที่ตัวแปร globalData โดยตรง
            handleLocalStateUpdate(action, data, res.id || id);
            return true;
        } else {
            alert("Error: " + res.message);
            reloadData(); // ถ้าพลาดให้ดึงใหม่ทั้งหมดเพื่อซิงค์
            return false;
        }
    } catch (e) {
        console.error("API Call Error:", e);
        alert("ไม่สามารถติดต่อเซิร์ฟเวอร์ได้");
        reloadData();
    }
    return false;
}

// ฟังก์ชันช่่วยอัปเดตข้อมูลในเครื่องทันทีเพื่อให้รู้สึกเร็ว (Optimistic UI)
function handleLocalStateUpdate(action, data, id) {
    if (action.startsWith('ADD_')) {
        const type = action.replace('ADD_', '').toLowerCase() + 's';
        if (globalData[type]) {
            globalData[type].push({ ...data, id });
        }
    } else if (action.startsWith('DELETE_')) {
        const type = action.replace('DELETE_', '').toLowerCase() + 's';
        if (globalData[type]) {
            globalData[type] = globalData[type].filter(item => item.id !== id);
        }
    } else if (action === 'BATCH_ADD_VOTERS') {
        data.names.forEach((name, i) => {
            globalData.voters.push({ name, region: data.region, id: "TEMP-" + i });
        });
        // สำหรับ Batch แนะนำให้ reloadData ทีหลังเพื่อเอา ID จริง
        setTimeout(reloadData, 1500);
    } else if (action === 'RESET_VOTES') {
        globalData.votes = [];
    } else if (action === 'UPDATE_SETTINGS') {
        globalData.settings = { ...globalData.settings, ...data };
    }

    updateUI(); // วาดตารางใหม่ทันทีจากข้อมูลในหน่วยความจำ
}

// Modals & Management
function editEntry(type, id) {
    editingId = id;
    if (type === 'VOTER') {
        const v = globalData.voters.find(x => x.id === id);
        if (v) {
            document.getElementById('newVoterName').value = v.name || '';
            document.getElementById('newVoterRegion').value = v.region || 'central';
            document.getElementById('single-tab').click();
            new bootstrap.Modal('#addVoterModal').show();
        }
    } else if (type === 'CANDIDATE') {
        const c = globalData.candidates.find(x => x.id === id);
        if (c) {
            document.getElementById('newCandidateName').value = c.name || '';
            document.getElementById('newCandidateNumber').value = c.number || '';
            document.getElementById('newCandidateRegion').value = c.region || 'central';
            updatePartyDropdowns();
            document.getElementById('newCandidateParty').value = c.party || '';
            document.getElementById('single-cand-tab').click();
            new bootstrap.Modal('#addCandidateModal').show();
        }
    } else if (type === 'PARTY') {
        const p = globalData.parties.find(x => x.id === id);
        if (p) {
            document.getElementById('newPartyNumber').value = p.number || '';
            document.getElementById('newPartyName').value = p.name || '';
            document.getElementById('single-party-tab').click();
            new bootstrap.Modal('#addPartyModal').show();
        }
    }
}

// Modals & Management
function openAddVoterModal() { editingId = null; document.getElementById('newVoterName').value = ''; new bootstrap.Modal('#addVoterModal').show(); }
async function saveVoter() {
    const region = document.getElementById('newVoterRegion').value;
    const isSingle = document.getElementById('single-tab').classList.contains('active');
    const btn = document.getElementById('btnSaveVoter');

    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> กำลังบันทึก...';

    try {
        if (isSingle) {
            const name = document.getElementById('newVoterName').value.trim();
            if (name) {
                if (editingId) {
                    await callAPI('UPDATE_VOTER', { name, region }, editingId);
                } else {
                    await callAPI('ADD_VOTER', { name, region });
                }
                document.getElementById('newVoterName').value = '';
            } else {
                alert("กรุณาระบุชื่อ-นามสกุล");
                return;
            }
        } else {
            const bulkText = document.getElementById('bulkVoterNames').value;
            const names = bulkText.split('\n').map(n => n.trim()).filter(n => n.length > 0);
            if (names.length > 0) {
                await callAPI('BATCH_ADD_VOTERS', { names, region });
                document.getElementById('bulkVoterNames').value = '';
            } else {
                alert("กรุณาป้อนรายชื่ออย่างน้อย 1 รายการ");
                btn.disabled = false;
                btn.innerHTML = originalHTML;
                return;
            }
        }
        bootstrap.Modal.getInstance(document.getElementById('addVoterModal')).hide();
    } catch (e) {
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

function updatePartyDropdowns() {
    const dropdown = document.getElementById('newCandidateParty');
    if (!dropdown) return;

    const currentVal = dropdown.value;
    dropdown.innerHTML = '<option value="">-- เลือกพรรค --</option>';
    (globalData.parties || []).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = p.name;
        dropdown.appendChild(opt);
    });
    dropdown.value = currentVal;
}

// Candidates & Parties Management
function openAddCandidateModal() {
    editingId = null;
    document.getElementById('newCandidateName').value = '';
    document.getElementById('newCandidateNumber').value = '';
    updatePartyDropdowns();
    new bootstrap.Modal('#addCandidateModal').show();
}

async function saveCandidate() {
    const region = document.getElementById('newCandidateRegion').value;
    const party = document.getElementById('newCandidateParty').value;
    const isSingle = document.getElementById('single-cand-tab').classList.contains('active');
    const btn = document.getElementById('btnSaveCandidate');

    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> กำลังบันทึก...';

    try {
        if (isSingle) {
            const name = document.getElementById('newCandidateName').value.trim();
            const number = document.getElementById('newCandidateNumber').value;
            if (name && number) {
                if (editingId) {
                    await callAPI('UPDATE_CANDIDATE', { name, region, number, party }, editingId);
                } else {
                    await callAPI('ADD_CANDIDATE', { name, region, number, party });
                }
                document.getElementById('newCandidateName').value = '';
                document.getElementById('newCandidateNumber').value = '';
                bootstrap.Modal.getInstance(document.getElementById('addCandidateModal')).hide();
            } else {
                alert("กรุณาระบุชื่อและเบอร์ผู้สมัคร");
                return;
            }
        } else {
            const bulkText = document.getElementById('bulkCandidateNames').value;
            const names = bulkText.split('\n').map(n => n.trim()).filter(n => n.length > 0);
            if (names.length > 0) {
                await callAPI('BATCH_ADD_CANDIDATES', { names, region, party });
                document.getElementById('bulkCandidateNames').value = '';
                bootstrap.Modal.getInstance(document.getElementById('addCandidateModal')).hide();
            } else {
                alert("กรุณาป้อนรายชื่ออย่างน้อย 1 รายการ");
            }
        }
    } catch (e) {
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

function openAddPartyModal() {
    editingId = null;
    document.getElementById('newPartyName').value = '';
    document.getElementById('newPartyNumber').value = '';
    new bootstrap.Modal('#addPartyModal').show();
}

async function saveParty() {
    const isSingle = document.getElementById('single-party-tab').classList.contains('active');
    const btn = document.getElementById('btnSaveParty');

    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> กำลังบันทึก...';

    try {
        if (isSingle) {
            const name = document.getElementById('newPartyName').value.trim();
            const number = document.getElementById('newPartyNumber').value;
            if (name) {
                if (editingId) {
                    await callAPI('UPDATE_PARTY', { name, number }, editingId);
                } else {
                    await callAPI('ADD_PARTY', { name, number });
                }
                document.getElementById('newPartyName').value = '';
                document.getElementById('newPartyNumber').value = '';
                bootstrap.Modal.getInstance(document.getElementById('addPartyModal')).hide();
            } else {
                alert("กรุณาระบุชื่อพรรคการเมือง");
                return;
            }
        } else {
            const bulkText = document.getElementById('bulkPartyNames').value;
            const names = bulkText.split('\n').map(n => n.trim()).filter(n => n.length > 0);
            if (names.length > 0) {
                await callAPI('BATCH_ADD_PARTIES', { names });
                document.getElementById('bulkPartyNames').value = '';
                bootstrap.Modal.getInstance(document.getElementById('addPartyModal')).hide();
            } else {
                alert("กรุณาป้อนชื่อพรรคอย่างน้อย 1 รายการ");
            }
        }
    } catch (e) {
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลพรรค");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

async function deleteEntry(type, id) {
    if (!id) {
        alert("ไม่พบรหัสข้อมููลที่ต้องการลบ");
        return;
    }

    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้?`)) {
        console.log(`Attempting to delete ${type} with ID:`, id);
        const success = await callAPI(`DELETE_${type}`, {}, id);
        if (success) {
            // โหลดข้อมูลใหม่หลังจากลบสำเร็จ
            await reloadData();
        }
    }
}

async function confirmResetVotes() {
    if (confirm("ล้างคะแนนเลือกตั้งทั้งหมด? ไม่สามารถกู้คืนได้!")) {
        await callAPI('RESET_VOTES');
    }
}

// 5. Utils & Charts
function formatRegionName(region) {
    const names = { 'east': 'ตะวันออก', 'south': 'ใต้', 'north': 'เหนือ', 'central': 'กลาง' };
    return names[region] || region;
}

function renderCharts(partyData, regionData) {
    if (partyChart) partyChart.destroy();
    if (regionChart) regionChart.destroy();

    const partyKeys = Object.keys(partyData);
    const regionKeys = Object.keys(regionData);

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false, // จะใช้การล็อคความสูงจาก container แทน
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    usePointStyle: true,
                    padding: 20,
                    font: { family: 'Sarabun', size: 12 }
                }
            },
            tooltip: { bodyFont: { family: 'Sarabun' }, titleFont: { family: 'Sarabun' } }
        }
    };

    // 1. Party Doughnut Chart
    partyChart = new Chart(document.getElementById('partyChart'), {
        type: 'doughnut',
        data: {
            labels: partyKeys.length > 0 ? partyKeys : ['ยังไม่มีคะแนน'],
            datasets: [{
                data: partyKeys.length > 0 ? Object.values(partyData) : [1],
                backgroundColor: partyKeys.length > 0 ? ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'] : ['#f1f5f9'],
                hoverOffset: 15, borderRadius: 10, borderWeight: 0, cutout: '65%'
            }]
        },
        options: {
            ...commonOptions,
            maintainAspectRatio: false, // ปรับให้เป็น false เพื่อไม่ให้ล้นความสูง 350px
        }
    });

    // 2. Region Bar Chart
    regionChart = new Chart(document.getElementById('regionChart'), {
        type: 'bar',
        data: {
            labels: regionKeys.length > 0 ? regionKeys.map(r => formatRegionName(r)) : ['รอข้อมูลภูมิภาค'],
            datasets: [{
                label: 'ผู้ใช้สิทธิ',
                data: regionKeys.length > 0 ? Object.values(regionData) : [0],
                backgroundColor: '#10b981',
                borderRadius: 8, barThickness: 25
            }]
        },
        options: {
            ...commonOptions,
            maintainAspectRatio: false,
            scales: {
                y: { grid: { display: true, color: '#f1f5f9' }, beginAtZero: true },
                x: { grid: { display: false } }
            }
        }
    });
}
