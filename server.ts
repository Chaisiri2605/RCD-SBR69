import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Set up larger limits for base64 photo uploads
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

const DB_PATH = path.join(process.cwd(), "src", "data", "db.json");
const SEED_PATH = path.join(process.cwd(), "src", "data", "schools_seed.json");

interface EquipmentItem {
  name: string;
  qty: number;
}

interface School {
  id: number;
  jobNo: string;
  name: string;
  subdistrict: string;
  lat: number;
  lng: number;
  rcdCountRequired: number;
  groundRequired: number;
  // Dynamic fields
  status: "ดำเนินการสำรวจแล้ว" | "มอบหมายงานแล้ว" | "ดำเนินการแล้วเสร็จ" | "ตรวจรับงานแล้ว";
  assignedTeam: "ทีม 1" | "ทีม 2" | "ทีม 3" | null;
  equipmentList: EquipmentItem[];
  photoBefore: string | null; // Base64
  photoDuring: string | null;  // Base64
  photoAfter: string | null;  // Base64
  groundResistanceReadings: string[]; // ['3.5', '4.2']
  surveyNotes: string;
  completionNotes: string;
  updatedAt: string;
}

const DEFAULT_CATALOG = [
  "อุปกรณ์ป้องกันไฟดูด RCD 16A 30mA",
  "อุปกรณ์ป้องกันไฟดูด RCD 20A 30mA",
  "เบรกเกอร์ RCBO 2P 16A 30mA",
  "สายดิน ทองแดงหุ้มฉนวน Green/Yellow 2.5 mm²",
  "สายดิน ทองแดงหุ้มฉนวน Green/Yellow 4.0 mm²",
  "สายดิน ทองแดงหุ้มฉนวน Green/Yellow 6.0 mm²",
  "หลักดินทองแดงปอก (Ground Rod) 5/8 นิ้ว 2.4 เมตร",
  "หลักดินทองแดงปอก (Ground Rod) 3/8 นิ้ว 1.8 เมตร",
  "แคล้มประกับจับหลักดิน (U-Bolt Clamp)",
  "กล่องครอบกันน้ำ IP55 สำหรับ RCD",
  "ท่อร้อยสายไฟ UPVC สีขาว 1/2 นิ้ว",
  "ข้อต่อท่อสายไฟ 1/2 นิ้ว",
  "เทปพันสายไฟสีดำอย่างดี"
];

// Seed initial database
function initializeDatabase() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let seedRows: any[] = [];
  if (fs.existsSync(SEED_PATH)) {
    try {
      const seedContent = JSON.parse(fs.readFileSync(SEED_PATH, "utf-8"));
      seedRows = seedContent.rows || [];
    } catch (e) {
      console.error("Failed to read schools_seed.json, generating default schools", e);
    }
  }

  // Prepopulate standard database
  const schools: School[] = seedRows.map((row: any, idx: number) => {
    const id = parseInt(row[0]) || idx + 1;
    const jobNo = row[1] || `JOB-${id}`;
    const name = row[2] || `โรงเรียนตัวอย่าง ${id}`;
    const subdistrict = row[3] || "ตำบลทั่วไป";
    
    // Parse coordinates "17.04073436, 102.1921352"
    let lat = 17.04073436;
    let lng = 102.1921352;
    if (row[4]) {
      const parts = row[4].split(",");
      if (parts.length === 2) {
        lat = parseFloat(parts[0].trim()) || lat;
        lng = parseFloat(parts[1].trim()) || lng;
      }
    }

    const rcdCountRequired = parseInt(row[5]) || 1;
    const groundRequired = parseInt(row[6]) || 1;

    // Distribute statuses across the dataset so there's rich visual mock data on initial load
    let status: School["status"] = "ดำเนินการสำรวจแล้ว";
    let assignedTeam: School["assignedTeam"] = null;
    let groundResistanceReadings: string[] = [];
    
    if (id % 5 === 0) {
      status = "ตรวจรับงานแล้ว";
      assignedTeam = "ทีม 1";
      groundResistanceReadings = Array.from({ length: rcdCountRequired }, () => "3.1");
    } else if (id % 5 === 1) {
      status = "ดำเนินการแล้วเสร็จ";
      assignedTeam = "ทีม 2";
      groundResistanceReadings = Array.from({ length: rcdCountRequired }, () => "4.5");
    } else if (id % 5 === 2) {
      status = "มอบหมายงานแล้ว";
      assignedTeam = "ทีม 1";
    } else if (id % 5 === 3) {
      status = "มอบหมายงานแล้ว";
      assignedTeam = "ทีม 3";
    }

    // Default seed equipment
    const equipmentList = [
      { name: "อุปกรณ์ป้องกันไฟดูด RCD 16A 30mA", qty: rcdCountRequired },
      { name: "หลักดินทองแดงปอก (Ground Rod) 5/8 นิ้ว 2.4 เมตร", qty: groundRequired },
      { name: "สายดิน ทองแดงหุ้มฉนวน Green/Yellow 4.0 mm²", qty: groundRequired * 10 }
    ];

    return {
      id,
      jobNo,
      name,
      subdistrict,
      lat,
      lng,
      rcdCountRequired,
      groundRequired,
      status,
      assignedTeam,
      equipmentList,
      photoBefore: null,
      photoDuring: null,
      photoAfter: null,
      groundResistanceReadings,
      surveyNotes: "สำรวจเรียบร้อย สภาพตู้น้ำเดิมยังไม่ได้ติดตั้งระบบ RCD และค่าสายดินไม่ได้มาตรฐาน",
      completionNotes: status === "ดำเนินการแล้วเสร็จ" || status === "ตรวจรับงานแล้ว" ? "ติดตั้งอุปกรณ์ RCD เปลือกหุ้มIP55 สายดินทองแดงร้อยท่อ ลงหลักกราวด์ทองเหลืองเรียบร้อย" : "",
      updatedAt: new Date().toISOString()
    };
  });

  const dbData = {
    schools,
    equipmentCatalog: DEFAULT_CATALOG,
    lastReset: new Date().toISOString()
  };

  fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2), "utf-8");
  console.log("Database initialized and written to src/data/db.json");
}

// Ensure database file exists
if (!fs.existsSync(DB_PATH)) {
  initializeDatabase();
}

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      initializeDatabase();
    }
    const data = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database:", err);
    initializeDatabase();
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  }
}

function writeDB(data: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing database:", err);
  }
}

// API Endpoints
app.get("/api/db", (req, res) => {
  const db = readDB();
  res.json(db);
});

// Update single school details
app.post("/api/schools/:id/update", (req, res) => {
  const id = parseInt(req.params.id);
  const updateData = req.body;
  const db = readDB();
  
  const schoolIndex = db.schools.findIndex((s: any) => s.id === id);
  if (schoolIndex === -1) {
    return res.status(404).json({ error: "School not found" });
  }

  const existingSchool = db.schools[schoolIndex];
  
  // Merge school updates safely
  const updatedSchool = {
    ...existingSchool,
    ...updateData,
    updatedAt: new Date().toISOString()
  };

  db.schools[schoolIndex] = updatedSchool;
  writeDB(db);
  
  res.json({ success: true, school: updatedSchool });
});

// Add equipment to catalog
app.post("/api/equipment/add", (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Invalid equipment name" });
  }

  const db = readDB();
  const trimmed = name.trim();
  if (trimmed && !db.equipmentCatalog.includes(trimmed)) {
    db.equipmentCatalog.push(trimmed);
    writeDB(db);
    res.json({ success: true, catalog: db.equipmentCatalog });
  } else {
    res.json({ success: false, message: "Equipment already exists or is empty", catalog: db.equipmentCatalog });
  }
});

// Reset database
app.post("/api/reset", (req, res) => {
  initializeDatabase();
  const db = readDB();
  res.json({ success: true, db });
});

// Integrate Vite frontend server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
