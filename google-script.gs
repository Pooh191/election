const SHEET_NAMES = {
  VOTERS: "Voters",
  CANDIDATES: "Candidates",
  PARTIES: "Parties",
  VOTES: "Votes",
  SETTINGS: "Settings"
};

const CACHE_TTL = 300; 

// --- ฟังก์ชันหลักสำหรับ GET (ดึงข้อมูลทั้งหมด) ---
function doGet(e) {
  return HtmlService.createHtmlOutput("<p style='font-family: sans-serif; text-align: center; margin-top: 100px;'>⛔ Unauthorized Access: Direct access to this API is not permitted.</p>");
}

// --- Helper for fetching all data ---
function fetchAllElectionData(ss) {
  const voters = getSheetDataCached(ss, SHEET_NAMES.VOTERS);
  const candidates = getSheetDataCached(ss, SHEET_NAMES.CANDIDATES);
  const parties = getSheetDataCached(ss, SHEET_NAMES.PARTIES);
  const votes = getSheetData(ss.getSheetByName(SHEET_NAMES.VOTES));
  const settings = getSettings(ss);
  
  return {
    voters: voters,
    candidates: candidates,
    parties: parties,
    votes: votes,
    settings: settings
  };
}

// --- ฟังก์ชันหลักสำหรับ POST ---
function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!e || !e.postData || !e.postData.contents) return createJSONResponse({ result: "error", message: "ไม่พบข้อมูล" });
  
  let req;
  try { req = JSON.parse(e.postData.contents); } 
  catch (err) { return createJSONResponse({ result: "error", message: "JSON Invalid" }); }
  
  const action = req.action;
  if (action !== 'VOTE' && action !== 'GET_DATA') clearDataCache();
  
  try {
    switch (action) {
      case 'GET_DATA': return createJSONResponse(fetchAllElectionData(ss));
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
      case 'UPDATE_SETTINGS': return handleUpdateSettings(ss, req.data);
      case 'DELETE_REGION_DATA': return handleDeleteRegionData(ss, req.data.region);
      case 'INITIALIZE': ensureSheets(ss); return createJSONResponse({ result: "success", message: "System Initialized" });
      default: throw new Error("Action Not Found: " + action);
    }
  } catch (error) {
    return createJSONResponse({ result: "error", message: error.toString() });
  }
}

// --- ประสิทธิภาพสูง: การลงคะแนน ---
function handleVote(ss, data) {
  // ตรวจสอบเวลาเปิด-ปิดหีบ
  const settings = getSettings(ss);
  const now = new Date().getTime();
  
  if (settings.startTime && now < new Date(settings.startTime).getTime()) {
      throw new Error("⏳ ยังไม่ถึงเวลาเปิดหีบเลือกตั้ง");
  }
  if (settings.endTime && now > new Date(settings.endTime).getTime()) {
      throw new Error("🚫 ปิดหีบเลือกตั้งเรียบร้อยแล้ว ไม่สามารถลงคะแนนได้");
  }

  // ตรวจสอบการเปิดหีบรายเขต
  const openStatus = settings.region_open_status ? JSON.parse(settings.region_open_status) : {};
  if (openStatus[data.region] === false) {
      throw new Error("⏳ เขตพื้นที่ของท่านยังไม่เปิดให้ลงคะแนน หรือปิดหีบชั่วคราว");
  }

  const votesSheet = ss.getSheetByName(SHEET_NAMES.VOTES);
  const lastRow = votesSheet.getLastRow();
  const clientIp = data.ip || "Unknown";
  
  if (lastRow > 1) {
    const checkRange = votesSheet.getRange(2, 2, lastRow - 1, 5).getValues();
    for (let i = 0; i < checkRange.length; i++) {
        if (checkRange[i][0] === data.voterName) throw new Error("❌ ท่านได้ใช้สิทธิไปแล้ว");
        if (clientIp !== "Unknown" && checkRange[i][4] === clientIp) throw new Error("⚠️ พบการลงคะแนนซ้ำจากผู้ใช้นี้");
    }
  }
  
  votesSheet.appendRow([new Date(), data.voterName, data.region, data.candidateName, data.partyName, clientIp]);
  return createJSONResponse({ result: "success" });
}

// --- การจัดการ Settings ---
function getSettings(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet) return {};
  const values = sheet.getDataRange().getValues();
  const settings = {};
  values.forEach(row => {
    if (row[0]) settings[row[0]] = row[1];
  });
  return settings;
}

function handleUpdateSettings(ss, data) {
  let sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAMES.SETTINGS);
    sheet.appendRow(["key", "value"]);
  }
  
  // Get all existing settings
  const lastRow = sheet.getLastRow();
  const range = (lastRow > 0) ? sheet.getRange(1, 1, lastRow, 2) : null;
  const values = range ? range.getValues() : [];
  
  // Map existing keys to row numbers
  const keyToRow = {};
  values.forEach((row, idx) => {
    if (row[0]) keyToRow[row[0]] = idx + 1;
  });
  
  // Update or append settings
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (keyToRow[key]) {
      sheet.getRange(keyToRow[key], 2).setValue(value);
    } else {
      sheet.appendRow([key, value]);
    }
  });
  
  return createJSONResponse({ result: "success" });
}

// --- แคชชิ่งและดึงข้อมูล ---
function getSheetDataCached(ss, sheetName) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("data_v2_" + sheetName);
  if (cached) return JSON.parse(cached);
  const sheet = ss.getSheetByName(sheetName);
  const data = getSheetData(sheet);
  try { cache.put("data_v2_" + sheetName, JSON.stringify(data), CACHE_TTL); } catch (e) {}
  return data;
}

function clearDataCache() {
  const cache = CacheService.getScriptCache();
  cache.removeAll(["data_v2_Voters", "data_v2_Candidates", "data_v2_Parties"]);
}

function getSheetData(sheet) {
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return [];
  
  let values = sheet.getDataRange().getValues();
  let headers = values.shift().map(h => h.toString().toLowerCase().trim());
  
  // Auto-fix headers for Parties sheet if missing (This fixes the "Not Specified" bug upon refresh)
  if (sheet.getName() === SHEET_NAMES.PARTIES) {
      if (!headers.includes("constituency_count") || !headers.includes("list_count")) {
          const newHeaders = ["id", "number", "name", "constituency_count", "list_count"];
          sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
          headers = newHeaders;
          
          if (lastRow >= 2) {
              values = sheet.getRange(2, 1, lastRow - 1, newHeaders.length).getValues();
          } else {
              values = [];
          }
      }
  }

  return values.map((row, idx) => {
    let obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ""; });
    if (!obj.id) obj.id = "_ROW_" + (idx + 2); // Fallback ID for manually entered rows
    return obj;
  });
}

function handleAddEntry(ss, sheetName, data) {
  const sheet = ss.getSheetByName(sheetName);
  const id = "ID-" + Date.now();
  const cleanName = data.name.trim();
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const colName = (sheetName === SHEET_NAMES.VOTERS) ? 2 : 3;
    const existing = sheet.getRange(2, colName, lastRow - 1, 1).getValues().flat();
    if (existing.some(n => n.toString().trim().toLowerCase() === cleanName.toLowerCase())) {
      throw new Error("⚠️ ข้อมูลซ้ำในระบบ: " + cleanName);
    }
  }
  if (sheetName === SHEET_NAMES.VOTERS) sheet.appendRow([id, cleanName, data.region]);
  else if (sheetName === SHEET_NAMES.CANDIDATES) sheet.appendRow([id, data.number, cleanName, data.region, data.party]);
  else if (sheetName === SHEET_NAMES.PARTIES) sheet.appendRow([id, data.number || "-", cleanName, data.constituency_count || 0, data.list_count || 0]);
  return createJSONResponse({ result: "success", id: id });
}

function handleBatchAdd(ss, sheetName, data) {
  const sheet = ss.getSheetByName(sheetName);
  const names = data.names || [];
  if (names.length === 0) throw new Error("No names provided");
  const lastRow = sheet.getLastRow();
  const nameColIndex = (sheetName === SHEET_NAMES.VOTERS) ? 2 : 3;
  let existingNames = new Set();
  if (lastRow > 1) {
    existingNames = new Set(sheet.getRange(2, nameColIndex, lastRow - 1, 1).getValues().flat().map(n => n.toString().trim().toLowerCase()));
  }
  const rows = [];
  const baseTime = Date.now();
  names.forEach((name, i) => {
    const clean = name.trim();
    if (clean && !existingNames.has(clean.toLowerCase())) {
        const id = "ID-" + (baseTime + i);
        if (sheetName === SHEET_NAMES.PARTIES) rows.push([id, "", clean, 0, 0]);
        else if (sheetName === SHEET_NAMES.CANDIDATES) rows.push([id, "", clean, data.region, data.party || ""]);
        else rows.push([id, clean, data.region]);
        existingNames.add(clean.toLowerCase());
    }
  });
  if (rows.length > 0) sheet.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);
  return createJSONResponse({ result: "success", count: rows.length });
}

function handleUpdateEntry(ss, sheetName, id, data) {
  const sheet = ss.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) throw new Error("Sheet is empty");
  
  let rowIdx = -1;
  const idStr = String(id).trim();
  if (idStr.startsWith("_ROW_")) {
    rowIdx = parseInt(idStr.replace("_ROW_", "")) - 1;
  } else {
    const ids = sheet.getRange(1, 1, lastRow, 1).getValues().flat();
    rowIdx = ids.findIndex(item => String(item).trim() === idStr);
  }
  
  if (rowIdx === -1 || rowIdx >= lastRow) throw new Error("Data Not Found (ID: " + id + ")");
  const row = rowIdx + 1;
  
  if (idStr.startsWith("_ROW_")) {
     sheet.getRange(row, 1).setValue("ID-" + Date.now()); // Auto-fill missing ID
  }
  
  if (sheetName === SHEET_NAMES.VOTERS) sheet.getRange(row, 2, 1, 2).setValues([[data.name, data.region]]);
  else if (sheetName === SHEET_NAMES.CANDIDATES) sheet.getRange(row, 2, 1, 4).setValues([[data.number, data.name, data.region, data.party]]);
  else if (sheetName === SHEET_NAMES.PARTIES) sheet.getRange(row, 2, 1, 4).setValues([[data.number, data.name, data.constituency_count || 0, data.list_count || 0]]);
  return createJSONResponse({ result: "success" });
}

function handleDeleteEntry(ss, sheetName, id) {
  const sheet = ss.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) throw new Error("Sheet is empty");
  
  let rowIdx = -1;
  const idStr = String(id).trim();
  if (idStr.startsWith("_ROW_")) {
    rowIdx = parseInt(idStr.replace("_ROW_", "")) - 1;
  } else {
    const ids = sheet.getRange(1, 1, lastRow, 1).getValues().flat();
    rowIdx = ids.findIndex(item => String(item).trim() === idStr);
  }
  
  if (rowIdx === -1 || rowIdx >= lastRow) throw new Error("Data Not Found (ID: " + id + ")");
  sheet.deleteRow(rowIdx + 1);
  return createJSONResponse({ result: "success" });
}

function handleResetVotes(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.VOTES);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  return createJSONResponse({ result: "success" });
}

function handleDeleteRegionData(ss, region) {
  const sheet = ss.getSheetByName(SHEET_NAMES.VOTES);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return createJSONResponse({ result: "success" });
  
  const values = sheet.getRange(1, 3, lastRow, 1).getValues(); // Column 3 is Region
  for (let i = lastRow; i >= 2; i--) {
    if (values[i-1][0] === region) {
      sheet.deleteRow(i);
    }
  }
  return createJSONResponse({ result: "success" });
}

function ensureSheets(ss) {
  const config = [
    { name: SHEET_NAMES.VOTERS, head: ["id", "name", "region"] },
    { name: SHEET_NAMES.CANDIDATES, head: ["id", "number", "name", "region", "party"] },
    { name: SHEET_NAMES.PARTIES, head: ["id", "number", "name", "constituency_count", "list_count"] },
    { name: SHEET_NAMES.VOTES, head: ["timestamp", "voter", "region", "candidate", "party", "ip"] },
    { name: SHEET_NAMES.SETTINGS, head: ["key", "value"] }
  ];

  config.forEach(c => {
    let s = ss.getSheetByName(c.name);
    if (!s) {
        s = ss.insertSheet(c.name);
        s.appendRow(c.head);
    }
  });
}

function createJSONResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

