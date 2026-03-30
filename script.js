/* Smart Election 2026 - Dynamic Flow V3 Premium */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxrBQ5yDzwfAmyTWgNW2ZFXMD99MQftiuLlPdSGyEHCO9_LqgXU4V67GJhQCxQ-s_je6w/exec"; 

let electionData = {
    voters: [],
    candidates: [],
    parties: [],
    votes: []
};

let currentRegion = "";

// 1. Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // โหลดข้อมูลเริ่มต้น
    await fetchElectionData();
    
    // ตั้งค่า UI เริ่มต้น
    initVoters();
    initParties();
    
    // ซ่อน Loader และแสดงฟอร์ม
    document.getElementById('globalLoader').classList.add('d-none');
    document.getElementById('electionForm').classList.remove('d-none');
    
    // Form Submission
    const form = document.getElementById('electionForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('.submit-btn');
        const originalText = submitBtn.innerHTML;
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> กำลังบันทึกคะแนน...';
        
        const success = await sendVoteData();
        if (success) {
            showSuccess();
            updateProgress(4); // ตัวแทนของขั้นตอนสำเร็จ
        } else {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
});

async function fetchElectionData() {
    try {
        const response = await fetch(SCRIPT_URL);
        electionData = await response.json();
    } catch (err) {
        console.error("Fetch error:", err);
        showToast("ไม่สามารถเชื่อมต่อฐานข้อมูลได้", "danger");
    }
}

function initVoters() {
    const select = document.getElementById('voterSelect');
    select.innerHTML = '<option value="" disabled selected>-- กรุณาเลือกชื่อจากรายการ --</option>';
    
    if (electionData.voters.length === 0) {
        select.innerHTML = '<option disabled>ไม่พบรายชื่อผู้มีสิทธิ</option>';
        return;
    }

    electionData.voters.forEach(voter => {
        const hasVoted = electionData.votes.some(v => v.voter === voter.name);
        const option = document.createElement('option');
        option.value = voter.region;
        option.textContent = voter.name + (hasVoted ? " (✅ ลงคะแนนแล้ว)" : "");
        if (hasVoted) option.disabled = true;
        select.appendChild(option);
    });
}

function renderRegionalCandidates(region) {
    currentRegion = region;
    const container = document.getElementById('candidates-container');
    const title = document.querySelector('.region-title');
    
    // แปลชื่อภาค
    const regionNames = { 'east': 'ภาคตะวันออก', 'south': 'ภาคใต้', 'north': 'ภาคเหนือ', 'central': 'ภาคกลาง' };
    title.textContent = `เลือก ส.ส. ${regionNames[region] || region}`;
    
    // แสดงสถานะก่อนโหลดข้อมูลจริง
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary me-2"></div> กำลังค้นหาข้อมูลผู้สมัคร...</div>';
    
    const regionalCandidates = electionData.candidates.filter(c => c.region === region);
    
    // Delay นิดหนึ่งเพื่อให้เห็นสถานะ (แต่ความจริงข้อมูลอาจโหลดไว้แล้ว)
    setTimeout(() => {
        container.innerHTML = '';
        if (regionalCandidates.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="bi bi-person-exclamation text-muted" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-3">ขออภัย ยังไม่มีรายชื่อผู้สมัครในเขตพื้นที่นี้</p>
                </div>`;
            return;
        }

        regionalCandidates.forEach(can => {
            container.appendChild(createSelectionItem(region, can.id, can.name, `mp_regional`, can.number, can.party));
        });
        
        // เพิ่มตัวเลือก ไม่ประสงค์ลงคะแนน สำหรับ ส.ส. เขต
        const noVoteMP = createSelectionItem(region, 'NO_VOTE', 'ไม่ประสงค์ลงคะแนน', `mp_regional`);
        noVoteMP.classList.add('border-danger', 'text-danger', 'bg-danger', 'bg-opacity-10');
        container.appendChild(noVoteMP);
    }, 400);
}

function initParties() {
    const partyContainer = document.getElementById('party-list');
    partyContainer.innerHTML = '<p class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm me-2"></span> กำลังดาวน์โหลดรายชื่อพรรค...</p>';
    
    // เหมือนกับ candidates
    setTimeout(() => {
        partyContainer.innerHTML = '';
        if (electionData.parties.length === 0) {
            partyContainer.innerHTML = '<p class="text-center text-muted py-4">ไม่พบรายชื่อพรรคการเมือง</p>';
            return;
        }
        electionData.parties.forEach(party => {
            partyContainer.appendChild(createSelectionItem('party', party.id, party.name, 'political_party', party.number));
        });
        
        // เพิ่มตัวเลือก ไม่ประสงค์ลงคะแนน สำหรับ พรรคการเมือง
        const noVoteParty = createSelectionItem('party', 'NO_VOTE', 'ไม่ประสงค์ลงคะแนน', 'political_party');
        noVoteParty.classList.add('border-danger', 'text-danger', 'bg-danger', 'bg-opacity-10');
        partyContainer.appendChild(noVoteParty);
    }, 500);
}

function createSelectionItem(type, id, name, groupName, number = null, partyName = null) {
    const label = document.createElement('label');
    label.className = 'candidate-item';
    
    let subInfo = '';
    if (number) subInfo += `<span class="badge bg-primary text-white me-2">เบอร์ ${number}</span>`;
    if (partyName) subInfo += `<span class="small text-muted">พรรค${partyName}</span>`;

    label.innerHTML = `
        <input type="radio" name="${groupName}" value="${id}" required>
        <div class="candidate-content d-flex align-items-center justify-content-between w-100">
            <div>
                ${number ? `<div class="fw-bold text-primary mb-1">เบอร์ ${number}</div>` : ''}
                <span class="candidate-name d-block fw-bold">${name}</span>
                ${partyName ? `<small class="text-muted d-block mt-1">พรรค ${partyName}</small>` : ''}
            </div>
            <i class="bi bi-check-circle-fill check-icon"></i>
        </div>
    `;
    const radio = label.querySelector('input');
    radio.addEventListener('change', () => {
        const group = document.getElementsByName(groupName);
        group.forEach(r => {
            r.closest('.candidate-item').classList.remove('selected');
        });
        label.classList.add('selected');
    });
    return label;
}

// 2. Navigation & UI Logic
function nextStep(step) {
    if (step === 1) {
        const voterSelect = document.getElementById('voterSelect');
        if (!voterSelect.value) {
            alert("⚠️ กรุณาเลือกชื่อของท่านก่อนดำเนินการต่อ");
            return;
        }
        renderRegionalCandidates(voterSelect.value);
        showStep('region');
        updateProgress(1);
    } else if (step === 6) {
        if (!document.querySelector('input[name="mp_regional"]:checked')) {
            alert("⚠️ โปรดเลือกผู้สมัคร ส.ส. 1 ท่านก่อน");
            return;
        }
        showStep(6);
        updateProgress(2);
        document.getElementById('backToRegionBtn').onclick = () => { showStep('region'); updateProgress(1); };
    }
}

function prevStep(step) {
    if (step === 1) {
        showStep(1);
        updateProgress(0);
    }
}

function showStep(stepId) {
    const cards = document.querySelectorAll('.step-card');
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';
        setTimeout(() => card.classList.add('d-none'), 300);
    });
    
    setTimeout(() => {
        const nextCard = document.getElementById(`step-${stepId}`);
        nextCard.classList.remove('d-none');
        setTimeout(() => {
            nextCard.style.opacity = '1';
            nextCard.style.transform = 'translateY(0)';
        }, 50);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 350);
}

function updateProgress(activeIndex) {
    const dots = document.querySelectorAll('.indicator-dot');
    dots.forEach((dot, idx) => {
        if (idx <= activeIndex) dot.classList.add('active');
        else dot.classList.remove('active');
    });
}

async function sendVoteData() {
    const voterSelect = document.getElementById('voterSelect');
    const voterName = voterSelect.options[voterSelect.selectedIndex].text;
    
    const candidateRadio = document.querySelector('input[name="mp_regional"]:checked');
    const candidateName = candidateRadio ? candidateRadio.closest('.candidate-item').querySelector('.candidate-name').textContent : "ไม่ได้เลือก";
    
    const partyRadio = document.querySelector('input[name="political_party"]:checked');
    const partyName = partyRadio ? partyRadio.closest('.candidate-item').querySelector('.candidate-name').textContent : "ไม่ได้เลือก";

    // ดึง IP Address ของผู้ใช้
    let clientIp = "Unknown";
    try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        clientIp = ipData.ip;
    } catch (e) { console.error("IP Fetch Error:", e); }

    const payload = {
        action: 'VOTE',
        data: { voterName, region: currentRegion, candidateName, partyName, ip: clientIp }
    };

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (result.result === "error") {
            alert(result.message); // แสดงข้อผิดพลาดจาก Server (เช่น IP ซ้ำ)
            return false;
        }
        
        return result.result === "success";
    } catch (error) {
        console.error("Submit error:", error);
        showToast("ไม่สามารถส่งข้อมูลได้ โปรดตรวจสอบอินเทอร์เน็ต", "danger");
        return false;
    }
}

function showSuccess() {
    showStep('success');
    document.querySelector('.header-card').style.display = 'none';
}

function showToast(message, type) {
    // ใช้ alert ง่ายๆ แต่จัดแต่งข้อความเล็กน้อย (ความจริงควรใช้ Custom UI แต่รักษาความไว)
    alert(`[${type === 'warning' ? 'แจ้งเตือน' : 'ข้อผิดพลาด'}] ${message}`);
}
