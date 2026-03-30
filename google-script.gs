/**
 * Google Apps Script - Full Election Management System (V2)
 * คัดลอกโค้ดนี้ไปวางแทนที่โค้ดเดิมใน Apps Script ของคุณ
 */

const SHEET_NAMES = {
  VOTERS: "Voters",
  CANDIDATES: "Candidates",
  PARTIES: "Parties",
  VOTES: "Votes"
};

// --- ฟังก์ชันหลักสำหรับ GET (ดึงข้อมูลทั้งหมด) ---
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets(ss);
  
  const data = {
    voters: getSheetData(ss.getSheetByName(SHEET_NAMES.VOTERS)),
    candidates: getSheetData(ss.getSheetByName(SHEET_NAMES.CANDIDATES)),
    parties: getSheetData(ss.getSheetByName(SHEET_NAMES.PARTIES)),
    votes: getSheetData(ss.getSheetByName(SHEET_NAMES.VOTES))
  };
  
  return createJSONResponse(data);
}

// --- ฟังก์ชันหลักสำหรับ POST (จัดการข้อมูลและลงคะแนน) ---
function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (!e || !e.postData || !e.postData.contents) {
    return createJSONResponse({ result: "error", message: "ไม่พบข้อมูลที่ส่งมา" });
  }
  
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return createJSONResponse({ result: "error", message: "รูปแบบข้อมูลไม่ถูกต้อง: " + err.toString() });
  }
  
  const action = req.action;
  
  try {
    switch (action) {
      case 'VOTE': return handleVote(ss, req.data);
      case 'ADD_VOTER': return handleAddEntry(ss, SHEET_NAMES.VOTERS, req.data);
      case 'BATCH_ADD_VOTERS': return handleBatchAdd(ss, SHEET_NAMES.VOTERS, req.data);
      case 'UPDATE_VOTER': return handleUpdateEntry(ss, SHEET_NAMES.VOTERS, req.id, req.data);
      case 'DELETE_VOTER': return handleDeleteEntry(ss, SHEET_NAMES.VOTERS, req.id);
      
      case 'ADD_CANDIDATE': return handleAddEntry(ss, SHEET_NAMES.CANDIDATES, req.data);
      case 'BATCH_ADD_CANDIDATES': return handleBatchAdd(ss, SHEET_NAMES.CANDIDATES, req.data);
      case 'UPDATE_CANDIDATE': return handleUpdateEntry(ss, SHEET_NAMES.CANDIDATES, req.id, req.data);
      case 'DELETE_CANDIDATE': return handleDeleteEntry(ss, SHEET_NAMES.CANDIDATES, req.id);
      
      case 'ADD_PARTY': return handleAddEntry(ss, SHEET_NAMES.PARTIES, req.data);
      case 'BATCH_ADD_PARTIES': return handleBatchAdd(ss, SHEET_NAMES.PARTIES, req.data);
      case 'UPDATE_PARTY': return handleUpdateEntry(ss, SHEET_NAMES.PARTIES, req.id, req.data);
      case 'DELETE_PARTY': return handleDeleteEntry(ss, SHEET_NAMES.PARTIES, req.id);
      
      case 'RESET_VOTES': return handleResetVotes(ss);
      default: throw new Error("ไม่พบ Action ที่ระบุ: " + action);
    }
  } catch (error) {
    return createJSONResponse({ result: "error", message: "Server Error: " + error.toString() });
  }
}

// --- การจัดการลงคะแนน (พร้อมตรวจสอบการลงซ้ำ) ---
function handleVote(ss, data) {
  const votesSheet = ss.getSheetByName(SHEET_NAMES.VOTES);
  const voteList = votesSheet.getDataRange().getValues();
  const clientIp = data.ip || "Unknown";
  
  // 1. ตรวจสอบจากชื่อ (Voter Name)
  const alreadyVotedByName = voteList.some(row => row[1] === data.voterName);
  if (alreadyVotedByName) {
    throw new Error("❌ ท่านได้ลงคะแนนความเห็นไปเรียบร้อยแล้ว ไม่สามารถลงซ้ำได้");
  }

  // 2. ตรวจสอบจาก IP (ถ้าไม่ใช่ Unknown)
  if (clientIp !== "Unknown") {
    const alreadyVotedByIp = voteList.some(row => row[5] === clientIp); // Column 6 เป็น IP
    if (alreadyVotedByIp) {
      throw new Error("⚠️ ตรวจพบการใช้งานซ้ำจากเครื่องของท่าน ขออภัยคุณใช้สิทธิได้เพียง 1 ครั้งเท่านั้น");
    }
  }
  
  votesSheet.appendRow([new Date(), data.voterName, data.region, data.candidateName, data.partyName, clientIp]);
  return createJSONResponse({ result: "success" });
}

// --- การจัดการ CRUD พื้นฐาน ---
function handleAddEntry(ss, sheetName, data) {
  const sheet = ss.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  const id = "ID-" + new Date().getTime();
  const cleanName = data.name.trim();

  // ปรับปรุง: ตรวจสอบข้อมูลซ้ำโดยดึงเฉพาะคอลัมน์ชื่อให้ตรงกับโครงสร้างชีต
  if (lastRow > 1) {
    const nameColIndex = (sheetName === SHEET_NAMES.VOTERS) ? 2 : 3;
    const existingNames = sheet.getRange(2, nameColIndex, lastRow - 1, 1).getValues().flat().map(n => n.toString().trim().toLowerCase());
    if (existingNames.indexOf(cleanName.toLowerCase()) !== -1) {
      throw new Error("⚠️ รายข้อมูลนี้มีอยู่ในระบบแล้ว: " + cleanName);
    }
  }

  if (sheetName === SHEET_NAMES.VOTERS) {
    sheet.appendRow([id, cleanName, data.region]);
  } else if (sheetName === SHEET_NAMES.CANDIDATES) {
    sheet.appendRow([id, data.number, cleanName, data.region, data.party]);
  } else if (sheetName === SHEET_NAMES.PARTIES) {
    sheet.appendRow([id, data.number || "-", cleanName]);
  }
  
  return createJSONResponse({ result: "success", id: id });
}

function handleBatchAdd(ss, sheetName, data) {
  const sheet = ss.getSheetByName(sheetName);
  const names = data.names || [];
  const region = data.region;
  const party = data.party || ""; 
  const baseTime = new Date().getTime();
  const lastRow = sheet.getLastRow();
  
  if (names.length === 0) throw new Error("ไม่มีรายชื่อให้เพิ่ม");
  
  let existingNames = [];
  if (lastRow > 1) {
    const nameColIndex = (sheetName === SHEET_NAMES.VOTERS) ? 2 : 3;
    existingNames = sheet.getRange(2, nameColIndex, lastRow - 1, 1).getValues().flat().map(n => n.toString().trim().toLowerCase());
  }
  
  const rows = [];
  names.forEach((name, index) => {
    const cleanName = name.trim();
    if (cleanName && existingNames.indexOf(cleanName.toLowerCase()) === -1) {
        if (sheetName === SHEET_NAMES.PARTIES) {
            rows.push(["ID-" + (baseTime + index), "-", cleanName]);
        } else if (sheetName === SHEET_NAMES.CANDIDATES) {
            rows.push(["ID-" + (baseTime + index), "-", cleanName, region, party]);
        } else {
            rows.push(["ID-" + (baseTime + index), cleanName, region]);
        }
        existingNames.push(cleanName.toLowerCase());
    }
  });
  
  if (rows.length === 0) {
      return createJSONResponse({ result: "success", count: 0, message: "ข้อมูลทั้งหมดมีอยู่ในระบบแล้ว" });
  }
  
  const colCount = (sheetName === SHEET_NAMES.PARTIES) ? 3 : (sheetName === SHEET_NAMES.CANDIDATES ? 5 : 3);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, colCount).setValues(rows);
  return createJSONResponse({ result: "success", count: rows.length });
}

function handleUpdateEntry(ss, sheetName, id, data) {
  const sheet = ss.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  const ids = sheet.getRange(1, 1, lastRow, 1).getValues().flat().map(i => i.toString().trim());
  const index = ids.indexOf(id.toString().trim());
  
  if (index === -1) throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข");
  const rowNum = index + 1;

  if (sheetName === SHEET_NAMES.VOTERS) {
    sheet.getRange(rowNum, 2, 1, 2).setValues([[data.name, data.region]]);
  } else if (sheetName === SHEET_NAMES.CANDIDATES) {
    sheet.getRange(rowNum, 2, 1, 4).setValues([[data.number, data.name, data.region, data.party]]);
  } else if (sheetName === SHEET_NAMES.PARTIES) {
    sheet.getRange(rowNum, 2, 1, 2).setValues([[data.number, data.name]]);
  }
  
  return createJSONResponse({ result: "success" });
}

function handleDeleteEntry(ss, sheetName, id) {
  const sheet = ss.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error("ไม่พบข้อมูลที่จะลบ");

  // ดึงเฉพาะคอลัมน์ ID (คอลัมน์ 1) มาเช็ค
  const ids = sheet.getRange(1, 1, lastRow, 1).getValues().flat().map(i => i.toString().trim());
  const targetId = id.toString().trim();
  const index = ids.indexOf(targetId);

  if (index !== -1) {
    sheet.deleteRow(index + 1);
    return createJSONResponse({ result: "success", message: "ลบข้อมูลสำเร็จ" });
  }
  
  throw new Error("หาข้อมูลไม่เจอหรือรหัสไม่ถูกต้อง: " + targetId);
}

function handleResetVotes(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.VOTES);
  const range = sheet.getRange(2, 1, sheet.getLastRow(), sheet.getLastColumn());
  range.clearContent();
  return createJSONResponse({ result: "success" });
}

// --- ฟังก์ชันช่วยเหลือ ---
function getSheetData(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h.toLowerCase()] = row[i]);
    return obj;
  });
}

function ensureSheets(ss) {
  const votersHeaders = ["id", "name", "region"];
  const candHeaders = ["id", "number", "name", "region", "party"];
  const partyHeaders = ["id", "number", "name"];
  const voteHeaders = ["timestamp", "voter", "region", "candidate", "party", "ip"];

  const check = (sheetName, headers) => {
    let s = ss.getSheetByName(sheetName);
    if (!s) {
      s = ss.insertSheet(sheetName);
      s.appendRow(headers);
    } else {
      // ตรวจสอบว่าหัวตารางตรงกันหรือไม่ (กรณีคนไปแก้ Sheet เองแล้วคอลัมน์สลับ)
      const currentHeaders = s.getRange(1, 1, 1, s.getLastColumn() || 1).getValues()[0].map(h => h.toString().toLowerCase().trim());
      const allMatched = headers.every((h, i) => currentHeaders[i] === h);
      if (!allMatched && currentHeaders.length > 0) {
        // หากหัวตารางไม่ตรง ให้ทับด้วยหัวตารางที่รับเข้ามาเพื่อความปลอดภัยของโค้ด
        s.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
    }
  };

  check(SHEET_NAMES.VOTERS, votersHeaders);
  check(SHEET_NAMES.CANDIDATES, candHeaders);
  check(SHEET_NAMES.PARTIES, partyHeaders);
  check(SHEET_NAMES.VOTES, voteHeaders);
}

function createJSONResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
