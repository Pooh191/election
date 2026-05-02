const fs = require('fs');

function replaceAlerts(file) {
    let content = fs.readFileSync(file, 'utf8');

    // Replace basic alert("message")
    content = content.replace(/alert\((['"`])(.*?)['"`]\);?/g, (match, quote, msg) => {
        let icon = 'info';
        if (msg.includes('⚠️')) icon = 'warning';
        else if (msg.includes('⏳')) icon = 'info';
        else if (msg.includes('ข้อผิดพลาด') || msg.includes('Error') || msg.includes('ไม่พบ') || msg.includes('ลบ')) icon = 'error';
        else if (msg.includes('เรียบร้อย') || msg.includes('สำเร็จ')) icon = 'success';
        else if (msg.includes('กรุณา')) icon = 'warning';
        
        // Don't clean msg here so we keep exactly what was there, just replace icon
        let cleanMsg = msg.replace(/[⚠️⏳]/g, '').trim();
        return `Swal.fire({ icon: '${icon}', title: ${quote}${cleanMsg}${quote}, confirmButtonText: 'ตกลง' });`;
    });

    // Handle string concatenations
    content = content.replace(/alert\(result\.message\);?/g, "Swal.fire({ icon: 'error', title: 'ข้อผิดพลาด', text: result.message, confirmButtonText: 'ตกลง' });");
    content = content.replace(/alert\("เกิดข้อผิดพลาด: " \+ ([a-zA-Z.]+)\);?/g, "Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: $1, confirmButtonText: 'ตกลง' });");
    content = content.replace(/alert\("Error: " \+ ([a-zA-Z.]+)\);?/g, "Swal.fire({ icon: 'error', title: 'Error', text: $1, confirmButtonText: 'ตกลง' });");
    content = content.replace(/alert\("ไม่สามารถติดต่อเซิร์ฟเวอร์ได้: " \+ ([a-zA-Z.]+)\);?/g, "Swal.fire({ icon: 'error', title: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้', text: $1, confirmButtonText: 'ตกลง' });");
    content = content.replace(/alert\("ไม่สามารถบันทึกสถานะได้: " \+ ([a-zA-Z.]+)\);?/g, "Swal.fire({ icon: 'error', title: 'ไม่สามารถบันทึกสถานะได้', text: $1, confirmButtonText: 'ตกลง' });");
    content = content.replace(/alert\("ไม่พบข้อมูลพรรคการเมือง ID: " \+ ([a-zA-Z]+)\);?/g, "Swal.fire({ icon: 'warning', title: 'ไม่พบข้อมูล', text: 'ไม่พบข้อมูลพรรคการเมือง ID: ' + $1, confirmButtonText: 'ตกลง' });");
    
    // specifically for script.js line 498
    content = content.replace(/alert\(`\[\$\{type === 'warning' \? 'แจ้งเตือน' : 'ข้อผิดพลาด'\}\] \$\{message\}`\);?/g, 
        "Swal.fire({ icon: type === 'warning' ? 'warning' : 'error', title: type === 'warning' ? 'แจ้งเตือน' : 'ข้อผิดพลาด', text: message, confirmButtonText: 'ตกลง' });");

    fs.writeFileSync(file, content);
}

try {
    replaceAlerts('script.js');
    replaceAlerts('admin-script.js');
    console.log("Alerts replaced");
} catch (e) {
    console.error(e);
}
