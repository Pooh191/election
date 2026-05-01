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
let timerInterval;

document.addEventListener('DOMContentLoaded', async () => {
    // โหลดข้อมูลเริ่มต้น
    const loadSuccess = await fetchElectionData();
    if (!loadSuccess) return; // ถ้าดึงข้อมูลพัง ให้หยุดการทำงานทั้งหมด
    
    // ⏱️ Election Status Real-time Monitoring
    if (electionData.settings) {
        const checkStatus = () => {
            const now = new Date().getTime();
            const start = electionData.settings.startTime ? new Date(electionData.settings.startTime).getTime() : null;
            const end = electionData.settings.endTime ? new Date(electionData.settings.endTime).getTime() : null;
            
            // Case 1: Election hasn't started yet
            if (start && now < start) {
                const diff = start - now;
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const secs = Math.floor((diff % (1000 * 60)) / 1000);
                
                showElectionClosed(`⏳ การเลือกตั้งจะเริ่มในอีก<br>
                    <div class="d-flex justify-content-center gap-2 gap-md-3 mt-4 flex-wrap">
                        <div class="timer-box"><div>${days}</div><span>วัน</span></div>
                        <div class="timer-box"><div>${hours}</div><span>ชม.</span></div>
                        <div class="timer-box"><div>${mins}</div><span>นาที</span></div>
                        <div class="timer-box"><div>${secs}</div><span>วิ</span></div>
                    </div>
                    <p class="mt-4 small text-muted">ระบบจะเปิดรับลงคะแนนอัตโนมัติในเวลา ${new Date(start).toLocaleString('th-TH')}</p>
                `);
                return "PENDING";
            }
            
            // Case 2: Election has ended
            if (end && now > end) {
                showElectionClosed(`🚫 ปิดหีบเลือกตั้งเรียบร้อยแล้ว<br><p class="mt-3 small text-muted">ระบบปิดรับลงคะแนนเมื่อเวลา ${new Date(end).toLocaleString('th-TH')}</p>`);
                if(timerInterval) clearInterval(timerInterval);
                return "ENDED";
            }
            
            return "OPEN";
        };

        const status = checkStatus();
        if (status !== "OPEN") {
            // Keep updating the countdown if pending
            if (status === "PENDING") {
                timerInterval = setInterval(() => {
                    if (checkStatus() === "OPEN") {
                       clearInterval(timerInterval);
                       location.reload(); 
                    }
                }, 1000);
            }
            return; // Don't show the form if not open
        } else {
            // If open, set a timer to check when it ends
            timerInterval = setInterval(() => {
                if (checkStatus() !== "OPEN") {
                    clearInterval(timerInterval);
                    // location.reload() will trigger Case 2 UI
                    location.reload();
                }
            }, 10000); // Check every 10 seconds for performance
        }
    }

    // ตั้งค่า UI เริ่มต้น
    const mode = (electionData.settings && electionData.settings.electionMode) ? electionData.settings.electionMode : 'both';
    if (mode === 'regional') document.getElementById('dot-party').classList.add('d-none');
    if (mode === 'party') document.getElementById('dot-region').classList.add('d-none');

    initVoters();
    initParties();
    
    // ซ่อน Loader และแสดงฟอร์ม
    document.getElementById('globalLoader').classList.add('d-none');
    document.getElementById('electionForm').classList.remove('d-none');
    
    // Form Submission
    const form = document.getElementById('electionForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const mode = (electionData.settings && electionData.settings.electionMode) ? electionData.settings.electionMode : 'both';
        if (mode === 'both' || mode === 'party') {
            if (!document.querySelector('input[name="political_party"]:checked')) {
                alert("⚠️ โปรดเลือกพรรคการเมืองที่ท่านสนับสนุนก่อนส่งคะแนน");
                return;
            }
        }

        const submitBtn = form.querySelector('.submit-btn');
        const originalText = submitBtn.innerHTML;
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> กำลังบันทึกคะแนน...';
        
        // Show Beauty Modal
        const votingModal = new bootstrap.Modal(document.getElementById('votingModal'));
        votingModal.show();
        
        const success = await sendVoteData();
        
        // Wait a bit for smooth UI
        setTimeout(() => {
            votingModal.hide();
            if (success) {
                showSuccess();
                updateProgress(4);
            } else {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }, 1200);
    });
});

function showElectionClosed(message) {
    const loader = document.getElementById('globalLoader');
    loader.innerHTML = `
        <div class="text-center p-5 animate__animated animate__fadeIn">
            <div class="bg-white p-5 rounded-5 shadow-lg border">
                <i class="bi bi-clock-history text-warning display-1 mb-4"></i>
                <h2 class="fw-bold text-bold">${message}</h2>
                <div class="mt-4 pt-4 border-top">
                    <p class="text-muted small">ขอบคุณที่ให้ความสนใจในการใช้สิทธิเลือกตั้ง</p>
                </div>
            </div>
        </div>
    `;
    loader.classList.remove('d-none');
}

async function fetchElectionData() {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'GET_DATA' })
        });
        const result = await response.json();
        
        // Validation data structure
        if (result.result === "error") {
            throw new Error(result.message || "API Data Error");
        }
        
        // การันตีว่าตัวแปรจะไม่ undefined ถึงแม้ว่า sheet จะว่าง
        electionData = {
            voters: result.voters || [],
            candidates: result.candidates || [],
            parties: result.parties || [],
            votes: result.votes || [],
            settings: result.settings || {}
        };
        return true;
    } catch (err) {
        console.error("Fetch error:", err);
        showRetryUI("ไม่สามารถเชื่อมต่อฐานข้อมูลได้ โปรดตรวจสอบอินเทอร์เน็ตหรือรีเฟรชหน้าเว็บใหม่");
        return false;
    }
}

function showRetryUI(message) {
    const loader = document.getElementById('globalLoader');
    loader.innerHTML = `
        <div class="text-center p-5 animate__animated animate__fadeIn">
            <div class="bg-white p-5 rounded-5 shadow-lg border border-danger border-opacity-25">
                <i class="bi bi-wifi-off text-danger display-1 mb-4"></i>
                <h3 class="fw-bold text-dark">การเชื่อมต่อขัดข้อง</h3>
                <p class="text-muted mt-3 mb-4">${message}</p>
                <button class="btn btn-outline-danger px-4 py-2 rounded-pill fw-bold" onclick="location.reload()">
                    <i class="bi bi-arrow-repeat me-2"></i> ลองโหลดข้อมูลใหม่
                </button>
            </div>
        </div>
    `;
    loader.classList.remove('d-none');
    document.getElementById('electionForm').classList.add('d-none');
}

function initVoters() {
    const select = document.getElementById('voterSelect');
    select.innerHTML = '<option value="" disabled selected>-- กรุณาเลือกชื่อจากรายการ --</option>';
    
    if (electionData.voters.length === 0) {
        select.innerHTML = '<option disabled>ไม่พบรายชื่อผู้มีสิทธิ</option>';
        return;
    }

    const openStatus = (electionData.settings && electionData.settings.region_open_status) ? JSON.parse(electionData.settings.region_open_status) : {};
    const votedNames = new Set(electionData.votes.map(v => v.voter));

    let visibleCount = 0;
    electionData.voters.forEach(voter => {
        const isRegionOpen = openStatus[voter.region] !== false;
        const hasVoted = votedNames.has(voter.name);
        
        // ✅ กรองออก: ถ้าเขตปิดอยู่ หรือ ลงคะแนนไปแล้ว ให้ "ไม่ปรากฏ" ในรายการ
        if (!isRegionOpen || hasVoted) return;

        const option = document.createElement('option');
        option.value = voter.region;
        option.textContent = voter.name;
        select.appendChild(option);
        visibleCount++;
    });

    if (visibleCount === 0) {
        select.innerHTML = '<option disabled>ไม่มีรายชื่อผู้มีสิทธิที่ยังไม่ได้ลงคะแนนในขณะนี้</option>';
    }
}

function renderRegionalCandidates(region) {
    currentRegion = region;
    const container = document.getElementById('candidates-container');
    const title = document.querySelector('.region-title');
    
    // แปลชื่อเขต
    const regionNames = { 'reg1': 'เขต 1 (เชียงใหม่, เชียงราย, ลำพูน)', 'reg2': 'เขต 2 (ขอนแก่น, อุดรธานี)', 'reg3': 'เขต 3 (กทม., อยุธยา, นครราชสีมา)', 'reg4': 'เขต 4 (ภูเก็ต, นครศรีฯ, นนทบุรี)', 'reg5': 'เขต 5 (สงขลา)' };
    title.textContent = `เลือก ส.ส. ${regionNames[region] || region}`;
    
    // แสดงสถานะก่อนโหลดข้อมูลจริง
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary me-2"></div> กำลังค้นหาข้อมูลผู้สมัคร...</div>';
    
    const regionalCandidates = electionData.candidates.filter(c => c.region === region);
    
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
}

function initParties() {
    const partyContainer = document.getElementById('party-list');
    partyContainer.innerHTML = '<p class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm me-2"></span> กำลังดาวน์โหลดรายชื่อพรรค...</p>';
    
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
}

function createSelectionItem(type, id, name, groupName, number = null, partyName = null) {
    const label = document.createElement('label');
    label.className = 'candidate-item';
    
    let subInfo = '';
    if (number) subInfo += `<span class="badge bg-primary text-white me-2">เบอร์ ${number}</span>`;
    if (partyName) subInfo += `<span class="small text-muted">พรรค${partyName}</span>`;

    label.innerHTML = `
        <input type="radio" name="${groupName}" value="${id}">
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

function startVoting() {
    const check = document.getElementById('consentCheck');
    if (!check.checked) {
        alert("⚠️ กรุณายอมรับข้อตกลงความเป็นส่วนตัวก่อนเข้าสู่ระบบลงคะแนน");
        return;
    }
    showStep(1);
    updateProgress(1);
}

// 2. Navigation & UI Logic
function nextStep(step) {
    const mode = (electionData.settings && electionData.settings.electionMode) ? electionData.settings.electionMode : 'both';
    
    if (step === 1) {
        const voterSelect = document.getElementById('voterSelect');
        if (!voterSelect.value) {
            alert("⚠️ กรุณาเลือกชื่อของท่านก่อนดำเนินการต่อ");
            return;
        }
        
        // ตรวจสอบการเปิดหีบรายเขต
        const region = voterSelect.value;
        const openStatus = (electionData.settings && electionData.settings.region_open_status) ? JSON.parse(electionData.settings.region_open_status) : {};
        if (openStatus[region] === false) {
            alert("⏳ เขตพื้นที่ของท่านยังไม่เปิดให้ลงคะแนน หรือปิดหีบชั่วคราว");
            return;
        }

        currentRegion = region; // เก็บ region ไว้ใช้ข้าม step
        
        if (mode === 'party') {
            // ข้าม Step 2 ไป Step 3 (Party)
            showStep(6);
            updateProgress(2);
            document.getElementById('backToRegionBtn').onclick = () => { prevStep(1); };
        } else {
            // ไป Step 2 (Region)
            renderRegionalCandidates(region);
            showStep('region');
            updateProgress(2);

            // ปรับปุ่มขวามือของ Step 2
            const nextBtn = document.getElementById('btnNextFromRegion');
            if (mode === 'regional') {
                nextBtn.innerHTML = 'ยืนยันการส่งคะแนน <i class="bi bi-send-check ms-2"></i>';
                // ถ้าเป็น regional only ให้หน้า 2 เป็นหน้าสุดท้าย (เปลี่ยน type เป็น submit)
                nextBtn.onclick = () => {
                    const form = document.getElementById('electionForm');
                    if (!document.querySelector('input[name="mp_regional"]:checked')) {
                        alert("⚠️ โปรดเลือกผู้สมัคร ส.ส. 1 ท่านก่อน");
                        return;
                    }
                    form.requestSubmit(); // สั่ง submit ฟอร์มจากปุ่ม
                };
            } else {
                nextBtn.innerHTML = 'ขั้นตอนต่อไป <i class="bi bi-arrow-right ms-2"></i>';
                nextBtn.onclick = () => { nextStep(6); };
            }
        }
    } else if (step === 6) {
        if (!document.querySelector('input[name="mp_regional"]:checked')) {
            alert("⚠️ โปรดเลือกผู้สมัคร ส.ส. 1 ท่านก่อน");
            return;
        }
        showStep(6);
        updateProgress(3);
        document.getElementById('backToRegionBtn').onclick = () => { showStep('region'); updateProgress(2); };
    }
}

function prevStep(step) {
    if (step === 1) {
        showStep(1);
        updateProgress(1);
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
            mode: 'cors',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
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
    
    // Hide header for cleaner look
    const header = document.querySelector('.header-card');
    if (header) {
        header.style.opacity = '0';
        setTimeout(() => header.classList.add('d-none'), 300);
    }
    
    // Add success animation elements
    const successCard = document.getElementById('step-success');
    successCard.innerHTML = `
        <div class="text-center p-5 animate__animated animate__zoomIn">
            <div class="mb-4">
                <div class="d-inline-flex bg-success bg-opacity-10 p-4 rounded-circle animate__animated animate__bounceIn animate__delay-1s">
                    <i class="bi bi-check-circle-fill text-success" style="font-size: 5rem;"></i>
                </div>
            </div>
            <h2 class="fw-bold mb-3">บันทึกคะแนนสำเร็จ!</h2>
            <p class="text-muted mb-5">ขอบคุณที่ร่วมเป็นส่วนหนึ่งของการขับเคลื่อนระบอบประชาธิปไตย รายการโหวตของคุณถูกส่งเข้าสู่ระบบส่วนกลางแล้ว</p>
            <div class="d-flex flex-column gap-3 max-w-300 mx-auto px-4">
                <button class="btn btn-primary-custom py-3 rounded-4 shadow-sm w-100" onclick="location.reload()">
                    <i class="bi bi-house-door-fill me-2"></i> กลับหน้าหลัก
                </button>
            </div>
        </div>
    `;
}

function showToast(message, type) {
    // ใช้ alert ง่ายๆ แต่จัดแต่งข้อความเล็กน้อย (ความจริงควรใช้ Custom UI แต่รักษาความไว)
    alert(`[${type === 'warning' ? 'แจ้งเตือน' : 'ข้อผิดพลาด'}] ${message}`);
}
