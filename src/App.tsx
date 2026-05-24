import { useEffect, useState } from "react";
import { School, DatabaseState, UserRole, SchoolStatus, AssignedTeam, EquipmentItem } from "./types";
import { LeafletMap, getStatusColor } from "./components/LeafletMap";
import { ExecutiveDashboard } from "./components/ExecutiveDashboard";
import { compressImage } from "./utils/imageCompressor";
import { 
  AnimatePresence, 
  motion 
} from "motion/react";
import { 
  Map, 
  ListOrdered, 
  BarChart3, 
  UserSquare2, 
  Search, 
  MapPin, 
  Plus, 
  Trash2, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Zap, 
  Building2, 
  Compass, 
  TrendingUp, 
  CheckSquare, 
  FileSpreadsheet, 
  Hammer, 
  PlusCircle, 
  RotateCcw,
  Activity,
  X 
} from "lucide-react";

export default function App() {
  // State
  const [schools, setSchools] = useState<School[]>([]);
  const [equipmentCatalog, setEquipmentCatalog] = useState<string[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  
  // App Control States
  const [currentRole, setCurrentRole] = useState<UserRole>("executive");
  const [activeTab, setActiveTab] = useState<"map" | "table" | "dashboard">("map");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");

  // Form Temp States inside School Details Panel
  const [tempRcdCount, setTempRcdCount] = useState<number>(1);
  const [tempGroundCount, setTempGroundCount] = useState<number>(1);
  const [tempGroundReadings, setTempGroundReadings] = useState<string[]>([]);
  const [tempEquipmentItem, setTempEquipmentItem] = useState("");
  const [tempEquipmentQty, setTempEquipmentQty] = useState<number>(1);
  const [newEquipmentName, setNewEquipmentName] = useState("");
  const [showAddNewEquipModal, setShowAddNewEquipModal] = useState(false);
  const [surveyNotes, setSurveyNotes] = useState("");
  const [completionNotes, setCompletionNotes] = useState("");
  const [assignedTeam, setAssignedTeam] = useState<AssignedTeam>(null);
  const [jobStatus, setJobStatus] = useState<SchoolStatus>("ดำเนินการสำรวจแล้ว");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch Database
  const fetchDB = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/db");
      if (response.ok) {
        const data: DatabaseState = await response.json();
        setSchools(data.schools);
        setEquipmentCatalog(data.equipmentCatalog);
        
        // Update selection if open
        if (selectedSchool) {
          const updated = data.schools.find(s => s.id === selectedSchool.id);
          if (updated) setSelectedSchool(updated);
        }
      }
    } catch (e) {
      console.error("Failed to fetch database, using local defaults", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDB();
  }, []);

  // Update temp variables when selected school changes
  useEffect(() => {
    if (selectedSchool) {
      setTempRcdCount(selectedSchool.rcdCountRequired || 1);
      setTempGroundCount(selectedSchool.groundRequired || 1);
      setSurveyNotes(selectedSchool.surveyNotes || "");
      setCompletionNotes(selectedSchool.completionNotes || "");
      setAssignedTeam(selectedSchool.assignedTeam);
      setJobStatus(selectedSchool.status);
      
      // Seed ground readings
      const count = selectedSchool.rcdCountRequired || 1;
      const initialReadings = [...selectedSchool.groundResistanceReadings];
      while (initialReadings.length < count) {
        initialReadings.push("");
      }
      setTempGroundReadings(initialReadings.slice(0, count));
    } else {
      setTempEquipmentItem("");
      setTempEquipmentQty(1);
    }
  }, [selectedSchool]);

  // Adjust ground resistance fields array when count is updated in UI
  useEffect(() => {
    if (selectedSchool) {
      setTempGroundReadings(prev => {
        const next = [...prev];
        while (next.length < tempRcdCount) {
          next.push("");
        }
        return next.slice(0, tempRcdCount);
      });
    }
  }, [tempRcdCount]);

  // Reset database to initial seed
  const resetDatabase = async () => {
    if (window.confirm("คุณต้องการรีเซ็ตข้อมูลโครงการทั้งหมดให้กลับเป็นเหมือนข้อมูลใน Google Sheet เริ่มต้นใช่หรือไม่? (การแก้ไขทั้งหมดจะตกลง)")) {
      try {
        const res = await fetch("/api/reset", { method: "POST" });
        if (res.ok) {
          alert("รีเซ็ตฐานข้อมูลสำรวจและติดตั้งอุปกรณ์สำเร็จ!");
          fetchDB();
          setSelectedSchool(null);
        }
      } catch (err) {
        console.error("Failed to reset DB", err);
      }
    }
  };

  // Add custom equipment item to catalog globally
  const handleAddCustomEquipment = async () => {
    if (!newEquipmentName.trim()) return;
    try {
      const res = await fetch("/api/equipment/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newEquipmentName })
      });
      if (res.ok) {
        const data = await res.json();
        setEquipmentCatalog(data.catalog);
        setTempEquipmentItem(newEquipmentName.trim());
        setNewEquipmentName("");
        setShowAddNewEquipModal(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete equipment item from school's requested items
  const handleRemoveEquipment = async (index: number) => {
    if (!selectedSchool) return;
    const updatedList = [...selectedSchool.equipmentList];
    updatedList.splice(index, 1);
    
    await saveSchoolUpdate({ equipmentList: updatedList });
  };

  // Add selected equipment item and quantity to school's requested items
  const handleAddEquipmentToSchool = async () => {
    if (!selectedSchool || !tempEquipmentItem) return;
    
    const currentList = [...selectedSchool.equipmentList];
    const existingIdx = currentList.findIndex(item => item.name === tempEquipmentItem);
    
    if (existingIdx !== -1) {
      currentList[existingIdx].qty += tempEquipmentQty;
    } else {
      currentList.push({ name: tempEquipmentItem, qty: tempEquipmentQty });
    }
    
    await saveSchoolUpdate({ equipmentList: currentList });
    setTempEquipmentQty(1);
  };

  // Upload Photo trigger
  const handlePhotoUpload = async (field: "photoBefore" | "photoDuring" | "photoAfter", file: File) => {
    try {
      setIsSaving(true);
      const base64 = await compressImage(file, 640);
      await saveSchoolUpdate({ [field]: base64 });
    } catch (e) {
      alert("เกิดข้อผิดพลาดในการบีบอัดและอัปโหลดรูปภาพ");
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete photo helper
  const handleDeletePhoto = async (field: "photoBefore" | "photoDuring" | "photoAfter") => {
    if (window.confirm("ต้องการลบรูปภาพนี้ใช่หรือไม่?")) {
      await saveSchoolUpdate({ [field]: null });
    }
  };

  // Save partial or full changes of selectedSchool to database
  const saveSchoolUpdate = async (fieldsToMerge: Partial<School>) => {
    if (!selectedSchool) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/schools/${selectedSchool.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fieldsToMerge)
      });
      if (response.ok) {
        const result = await response.json();
        // Update local state
        setSchools(prev => prev.map(s => s.id === selectedSchool.id ? result.school : s));
        setSelectedSchool(result.school);
      }
    } catch (e) {
      console.error("Failed to update school", e);
      alert("เกิดปัญหาในการบันทึกข้อมูลเข้าสู่เซิร์ฟเวอร์");
    } finally {
      setIsSaving(false);
    }
  };

  // Full manual sheet save triggered by save button
  const handleFullSave = async () => {
    if (!selectedSchool) return;
    
    // Auto sync assignedTeam based on user selection or status
    let finalTeam = assignedTeam;
    let finalStatus = jobStatus;

    if (finalStatus === "ดำเนินการสำรวจแล้ว") {
      finalTeam = null; // can't assign team yet in pure survey
    } else if (finalStatus === "มอบหมายงานแล้ว" && !finalTeam) {
      alert("โปรดมอบหมายงานให้ทีมช่างอย่างน้อย 1 ทีมเมื่อปรับสถานะเป็นมอบหมายงานแล้ว");
      return;
    }

    const updates: Partial<School> = {
      rcdCountRequired: tempRcdCount,
      groundRequired: tempGroundCount,
      status: finalStatus,
      assignedTeam: finalTeam,
      surveyNotes,
      completionNotes,
      groundResistanceReadings: tempGroundReadings.filter(r => r.trim() !== "")
    };

    await saveSchoolUpdate(updates);
    alert("บันทึกข้อมูลใบงานสำเร็จเรียบร้อยแล้ว!");
  };

  // Filtering Logic
  const filteredSchools = schools.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.subdistrict.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.jobNo.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    const matchesTeam = teamFilter === "all" || s.assignedTeam === teamFilter;

    return matchesSearch && matchesStatus && matchesTeam;
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans select-none antialiased p-4 lg:p-6 gap-4">
      
      {/* 🚀 Top Header bar with system information and roles */}
      <header className="bg-white text-slate-900 shadow-sm p-4 rounded-3xl border border-slate-200 flex flex-col lg:flex-row justify-between items-center gap-4 transition">
        
        {/* Brand & title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-md shrink-0">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 flex flex-wrap items-center gap-2">
              RCD & Grounding Safety System
              <span className="text-[10px] uppercase tracking-widest bg-indigo-50 text-indigo-700 font-black px-2.5 py-0.5 rounded-full border border-indigo-100">AppSheet Sync</span>
            </h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">ระบบสำรวจ ออกแบบ จัดซื้อ และควบคุมมาตรฐานตู้น้ำดื่มโรงเรียนปลอดภัย</p>
          </div>
        </div>

        {/* Action Controls Panel */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Quick Database Reset */}
          <button 
            onClick={resetDatabase}
            className="flex items-center gap-1.5 px-3    py-1.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100 transition-all border border-rose-150"
            title="คืนค่าข้อมูลโรงเรียนทั้งหมดตามเดิม"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>คืนค่าฐานข้อมูล</span>
          </button>

          {/* 🎭 Role Simulation Panel - mimics multiple user access */}
          <div className="bg-slate-50 p-1 rounded-2xl border border-slate-200 flex items-center gap-1">
            <span className="text-[11px] font-black text-slate-500 px-2 flex items-center gap-1">
              <UserSquare2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>โหมดสิทธิ์:</span>
            </span>
            <select 
              value={currentRole}
              onChange={(e) => {
                setCurrentRole(e.target.value as UserRole);
                if (e.target.value !== "executive" && activeTab === "dashboard") {
                  setActiveTab("map"); // default back for builders
                }
              }}
              className="bg-white text-xs font-bold text-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-sm"
            >
              <option value="executive">👑 ผู้บริหารโครงการ (Executive)</option>
              <option value="surveyor">📝 ทีมสำรวจ (Surveyor)</option>
              <option value="team_1">👷‍♂️ ทีมติดตั้ง 1 (Team 1)</option>
              <option value="team_2">👷‍♂️ ทีมติดตั้ง 2 (Team 2)</option>
              <option value="team_3">👷‍♂️ ทีมติดตั้ง 3 (Team 3)</option>
            </select>
          </div>
          
        </div>
      </header>

      {/* 🧭 Tabs navigation row */}
      <nav className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 transition">
        
        {/* Navigation Tabs buttons */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full md:w-auto">
          <button 
            onClick={() => setActiveTab("map")}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all flex-1 md:flex-none ${activeTab === "map" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            <Map className="w-4 h-4 text-indigo-600" />
            <span>🗺️ แผนที่พิกัด ({filteredSchools.length})</span>
          </button>
          
          <button 
            onClick={() => setActiveTab("table")}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all flex-1 md:flex-none ${activeTab === "table" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            <ListOrdered className="w-4 h-4 text-indigo-600" />
            <span>📋 บัญชีคุมส่งงาน</span>
          </button>

          {currentRole === "executive" && (
            <button 
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all flex-1 md:flex-none ${activeTab === "dashboard" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              <BarChart3 className="w-4 h-4 text-indigo-650" />
              <span>📊 แดชบอร์ดตรวจสอบ</span>
            </button>
          )}
        </div>

        {/* Global Quick Filter search bar */}
        {activeTab !== "dashboard" && (
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            
            {/* Find Searchbar */}
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input 
                type="text"
                placeholder="ค้นหาชื่อโรงเรียน หรือ ตำบล..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-2xl bg-slate-50 border border-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
              />
            </div>

            {/* Status Selector dropdown */}
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-2xl px-3 py-2 border border-slate-200 focus:outline-none cursor-pointer shadow-sm"
            >
              <option value="all">🔍 ทุกสถานะดำเนินการ</option>
              <option value="ดำเนินการสำรวจแล้ว">📝 สำรวจหน้างานแล้ว</option>
              <option value="มอบหมายงานแล้ว">👷‍♂️ มอบหมายงานแล้ว</option>
              <option value="ดำเนินการแล้วเสร็จ">✔ ดำเนินการแล้วเสร็จ</option>
              <option value="ตรวจรับงานแล้ว">★ ตรวจรับงานแล้ว</option>
            </select>

            {/* Team filter dropdown */}
            <select 
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-2xl px-3 py-2 border border-slate-200 focus:outline-none cursor-pointer shadow-sm"
            >
              <option value="all">👥 ทุกทีมช่าง</option>
              <option value="ทีม 1">🔴 ทีมช่าง 1</option>
              <option value="ทีม 2">🟡 ทีมช่าง 2</option>
              <option value="ทีม 3">🔵 ทีมช่าง 3</option>
            </select>

          </div>
        )}
      </nav>

      {/* 📦 Main Canvas view */}
      <main className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden relative min-h-[calc(100vh-140px)]">
        
        {/* Loading overlay panel */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm font-bold text-slate-700">กำลังเชื่อมสัญญาณดึงข้อมูลจาก Server...</p>
          </div>
        )}

        {/* 🗺️ TAB 1: Navigation Map view */}
        {activeTab === "map" && (
          <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden w-full gap-5">
            
            {/* Sidebar with search results list */}
            <div className="w-full lg:w-96 bg-white rounded-3xl border border-slate-200 flex flex-col h-[300px] lg:h-auto overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <span className="text-xs font-black text-slate-500 uppercase tracking-wider">รายชื่อโรงเรียน ({filteredSchools.length})</span>
                <span className="text-[10px] font-bold text-slate-400 font-mono">จ.หนองบัวลำภู</span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {filteredSchools.map(s => {
                  const pinColor = getStatusColor(s.status, s.assignedTeam);
                  const isSelected = selectedSchool?.id === s.id;
                  
                  return (
                    <div 
                      key={s.id}
                      onClick={() => setSelectedSchool(s)}
                      className={`p-3.5 hover:bg-slate-50 transition cursor-pointer select-none text-left flex items-start gap-3 border-l-4 ${isSelected ? "bg-indigo-50/40 border-indigo-600" : "border-transparent"}`}
                    >
                      <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm" style={{ backgroundColor: pinColor }}>
                        {s.id}
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wide flex items-center justify-between">
                          <span>{s.jobNo}</span>
                          <span className="text-[10px] font-bold" style={{ color: pinColor }}>● {s.status}</span>
                        </div>
                        <h4 className="font-extrabold text-xs text-slate-800 leading-snug truncate" title={s.name}>{s.name}</h4>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="flex items-center gap-0.5 font-medium">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            ต. {s.subdistrict}
                          </span>
                          {s.assignedTeam && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-[10px] rounded-lg border border-slate-200 font-bold text-slate-600">
                              {s.assignedTeam}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredSchools.length === 0 && (
                  <div className="p-10 text-center text-slate-400 text-xs font-bold">ไม่พบโรงเรียนที่ค้นหาในเงื่อนไขตัวกรอง</div>
                )}
              </div>
            </div>

            {/* Native Map Component */}
            <div className="flex-1 relative h-[400px] lg:h-auto min-h-[400px] rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
              <LeafletMap 
                schools={filteredSchools}
                selectedSchool={selectedSchool}
                onSelectSchool={(school) => setSelectedSchool(school)}
              />
            </div>

          </div>
        )}

        {/* 📋 TAB 2: Table Ledger index */}
        {activeTab === "table" && (
          <div className="flex-1 bg-white p-6 rounded-3xl border border-slate-200 overflow-y-auto w-full shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-slate-900 font-black text-lg flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                  ทะเบียนคุมความปลอดภัยตู้น้ำดื่มโรงเรียน
                </h2>
                <p className="text-xs text-slate-500 font-medium">รายการพิกัด บันทึกผลสำรวจ และการติดตั้งเซฟตี้เบรกเกอร์ RCD ทั้งหมด ({filteredSchools.length} โรงเรียน)</p>
              </div>
              <div className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 px-3 py-1 rounded-full shrink-0">
                จังหวัดหนองบัวลำภู
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-inner bg-slate-50/10">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-extrabold border-b border-slate-200">
                    <th className="py-3 px-4 text-center">ลำดับ</th>
                    <th className="py-3 px-3">หมายเลขใบงาน</th>
                    <th className="py-3 px-3">ชื่อโรงเรียน</th>
                    <th className="py-3 px-3">ตำบล</th>
                    <th className="py-3 px-3">สถานะขั้นตอน</th>
                    <th className="py-3 px-3">ทีมผู้รับผิดชอบ</th>
                    <th className="py-3 px-3 text-center">RCD (ชุด)</th>
                    <th className="py-3 px-3 text-center">สายดิน (จุด)</th>
                    <th className="py-3 px-3">ค่ากราวด์ดินเฉลี่ย (Ω)</th>
                    <th className="py-3 px-3 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredSchools.map((s, idx) => {
                    const pinColor = getStatusColor(s.status, s.assignedTeam);
                    
                    // Calc average ohm
                    const omhs = s.groundResistanceReadings.map(parseFloat).filter(v => !isNaN(v));
                    const avgOhm = omhs.length > 0 ? (omhs.reduce((tot, v) => tot + v, 0) / omhs.length).toFixed(1) : "-";
                    
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 text-center font-bold text-slate-400">{s.id}</td>
                        <td className="py-3.5 px-3 font-mono font-bold text-[11px] text-slate-500">{s.jobNo}</td>
                        <td className="py-3.5 px-3 font-extrabold text-slate-800 text-left">{s.name}</td>
                        <td className="py-3.5 px-3 text-slate-500 font-semibold">ต. {s.subdistrict}</td>
                        <td className="py-3.5 px-3">
                          <span 
                            className="px-2.5 py-1 text-[10px] rounded-full text-white font-extrabold inline-block shadow-sm"
                            style={{ backgroundColor: pinColor }}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          {s.assignedTeam ? (
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-extrabold border border-slate-200">
                              {s.assignedTeam}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold">- ยังไม่ระบุ -</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-700">{s.rcdCountRequired}</td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-700">{s.groundRequired}</td>
                        <td className="py-3.5 px-3 font-mono font-bold text-slate-700 text-center">
                          {avgOhm !== "-" ? (
                            <span className={parseFloat(avgOhm) > 5 ? "text-red-600 bg-red-50 px-2 py-0.5 border border-red-100 rounded font-extrabold" : "text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-100 rounded font-extrabold"}>
                              {avgOhm} Ω
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button 
                            onClick={() => setSelectedSchool(s)}
                            className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-xl border border-indigo-200 font-extrabold transition shadow-sm"
                          >
                            บันทึกงาน
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSchools.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400 font-bold">ไม่พบข้อมูลโรงเรียนในระบบ</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 📊 TAB 3: Executive Stats Analytics Dashboard */}
        {activeTab === "dashboard" && currentRole === "executive" && (
          <div className="flex-1 bg-transparent p-0 overflow-y-auto w-full">
            <ExecutiveDashboard 
              schools={schools}
              onSelectSchool={(school) => {
                setSelectedSchool(school);
                setActiveTab("map"); // auto switch to map to show detail
              }}
            />
          </div>
        )}

        {/* 🗄️ RIGHT SLIDING SHEET: School Detail Checklist Panel */}
        <AnimatePresence>
          {selectedSchool && (
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 180 }}
              className="absolute lg:relative right-0 top-0 bottom-0 w-full lg:w-[480px] bg-white shadow-2xl border-l border-slate-200 rounded-l-3xl flex flex-col z-40 h-full overflow-hidden"
            >
              {/* Sheet header */}
              <div className="px-5 py-4 bg-slate-50 text-slate-900 flex justify-between items-center border-b border-slate-200">
                <div className="min-w-0">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">หมายเลขงาน: {selectedSchool.jobNo}</div>
                  <h3 className="font-black text-sm truncate pr-4 text-indigo-700" title={selectedSchool.name}>
                    {selectedSchool.name}
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedSchool(null)}
                  className="rounded-xl p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-800 transition border border-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sheet body scrollable */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* School Geolocation details card */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3 text-left">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                    <Compass className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <h5 className="text-[11px] font-bold text-slate-400 uppercase">ตำแหน่งละติจูด/ลองจิจูด</h5>
                    <p className="text-xs font-mono font-bold text-slate-800">{selectedSchool.lat}, {selectedSchool.lng}</p>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <MapPin className="w-3 h-3 text-emerald-600" />
                      ตำบล {selectedSchool.subdistrict}, อำเภอสุวรรณคูหา
                    </span>
                  </div>
                </div>

                {/* 🏗️ Section 1: Survey Equipment setups */}
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                    <h4 className="font-extrabold text-xs text-indigo-900 flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ข้อมูลสำรวจจำนวนตู้น้ำ & อุปกรณ์ความต้องการ
                    </h4>
                    <span className="text-[10px] text-slate-400 font-bold">ขั้นตอนสำรวจ</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">RCD ที่ต้องใช้ (ชุด)</label>
                      <input 
                        type="number"
                        min="1"
                        max="10"
                        disabled={currentRole !== "surveyor" && currentRole !== "executive"}
                        value={tempRcdCount}
                        onChange={(e) => setTempRcdCount(parseInt(e.target.value) || 1)}
                        className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-emerald-500 disabled:opacity-60"
                      />
                    </div>
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">จุดที่ต้องตอกสายดิน (จุด)</label>
                      <input 
                        type="number"
                        min="1"
                        max="10"
                        disabled={currentRole !== "surveyor" && currentRole !== "executive"}
                        value={tempGroundCount}
                        onChange={(e) => setTempGroundCount(parseInt(e.target.value) || 1)}
                        className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-300 rounded-xl focus:border-emerald-500 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {/* Survey materials list */}
                  <div className="space-y-2 text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">อุปกรณ์ที่ใช้สรุปจัดซื้อเฉพาะหน้าเพื่อเข้างาน</label>
                    
                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[160px] overflow-y-auto bg-slate-50">
                      {selectedSchool.equipmentList.map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition">
                          <span className="truncate max-w-[200px]">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black text-[11px] font-mono">x {item.qty}</span>
                            {(currentRole === "surveyor" || currentRole === "executive") && (
                              <button 
                                onClick={() => handleRemoveEquipment(index)}
                                className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {selectedSchool.equipmentList.length === 0 && (
                        <div className="p-4 text-center text-slate-400 text-[11px]">ไม่มีอุปกรณ์จัดซื้อบันทึกสำหรับโรงเรียนนี้</div>
                      )}
                    </div>

                    {/* Add Equipment form */}
                    {(currentRole === "surveyor" || currentRole === "executive") && (
                      <div className="flex items-center gap-1.5 pt-1">
                        
                        {/* Dropdown catalog */}
                        <div className="flex-1">
                          <select
                            value={tempEquipmentItem}
                            onChange={(e) => setTempEquipmentItem(e.target.value)}
                            className="w-full p-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
                          >
                            <option value="">-- เลือกอุปกรณ์จากลิสต์ระบบ --</option>
                            {equipmentCatalog.map((eq, i) => (
                              <option key={i} value={eq}>{eq}</option>
                            ))}
                          </select>
                        </div>

                        {/* Qty count input */}
                        <input 
                          type="number"
                          min="1"
                          max="100"
                          value={tempEquipmentQty}
                          onChange={(e) => setTempEquipmentQty(parseInt(e.target.value) || 1)}
                          className="w-14 p-2 text-xs text-center font-bold bg-white border border-slate-300 rounded-xl"
                          placeholder="จำนวน"
                        />

                        {/* Add button */}
                        <button
                          onClick={handleAddEquipmentToSchool}
                          disabled={!tempEquipmentItem}
                          className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition shadow-sm"
                          title="เพิ่มอุปกรณ์ชิ้นนี้ให้โรงเรียน"
                        >
                          <Plus className="w-4 h-4" />
                        </button>

                        {/* New custom popup open */}
                        <button
                          onClick={() => setShowAddNewEquipModal(true)}
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 transition text-[10px] font-bold uppercase shrink-0"
                          title="ลงทะเบียนของใหม่ในสารบบ"
                        >
                          <PlusCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">หมายเหตุสำรวจหน้างาน</label>
                    <textarea 
                      value={surveyNotes}
                      disabled={currentRole !== "surveyor" && currentRole !== "executive"}
                      onChange={(e) => setSurveyNotes(e.target.value)}
                      rows={2}
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:border-indigo-500 disabled:opacity-60"
                      placeholder="เช่น ข้อมูลเครื่องกรองน้ำ, ชุดครอบเบรกเกอร์ติดตั้งภายนอกอาคาร..."
                    />
                  </div>

                </div>

                {/* 🚧 Section 2: Assign team and deployment status */}
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="font-extrabold text-xs text-amber-900 flex items-center gap-1.5">
                      <Hammer className="w-4 h-4 text-amber-600" />
                      มอบหมายทีมติดตั้ง & บันทึกสถานะงาน
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-bold text-slate-400">ผู้รับผิดชอบงาน</label>
                      <select 
                        value={assignedTeam || ""}
                        disabled={currentRole !== "executive"} // Only executive can assign roles
                        onChange={(e) => setAssignedTeam(e.target.value ? e.target.value as AssignedTeam : null)}
                        className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:border-amber-500 disabled:opacity-75 cursor-pointer"
                      >
                        <option value="">-- ยังไม่ได้มอบหมายความรับผิดชอบ --</option>
                        <option value="ทีม 1">🔴 ทีมช่างด่วน 1</option>
                        <option value="ทีม 2">🟡 ทีมช่างด่วน 2</option>
                        <option value="ทีม 3">🔵 ทีมช่างด่วน 3</option>
                      </select>
                      {currentRole !== "executive" && (
                        <p className="text-[9px] text-slate-400 font-semibold">* มีเฉพาะแอดมิน/ผู้บริการ เท่านั้นที่ปรับมอบหมายทีมได้</p>
                      )}
                    </div>
                    
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-bold text-slate-400">สถานะดำเนินการ</label>
                      <select 
                        value={jobStatus}
                        onChange={(e) => setJobStatus(e.target.value as SchoolStatus)}
                        className="w-full p-2.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl focus:border-amber-500 cursor-pointer"
                      >
                        {/* Permissions check inside roles */}
                        <option value="ดำเนินการสำรวจแล้ว">📝 สำรวจหน้างานเสร็จแล้ว</option>
                        <option value="มอบหมายงานแล้ว">👷‍♂️ มอบหมายงานแล้ว</option>
                        <option value="ดำเนินการแล้วเสร็จ">✔ ติดตั้งสำเร็จเสร็จสิ้น</option>
                        {currentRole === "executive" && (
                          <option value="ตรวจรับงานแล้ว">★ รับรอง/ตรวจรับงานผ่าน</option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 🛡️ Section 3: Ground resistance, metrics values */}
                <div className="space-y-4 bg-indigo-50/40 p-4 border border-indigo-100 rounded-2xl">
                  <div className="border-b border-indigo-100 pb-1.5 flex justify-between items-center">
                    <h4 className="font-extrabold text-xs text-indigo-950 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-indigo-700 animate-pulse" />
                      ผลการบันทึกค่าความต้านทานสายดิน (Ground Ohmmeter)
                    </h4>
                  </div>

                  {tempGroundReadings.length > 0 ? (
                    <div className="space-y-3">
                      {tempGroundReadings.map((reading, idx) => {
                        const val = parseFloat(reading);
                        const isFieldOhmicOk = !isNaN(val) && val <= 5.0;
                        const isFieldOhmicBad = !isNaN(val) && val > 5.0;

                        return (
                          <div key={idx} className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-indigo-200">
                            <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">ตู้น้ำจุดที่ {idx+1}:</span>
                            <div className="flex-1 flex items-center gap-2">
                              <input 
                                type="text"
                                placeholder="เช่น 2.8"
                                value={reading}
                                onChange={(e) => {
                                  setTempGroundReadings(prev => {
                                    const next = [...prev];
                                    next[idx] = e.target.value;
                                    return next;
                                  });
                                }}
                                className="w-full text-xs font-bold p-1.5 bg-slate-50 border border-slate-300 rounded focus:border-emerald-500 font-mono text-center"
                              />
                              <span className="text-xs font-semibold text-slate-500">Ω</span>
                            </div>

                            {/* Safety visual alert badges */}
                            <div className="w-16 flex justify-center shrink-0">
                              {isFieldOhmicOk && (
                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-1 rounded inline-flex items-center gap-0.5">
                                  <CheckCircle className="w-3 h-3 text-emerald-600" /> ปลอดภัย
                                </span>
                              )}
                              {isFieldOhmicBad && (
                                <span className="bg-red-100 text-red-800 text-[9px] font-extrabold px-1.5 py-1 rounded inline-flex items-center gap-0.5 animate-bounce">
                                  <AlertCircle className="w-3 h-3 text-red-600" /> เกินเกณฑ์!
                                </span>
                              )}
                              {!reading && (
                                <span className="text-[10px] text-slate-400">ยังไม่วัด</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {tempGroundReadings.some(r => parseFloat(r) > 5.0) && (
                        <div className="bg-red-50 text-red-800 text-[10px] font-bold p-2.5 rounded-xl border border-red-200 flex items-start gap-1.5">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <span>ค่าความต้านทานเกิน 5 Ω อาจทำให้ผู้ใช้น้ำโดนกระแสไฟรั่วดูดได้ โปรดตอกแท่งกราวด์เสริม ขันข้อต่อ และทดสอบขั้วซ้ำ!</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center">ยังไม่ได้ระบุจำนวน RCD เพื่อวัดค่าสายดิน</p>
                  )}

                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-bold text-indigo-700">หมายเหตุงานติดตั้ง & กราวด์สายไฟ</label>
                    <textarea 
                      value={completionNotes}
                      onChange={(e) => setCompletionNotes(e.target.value)}
                      rows={2}
                      className="w-full text-xs p-2 bg-white border border-indigo-200 rounded-xl focus:border-emerald-500"
                      placeholder="บันทึกรายละเอียดงาน เช่น การเชื่อมสายดิน, ตำแหน่งหลักดิน..."
                    />
                  </div>
                </div>

                {/* 📸 Section 4: Site Photos Confirmations */}
                <div className="space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h4 className="font-extrabold text-xs text-slate-700 flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-slate-500" />
                      บันทึกภาพถ่ายยืนยันผลการทำงาน (Site Photos)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    
                    {/* Photo 1: Before / Preparation */}
                    <div className="space-y-1.5 text-left">
                      <span className="text-[11px] font-bold text-slate-500 block">1. ภาพอุปกรณ์/การเตรียมงานก่อนเริ่ม (Before)</span>
                      {selectedSchool.photoBefore ? (
                        <div className="relative h-40 rounded-xl overflow-hidden border border-slate-300 shadow-sm grup">
                          <img src={selectedSchool.photoBefore} alt="Before installation" className="w-full h-full object-cover" />
                          <button 
                            onClick={() => handleDeletePhoto("photoBefore")}
                            className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-lg hover:bg-red-700 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 rounded-xl h-24 flex flex-col items-center justify-center cursor-pointer transition">
                          <Upload className="w-6 h-6 text-slate-400 mb-1" />
                          <span className="text-[10px] font-bold text-slate-500">คลิกที่นี่เพื่ออัปโหลดภาพก่อนทำ</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => e.target.files?.[0] && handlePhotoUpload("photoBefore", e.target.files[0])}
                          />
                        </label>
                      )}
                    </div>

                    {/* Photo 2: Installation Process */}
                    <div className="space-y-1.5 text-left">
                      <span className="text-[11px] font-bold text-slate-500 block">2. ภาพอุปกรณ์ RCD และสายดินหลังติดตั้ง (During)</span>
                      {selectedSchool.photoDuring ? (
                        <div className="relative h-40 rounded-xl overflow-hidden border border-slate-300 shadow-sm grup">
                          <img src={selectedSchool.photoDuring} alt="During installation" className="w-full h-full object-cover" />
                          <button 
                            onClick={() => handleDeletePhoto("photoDuring")}
                            className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-lg hover:bg-red-700 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 rounded-xl h-24 flex flex-col items-center justify-center cursor-pointer transition">
                          <Upload className="w-6 h-6 text-slate-400 mb-1" />
                          <span className="text-[10px] font-bold text-slate-500">คลิกที่นี่เพื่ออัปโหลดภาพการติดตั้ง</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => e.target.files?.[0] && handlePhotoUpload("photoDuring", e.target.files[0])}
                          />
                        </label>
                      )}
                    </div>

                    {/* Photo 3: After / Delivery */}
                    <div className="space-y-1.5 text-left">
                      <span className="text-[11px] font-bold text-slate-500 block">3. ภาพการส่งมอบความลุล่วงตู้น้ำดื่ม (After)</span>
                      {selectedSchool.photoAfter ? (
                        <div className="relative h-40 rounded-xl overflow-hidden border border-slate-300 shadow-sm grup">
                          <img src={selectedSchool.photoAfter} alt="After delivery" className="w-full h-full object-cover" />
                          <button 
                            onClick={() => handleDeletePhoto("photoAfter")}
                            className="absolute top-2 right-2 bg-red-600 text-white p-1.5 rounded-lg hover:bg-red-700 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 rounded-xl h-24 flex flex-col items-center justify-center cursor-pointer transition">
                          <Upload className="w-6 h-6 text-slate-400 mb-1" />
                          <span className="text-[10px] font-bold text-slate-500">คลิกที่นี่เพื่ออัปโหลดภาพส่งมอบงาน</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => e.target.files?.[0] && handlePhotoUpload("photoAfter", e.target.files[0])}
                          />
                        </label>
                      )}
                    </div>

                  </div>
                </div>

              </div>

              {/* Sheet footer with save actions */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                <button 
                  onClick={() => setSelectedSchool(null)}
                  className="flex-1 py-2 px-3 text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-xl transition"
                >
                  ออก/ปิดใบงาน
                </button>
                <button 
                  onClick={handleFullSave}
                  disabled={isSaving}
                  className="flex-1 py-2 px-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 rounded-xl transition shadow flex items-center justify-center gap-1"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <span>บันทึกใบงานสมบูรณ์</span>
                  )}
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* 🔮 Add New Equipment Catalog Modal Overlay popup */}
      {showAddNewEquipModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-emerald-500/10">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-indigo-950">ลงทะเบียนวัสดุจัดซื้อใหม่ในระบบ</h3>
              <button 
                onClick={() => setShowAddNewEquipModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold text-slate-400 uppercase">กรอกชื่ออุปกรณ์หรือวัสดุทางเทคนิค</label>
              <input 
                type="text"
                placeholder="เช่น เบรกเกอร์ควบคุม 2 เฟส IP65, เทปยางละลาย"
                value={newEquipmentName}
                onChange={(e) => setNewEquipmentName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-emerald-600"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAddNewEquipModal(false)}
                className="flex-1 bg-slate-200 text-slate-700 py-1.5 px-3 rounded-xl text-xs font-extrabold hover:bg-slate-300"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleAddCustomEquipment}
                disabled={!newEquipmentName.trim()}
                className="flex-1 bg-emerald-600 disabled:bg-emerald-400 text-white py-1.5 px-3 rounded-xl text-xs font-extrabold hover:bg-emerald-700"
              >
                ลงทะเบียนเข้าระบบ
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
