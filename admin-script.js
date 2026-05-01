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

    // 🔀 Tab Sychronizer and Fix for Mobile Tabs (Improved)
    document.querySelectorAll('[data-bs-toggle="pill"]').forEach(btn => {
        btn.addEventListener('show.bs.tab', function (e) {
            const target = e.target.getAttribute('data-bs-target');
            const parent = e.target.closest('.sidebar, .mobile-nav, .modal-body, .tab-content');
            
            // 1. Sidebar/Mobile Nav Synchronization
            if (e.target.closest('.sidebar, .mobile-nav')) {
                // Sync all identical buttons (Sidebar vs Mobile)
                document.querySelectorAll(`.sidebar [data-bs-target="${target}"], .mobile-nav [data-bs-target="${target}"]`).forEach(el => {
                    el.classList.add('active');
                });
                
                // Untoggle other sidebar/mobile buttons ONLY
                document.querySelectorAll(`.sidebar [data-bs-toggle="pill"]:not([data-bs-target="${target}"]), .mobile-nav [data-bs-toggle="pill"]:not([data-bs-target="${target}"])`).forEach(el => {
                    el.classList.remove('active');
                });
            } 
            // 2. Local Tab Groups (like inside Modals)
            else if (parent) {
                parent.querySelectorAll(`[data-bs-toggle="pill"]`).forEach(el => {
                    if (el.getAttribute('data-bs-target') === target) el.classList.add('active');
                    else el.classList.remove('active');
                });
            }
        });

        // Manual Trigger for Mobile/Static Panes
        btn.onclick = function (e) {
            const targetId = this.getAttribute('data-bs-target').substring(1);
            const pane = document.getElementById(targetId);
            if (pane) {
                const tabContent = pane.closest('.tab-content');
                if (tabContent) {
                    Array.from(tabContent.children).forEach(p => {
                        if (p.classList.contains('tab-pane')) p.classList.remove('show', 'active');
                    });
                }
                pane.classList.add('show', 'active');
            }
        };
    });
};

// 2. Data Fetching
async function reloadData() {
    showTableLoaders();
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'GET_DATA' })
        });
        const result = await response.json();
        
        if (result.result === "error") {
            throw new Error(result.message || "API Data Error");
        }
        
        // รับประกันว่าจะมีโครงสร้าง Array ตลอดเวลา ไม่ว่าเซิร์ฟเวอร์จะตอบอะไรมา
        globalData = {
            voters: result.voters || [],
            candidates: result.candidates || [],
            parties: result.parties || [],
            votes: result.votes || [],
            settings: result.settings || {}
        };

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
            
            if (globalData.settings.electionMode) {
                const modeRadio = document.querySelector(`input[name="electionMode"][value="${globalData.settings.electionMode}"]`);
                if (modeRadio) modeRadio.checked = true;
            }
        }

        updateUI();
    } catch (err) {
        console.error("API Fetch Error:", err);
        const errorHTML = `<tr><td colspan="9" class="text-center py-5 text-danger"><div class="bg-danger bg-opacity-10 rounded-4 p-4 d-inline-block border border-danger border-opacity-25 shadow-sm"><i class="bi bi-wifi-off fs-1 d-block mb-3"></i> <b class="fs-5">โหลดข้อมูลล้มเหลว</b><p class="small mt-2 mb-4" style="color: #64748b;">${err.message}</p><button class="btn btn-outline-danger mt-2 rounded-pill px-4 fw-bold" onclick="reloadData()"><i class="bi bi-arrow-repeat me-2"></i> ลองเชื่อมต่ออีกครั้ง</button></div></td></tr>`;
        
        const bodies = ['voterTableBody', 'candidateTableBody', 'partyTableBody', 'overviewPartyBody'];
        bodies.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = errorHTML;
        });
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
    
    // Updates Metrics (Show ALL)
    document.getElementById('totalVotes').textContent = votes.length.toLocaleString();
    document.getElementById('totalVoters').textContent = voters.length.toLocaleString();

    // 📍 Voter Regional Breakdown
    const voterRegionCounts = { 'reg1': 0, 'reg2': 0, 'reg3': 0, 'reg4': 0, 'reg5': 0 };
    voters.forEach(v => {
        if (voterRegionCounts.hasOwnProperty(v.region)) voterRegionCounts[v.region]++;
    });
    
    const voterBreakdownEl = document.getElementById('voterRegionBreakdown');
    if (voterBreakdownEl) {
        voterBreakdownEl.innerHTML = `
            <div class="mt-3 pt-3 border-top">
                <div class="row g-2">
                    ${Object.keys(voterRegionCounts).map(r => `
                        <div class="col-6 mb-2 text-start">
                            <div style="font-size: 0.7rem;" class="text-muted fw-bold text-uppercase">${formatRegionName(r)}</div>
                            <div class="fw-bold text-info">${voterRegionCounts[r].toLocaleString()} <span class="small fw-normal text-muted">คน</span></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

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

    // Chart Data Preparation - Show ALL regions
    const partyCounts = {};
    const regionCounts = { 'reg1': 0, 'reg2': 0, 'reg3': 0, 'reg4': 0, 'reg5': 0 };
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
    renderRegionStatusTable();
}

let editingId = null;

function renderVotersTable() {
    const body = document.getElementById('voterTableBody');
    body.innerHTML = '';
    
    const searchTerm = (document.getElementById('voterSearch')?.value || '').toLowerCase().trim();
    const votedNames = new Set((globalData.votes || []).map(v => v.voter));

    let voters = (globalData.voters || []).slice().reverse();
    if (searchTerm) {
        voters = voters.filter(v => 
            v.name.toLowerCase().includes(searchTerm) || 
            v.id.toString().toLowerCase().includes(searchTerm) ||
            formatRegionName(v.region).toLowerCase().includes(searchTerm)
        );
    }

    voters.forEach(v => {
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
    
    const searchTerm = (document.getElementById('candidateSearch')?.value || '').toLowerCase().trim();

    let candidates = (globalData.candidates || []);
    if (searchTerm) {
        candidates = candidates.filter(c => 
            (c.name || '').toLowerCase().includes(searchTerm) || 
            (c.party || '').toLowerCase().includes(searchTerm) ||
            (c.number || '').toString().includes(searchTerm) ||
            formatRegionName(c.region).toLowerCase().includes(searchTerm)
        );
    }

    candidates.forEach(c => {
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
    body.innerHTML = '';
    if (overviewBody) overviewBody.innerHTML = '';
    const registeredParties = (globalData.parties || []).map(p => p.name);

    // Show ALL votes in table
    const filteredVotes = globalData.votes || [];
    const total = filteredVotes.length;

    const partyVotes = {};
    filteredVotes.forEach(v => {
        partyVotes[v.party] = (partyVotes[v.party] || 0) + 1;
    });

    const validTotal = filteredVotes.filter(v => registeredParties.includes(v.party)).length;

    // Calculate Regional Winners (ส.ส. เขต)
    const regionWinnerSeats = {}; // party name -> seat count
    const regions = ['reg1', 'reg2', 'reg3', 'reg4', 'reg5'];
    const candidates = globalData.candidates || [];

    regions.forEach(r => {
        const rVotes = filteredVotes.filter(v => v.region === r && v.candidate && v.candidate !== 'ไม่ประสงค์ลงคะแนน' && v.candidate !== 'ไม่ได้เลือก');
        if (rVotes.length > 0) {
            const counts = {};
            rVotes.forEach(v => counts[v.candidate] = (counts[v.candidate] || 0) + 1);
            // ค้นหาผู้ที่มีคะแนนสูงสุดในเขตนั้น
            const winnerName = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
            if (counts[winnerName] > 0) {
                const cand = candidates.find(c => c.name === winnerName);
                if (cand && cand.party) {
                    regionWinnerSeats[cand.party] = (regionWinnerSeats[cand.party] || 0) + 1;
                }
            }
        }
    });
    let sumPartyVotes = 0;
    let sumRegSeats = 0;
    let sumListSeats = 0;
    let sumTotalSeats = 0;

    (globalData.parties || []).forEach(p => {
        const party = partyVotes[p.name] || 0;
        const percent = total > 0 ? ((party / total) * 100).toFixed(1) : "0.0";
        
        // Robust key access
        const p_list_count = p.list_count !== undefined ? p.list_count : (p.listCount !== undefined ? p.listCount : 0);
        const p_constituency_count = p.constituency_count !== undefined ? p.constituency_count : (p.constituencyCount !== undefined ? p.constituencyCount : 0);
        
        const maxListSeats = parseInt(p_list_count) || 0;
        const constituency_count_val = parseInt(p_constituency_count) || 0;

        let seats = 0;
        let originalSeats = 0;
        let isCapped = false;

        if (total > 0 && validTotal > 0) {
            try {
                // ให้เลือกใช้ validTotal เป็นหลักเพื่อให้ยอดรวมพรรคได้ใกล้เคียง 11 (divisor) ที่สุด
                let effectiveFormula = formulaStr;
                if (effectiveFormula === "(party * divisor) / total") {
                    effectiveFormula = "(party * divisor) / validTotal";
                }
                
                const finalCalc = new Function('party', 'total', 'validTotal', 'divisor', `return ${effectiveFormula}`);
                const rawSeats = finalCalc(party, total, validTotal, divisor);
                
                // ปัดเศษตามคำขอ (Round to nearest integer)
                originalSeats = Math.round(rawSeats);
                seats = isNaN(originalSeats) ? 0 : originalSeats;

                // ตรวจสอบการจำกัดจำนวนบัญชีรายชื่อ (Capping)
                if (maxListSeats > 0 && seats > maxListSeats) {
                    seats = maxListSeats;
                    isCapped = true;
                }
            } catch (e) {
                seats = 0;
            }
        }


        const regSeats = regionWinnerSeats[p.name] || 0;
        const totalSeats = parseInt(regSeats) + (parseInt(seats) || 0);

        sumPartyVotes += party;
        sumRegSeats += regSeats;
        sumListSeats += (parseInt(seats) || 0);
        sumTotalSeats += totalSeats;


        // 1. Render in Parties Tab
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="ps-4 fw-bold text-primary">เบอร์ ${p.number || '-'}</td>
            <td class="fw-bold text-bold">${p.name}</td>
            <td class="text-center"><span class="badge bg-light text-muted border px-3">${constituency_count_val > 0 ? constituency_count_val + ' คน' : 'ไม่ระบุ'}</span></td>
            <td class="text-center"><span class="badge bg-light text-muted border px-3">${maxListSeats > 0 ? maxListSeats + ' คน' : 'ไม่ระบุ'}</span></td>
            <td class="text-center"><span class="badge bg-light text-dark border px-3">${party.toLocaleString()}</span></td>
            <td class="text-center"><span class="fw-bold">${regSeats}</span></td>
            <td class="text-center">
                <span class="fw-bold ${isCapped ? 'text-danger' : 'text-muted'}">${seats}</span>
                ${isCapped ? `<i class="bi bi-exclamation-triangle-fill text-danger ms-1" title="จำกัดแค่ ${p_list_count} ตามที่ส่งจริง (จากเดิม ${originalSeats})"></i>` : ''}
            </td>
            <td class="text-center"><span class="fw-bold text-primary" style="font-size: 1.1rem;">${totalSeats}</span></td>
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
                <td class="text-center"><span class="fw-bold text-muted">${regSeats}</span></td>
                <td class="text-center">
                    <span class="fw-bold ${isCapped ? 'text-danger' : 'text-muted'}">${seats}</span>
                </td>
                <td class="text-center"><span class="badge bg-primary-soft text-primary px-3 py-2 rounded-pill fs-6">${totalSeats}</span></td>
            `;
            overviewBody.appendChild(overviewRow);
        }

    });

    // Add "No Vote / No Selected" row if there are such votes
    const noVotesCount = total - validTotal;
    if (noVotesCount > 0) {
        const percent = total > 0 ? ((noVotesCount / total) * 100).toFixed(1) : "0.0";
        let noVoteSeats = "-"; // ไม่ต้องมีเก้าอี้ตามคำสั่ง

        const noVoteRow = document.createElement('tr');
        noVoteRow.className = "table-light opacity-75";
        noVoteRow.innerHTML = `
            <td class="ps-4 italic text-muted" colspan="2"><i class="bi bi-slash-circle me-2"></i> ไม่ประสงค์ลงคะแนน / บัตรเสีย</td>
            <td class="text-center">-</td>
            <td class="text-center">-</td>
            <td class="text-center"><span class="badge bg-light text-muted border px-3">${noVotesCount.toLocaleString()}</span></td>
            <td class="text-center">-</td>
            <td class="text-center">-</td>
            <td class="text-center"><span class="fw-bold text-muted">${noVoteSeats}</span></td>
            <td class="text-end pe-4"></td>
        `;

        const noVoteOverviewRow = document.createElement('tr');
        noVoteOverviewRow.className = "table-light opacity-75";
        noVoteOverviewRow.innerHTML = `
            <td class="italic text-muted"><i class="bi bi-slash-circle me-2"></i> ไม่ประสงค์ลงคะแนน / อื่นๆ</td>
            <td class="text-center"><span class="badge bg-light text-muted border px-3">${noVotesCount.toLocaleString()}</span></td>
            <td class="text-center">-</td>
            <td class="text-center">-</td>
            <td class="text-center"><span class="badge bg-light text-muted px-3 py-2 rounded-pill fs-6">${noVoteSeats}</span></td>
        `;

        body.appendChild(noVoteRow);
        if (overviewBody) overviewBody.appendChild(noVoteOverviewRow);
        
        // Include in total votes
        sumPartyVotes += noVotesCount;
    }

    // Add Grand Total Row (Everything)
    const totalRow = document.createElement('tr');
    totalRow.className = "table-secondary fw-bold border-top border-2";
    totalRow.innerHTML = `
        <td class="ps-4" colspan="2"><i class="bi bi-calculator me-2"></i> รวมทั้งหมด (พรรค + ไม่ประสงค์)</td>
        <td class="text-center">-</td>
        <td class="text-center">-</td>
        <td class="text-center"><span class="badge bg-white text-dark border px-3">${sumPartyVotes.toLocaleString()}</span></td>
        <td class="text-center">${sumRegSeats}</td>
        <td class="text-center">${sumListSeats}</td>
        <td class="text-center"><span class="text-primary" style="font-size: 1.1rem;">${sumTotalSeats}</span></td>
        <td class="text-end pe-4"></td>
    `;
    body.appendChild(totalRow);

    if (overviewBody) {
        const overviewTotalRow = document.createElement('tr');
        overviewTotalRow.className = "table-secondary fw-bold border-top border-2";
        overviewTotalRow.innerHTML = `
            <td><i class="bi bi-calculator me-2"></i> รวมทั้งหมด</td>
            <td class="text-center"><span class="badge bg-white text-dark border px-3">${sumPartyVotes.toLocaleString()}</span></td>
            <td class="text-center">${sumRegSeats}</td>
            <td class="text-center">${sumListSeats}</td>
            <td class="text-center"><span class="badge bg-primary px-3 py-2 rounded-pill fs-6">${sumTotalSeats}</span></td>
        `;
        overviewBody.appendChild(overviewTotalRow);
    }





    // suggested fix for display issue
    const displayDivisor = document.getElementById('displayDivisor');
    if (displayDivisor) displayDivisor.textContent = divisor;
    
    // Suggest formula fix if it doesn't total to divisor
    const status = document.getElementById('calcStatus');
    if (status) {
        status.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> คำนวณจากยอดรวม ${filteredVotes.length} คะแนน (เฉพาะเขตที่เปิดหีบ)`;
        if (noVotesCount > 0) {
            status.innerHTML += ` <span class="text-warning small ms-2">(มีไม่ประสงค์ลงคะแนน ${noVotesCount})</span>`;
        }
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
    
    // ...

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
    ['reg1', 'reg2', 'reg3', 'reg4', 'reg5'].forEach(r => {
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
    const electionModeEl = document.querySelector('input[name="electionMode"]:checked');
    const electionMode = electionModeEl ? electionModeEl.value : 'both';

    const btn = document.querySelector('button[onclick="saveSettings()"]');
    if (!btn) return;
    const originalText = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> กำลังบันทึก...`;

        await callAPI('UPDATE_SETTINGS', { startTime, endTime, electionMode });
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
        alert("ไม่สามารถติดต่อเซิร์ฟเวอร์ได้: " + e.message);
        reloadData();
    }
    return false;
}

// ฟังก์ชันช่่วยอัปเดตข้อมูลในเครื่องทันทีเพื่อให้รู้สึกเร็ว (Optimistic UI)
function handleLocalStateUpdate(action, data, id) {
    let type = "";
    if (action.includes('_VOTER')) type = 'voters';
    else if (action.includes('_CANDIDATE')) type = 'candidates';
    else if (action.includes('_PARTY')) type = 'parties';

    if (action.startsWith('ADD_')) {
        if (globalData[type]) {
            globalData[type].push({ ...data, id });
        }
    } else if (action.startsWith('UPDATE_')) {
        if (globalData[type]) {
            const index = globalData[type].findIndex(item => String(item.id) === String(id));
            if (index !== -1) {
                globalData[type][index] = { ...globalData[type][index], ...data };
            }
        }
    } else if (action.startsWith('DELETE_')) {
        if (globalData[type]) {
            globalData[type] = globalData[type].filter(item => String(item.id) !== String(id));
        }
    } else if (action === 'BATCH_ADD_VOTERS') {
        data.names.forEach((name, i) => {
            globalData.voters.push({ name, region: data.region, id: "TEMP-" + i });
        });
        setTimeout(reloadData, 1500);
    } else if (action === 'RESET_VOTES') {
        globalData.votes = [];
    } else if (action === 'UPDATE_SETTINGS') {
        globalData.settings = { ...globalData.settings, ...data };
    }

    updateUI(); 
}

// --- District Management Logic ---
function renderRegionStatusTable() {
    const body = document.getElementById('regionStatusTableBody');
    if (!body) return;

    const regions = [
        { id: 'reg1', name: 'เขต 1 (เชียงใหม่, เชียงราย, ลำพูน)' },
        { id: 'reg2', name: 'เขต 2 (ขอนแก่น, อุดรธานี)' },
        { id: 'reg3', name: 'เขต 3 (กทม., อยุธยา, นครราชสีมา)' },
        { id: 'reg4', name: 'เขต 4 (ภูเก็ต, นครศรีฯ, นนทบุรี)' },
        { id: 'reg5', name: 'เขต 5 (สงขลา)' }
    ];

    const openStatus = globalData.settings.region_open_status ? JSON.parse(globalData.settings.region_open_status) : {};
    
    body.innerHTML = '';
    regions.forEach(r => {
        const isOpen = openStatus[r.id] !== false; // Default is true if not set
        const regionVotesCount = (globalData.votes || []).filter(v => v.region === r.id).length;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="fw-bold fs-5">${r.name}</div>
                <div class="small text-muted">มีข้อมูลอยู่แล้ว: <strong>${regionVotesCount.toLocaleString()}</strong> คะแนน</div>
            </td>
            <td class="text-center">
                <div class="form-check form-switch d-inline-block">
                    <input class="form-check-input" type="checkbox" role="switch" id="switch-${r.id}" ${isOpen ? 'checked' : ''} onchange="toggleRegionOpen('${r.id}', this.checked)" style="width: 3.5em; height: 1.75em; cursor: pointer;">
                    <label class="form-check-label ms-2 fw-bold ${isOpen ? 'text-success' : 'text-danger'}" for="switch-${r.id}">
                        ${isOpen ? '<i class="bi bi-unlock-fill me-1"></i> เปิดหีบแล้ว' : '<i class="bi bi-lock-fill me-1"></i> ปิดหีบอยู่'}
                    </label>
                </div>
            </td>
            <td class="text-end">
                <button class="btn btn-outline-danger rounded-4 px-4 font-bold" onclick="confirmDeleteRegionData('${r.id}', '${r.name}')" ${regionVotesCount === 0 ? 'disabled' : ''}>
                    <i class="bi bi-trash3-fill me-2"></i> ลบข้อมูลคะแนนเขตนี้
                </button>
            </td>
        `;
        body.appendChild(row);
    });
}

async function toggleRegionOpen(regionId, isOpen) {
    const openStatus = globalData.settings.region_open_status ? JSON.parse(globalData.settings.region_open_status) : {};
    openStatus[regionId] = isOpen;
    
    try {
        await callAPI('UPDATE_SETTINGS', { region_open_status: JSON.stringify(openStatus) });
        // UI updates automatically via callAPI -> handleLocalStateUpdate -> updateUI
    } catch (e) {
        alert("ไม่สามารถบันทึกสถานะได้: " + e.message);
        reloadData();
    }
}

function confirmDeleteRegionData(regionId, regionName) {
    if (confirm(`⚠️ คุณแน่ใจหรือไม่ที่จะลบข้อมูลคะแนนทั้งหมดของ "${regionName}"?\n\nการลบนี้จะไม่สามารถย้อนกลับได้!`)) {
        deleteRegionData(regionId);
    }
}

async function deleteRegionData(regionId) {
    const btn = document.querySelector(`button[onclick*="deleteRegionData('${regionId}')"]`);
    if (btn) btn.disabled = true;

    try {
        const success = await callAPI('DELETE_REGION_DATA', { region: regionId });
        if (success) {
            // Local state update for DELETE_REGION_DATA is not handled in handleLocalStateUpdate yet
            globalData.votes = globalData.votes.filter(v => v.region !== regionId);
            updateUI();
            alert("ลบข้อมูลคะแนนรายเขตเรียบร้อยแล้ว");
        }
    } catch (e) {
        alert("เกิดข้อผิดพลาด: " + e.message);
    } finally {
        // No need to reload, local state updated
    }
}


// Modals & Management
function editEntry(type, id) {
    if (!id) return;
    editingId = id;
    const searchId = String(id).trim();
    console.log(`Editing ${type} with ID: ${searchId}`);
    
    if (type === 'VOTER') {
        const v = globalData.voters.find(x => String(x.id).trim() === searchId);
        if (v) {
            document.getElementById('newVoterName').value = v.name || '';
            document.getElementById('newVoterRegion').value = v.region || 'central';
            
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('addVoterModal'));
            modal.show();
            
            // Switch to single tab after showing modal to ensure element is accessible
            setTimeout(() => {
                const singleTab = document.getElementById('single-tab');
                if (singleTab) bootstrap.Tab.getOrCreateInstance(singleTab).show();
            }, 150);
        }
    } else if (type === 'CANDIDATE') {
        const c = globalData.candidates.find(x => String(x.id).trim() === searchId);
        if (c) {
            document.getElementById('newCandidateName').value = c.name || '';
            document.getElementById('newCandidateNumber').value = c.number || '';
            document.getElementById('newCandidateRegion').value = c.region || 'central';
            updatePartyDropdowns();
            document.getElementById('newCandidateParty').value = c.party || '';
            
            const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('addCandidateModal'));
            modal.show();

            setTimeout(() => {
                const singleTab = document.getElementById('single-cand-tab');
                if (singleTab) bootstrap.Tab.getOrCreateInstance(singleTab).show();
            }, 150);
        }
    } else if (type === 'PARTY') {
        const p = globalData.parties.find(x => String(x.id).trim() === searchId);
        if (p) {
            const listCount = p.list_count !== undefined ? p.list_count : (p.listCount !== undefined ? p.listCount : 0);
            const constCount = p.constituency_count !== undefined ? p.constituency_count : (p.constituencyCount !== undefined ? p.constituencyCount : 0);

            document.getElementById('newPartyNumber').value = String(p.number || '').trim();
            document.getElementById('newPartyName').value = String(p.name || '').trim();
            document.getElementById('newPartyListCount').value = listCount;
            document.getElementById('newPartyConstituencyCount').value = constCount;
            
            const modalEl = document.getElementById('addPartyModal');
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();

            // Use a slightly longer delay and more robust tab switching
            setTimeout(() => {
                const singleTab = document.getElementById('single-party-tab');
                if (singleTab) {
                    const tab = new bootstrap.Tab(singleTab);
                    tab.show();
                }
            }, 200);
        } else {
            console.error("Party not found for ID:", searchId, globalData.parties);
            alert("ไม่พบข้อมูลพรรคการเมือง ID: " + id);
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
    document.getElementById('newPartyListCount').value = '';
    document.getElementById('newPartyConstituencyCount').value = '';
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
            const list_count = parseInt(document.getElementById('newPartyListCount').value) || 0;
            const constituency_count = parseInt(document.getElementById('newPartyConstituencyCount').value) || 0;
            
            if (name) {
                if (editingId) {
                    await callAPI('UPDATE_PARTY', { name, number, list_count, constituency_count }, editingId);
                } else {
                    await callAPI('ADD_PARTY', { name, number, list_count, constituency_count });
                }
                document.getElementById('newPartyName').value = '';
                document.getElementById('newPartyNumber').value = '';
                document.getElementById('newPartyListCount').value = '';
                document.getElementById('newPartyConstituencyCount').value = '';
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
        // callAPI already handles local state update and UI refresh
    }
}

async function confirmResetVotes() {
    if (confirm("ล้างคะแนนเลือกตั้งทั้งหมด? ไม่สามารถกู้คืนได้!")) {
        await callAPI('RESET_VOTES');
    }
}

// 5. Utils & Charts
function formatRegionName(region) {
    const names = { 
        'reg1': 'เขต 1 (เชียงใหม่, เชียงราย, ลำพูน)', 
        'reg2': 'เขต 2 (ขอนแก่น, อุดรธานี)', 
        'reg3': 'เขต 3 (กทม., อยุธยา, นครราชสีมา)', 
        'reg4': 'เขต 4 (ภูเก็ต, นครศรีฯ, นนทบุรี)',
        'reg5': 'เขต 5 (สงขลา)'
    };
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
