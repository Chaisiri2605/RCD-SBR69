import { School, EquipmentItem, SchoolStatus } from "../types";
import { getStatusColor } from "./LeafletMap";
import { 
  Building2, 
  CheckCircle2, 
  CheckSquare,
  Clock, 
  MapPin, 
  Hammer, 
  Layers, 
  Activity, 
  ShoppingBag, 
  Sparkles, 
  TrendingUp, 
  AlertTriangle 
} from "lucide-react";

interface ExecutiveDashboardProps {
  schools: School[];
  onSelectSchool: (school: School) => void;
}

// Estimated standard unit prices in Thai Baht for procurement summary
const ESTIMATED_PRICES: { [key: string]: number } = {
  "อุปกรณ์ป้องกันไฟดูด RCD 16A 30mA": 480,
  "อุปกรณ์ป้องกันไฟดูด RCD 20A 30mA": 520,
  "เบรกเกอร์ RCBO 2P 16A 30mA": 850,
  "สายดิน ทองแดงหุ้มฉนวน Green/Yellow 2.5 mm²": 25, // per meter
  "สายดิน ทองแดงหุ้มฉนวน Green/Yellow 4.0 mm²": 38, // per meter
  "สายดิน ทองแดงหุ้มฉนวน Green/Yellow 6.0 mm²": 52, // per meter
  "หลักดินทองแดงปอก (Ground Rod) 5/8 นิ้ว 2.4 เมตร": 420,
  "หลักดินทองแดงปอก (Ground Rod) 3/8 นิ้ว 1.8 เมตร": 280,
  "แคล้มประกับจับหลักดิน (U-Bolt Clamp)": 45,
  "กล่องครอบกันน้ำ IP55 สำหรับ RCD": 120,
  "ท่อร้อยสายไฟ UPVC สีขาว 1/2 นิ้ว": 35, // per line
  "ข้อต่อท่อสายไฟ 1/2 นิ้ว": 8,
  "เทปพันสายไฟสีดำอย่างดี": 15
};

export function ExecutiveDashboard({ schools, onSelectSchool }: ExecutiveDashboardProps) {
  // Aggregate KPIs
  const totalSchools = schools.length;
  const surveyedSchoolsObj = schools.filter(s => s.status === "ดำเนินการสำรวจแล้ว");
  const assignedSchoolsObj = schools.filter(s => s.status === "มอบหมายงานแล้ว");
  const completedSchoolsObj = schools.filter(s => s.status === "ดำเนินการแล้วเสร็จ");
  const auditedSchoolsObj = schools.filter(s => s.status === "ตรวจรับงานแล้ว");

  const completedCount = completedSchoolsObj.length;
  const auditedCount = auditedSchoolsObj.length;
  const totalDone = completedCount + auditedCount;
  const overallProgressPercent = totalSchools > 0 ? Math.round((totalDone / totalSchools) * 100) : 0;

  // Real inventory count based on school requirements
  const totalRcdCountRequired = schools.reduce((sum, s) => sum + (s.rcdCountRequired || 0), 0);
  const totalGroundRequired = schools.reduce((sum, s) => sum + (s.groundRequired || 0), 0);

  // Breakdown by team
  const teams = ["ทีม 1", "ทีม 2", "ทีม 3"] as const;
  const teamMetrics = teams.map(team => {
    const teamSchools = schools.filter(s => s.assignedTeam === team);
    const assigned = teamSchools.length;
    const completed = teamSchools.filter(s => s.status === "ดำเนินการแล้วเสร็จ" || s.status === "ตรวจรับงานแล้ว").length;
    const progress = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
    return { name: team, assigned, completed, progress };
  });

  // Consolidated procurement requirements
  const procurementMap: { [key: string]: number } = {};
  schools.forEach(school => {
    school.equipmentList.forEach(item => {
      const name = item.name.trim();
      const qty = item.qty || 0;
      if (name) {
        procurementMap[name] = (procurementMap[name] || 0) + qty;
      }
    });
  });

  const procurementList = Object.entries(procurementMap).map(([name, totalQty]) => {
    const unitPrice = ESTIMATED_PRICES[name] || 60; // default estimated price if custom item
    return {
      name,
      totalQty,
      unitPrice,
      totalCost: totalQty * unitPrice
    };
  }).sort((a, b) => b.totalCost - a.totalCost);

  const totalProcurementBudget = procurementList.reduce((sum, item) => sum + item.totalCost, 0);

  // Ground resistance audit: PEA standard matches < 5 Ohms. Identify anomalies
  const groundAnomalies: { school: School; value: number; index: number }[] = [];
  let totalValidReadingsCount = 0;
  let totalReadingsSum = 0;

  schools.forEach(school => {
    school.groundResistanceReadings.forEach((reading, idx) => {
      const val = parseFloat(reading);
      if (!isNaN(val)) {
        totalValidReadingsCount++;
        totalReadingsSum += val;
        if (val > 5.0) {
          groundAnomalies.push({ school, value: val, index: idx + 1 });
        }
      }
    });
  });

  const averageGroundResistance = totalValidReadingsCount > 0 
    ? (totalReadingsSum / totalValidReadingsCount).toFixed(2) 
    : "ยังไม่มีการวัด";

  // Breakdown by subdistrict (ตำบล)
  const subdistrictsMap: { [key: string]: { total: number; completed: number } } = {};
  schools.forEach(s => {
    const sub = s.subdistrict || "ตำบลทั่วไป";
    if (!subdistrictsMap[sub]) {
      subdistrictsMap[sub] = { total: 0, completed: 0 };
    }
    subdistrictsMap[sub].total++;
    if (s.status === "ดำเนินการแล้วเสร็จ" || s.status === "ตรวจรับงานแล้ว") {
      subdistrictsMap[sub].completed++;
    }
  });

  const subdistrictProgressList = Object.entries(subdistrictsMap).map(([name, data]) => {
    return {
      name,
      total: data.total,
      completed: data.completed,
      pct: Math.round((data.completed / data.total) * 100)
    };
  }).sort((a, b) => b.pct - a.pct || b.total - a.total);

  // Circular gauge calculations
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallProgressPercent / 100) * circumference;

  return (
    <div className="space-y-6 text-slate-900 select-none">
      
      {/* 📊 Title metadata header of dashboard */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">แดชบอร์ดสรุปผลผู้จัดซื้อ & ตรวจรับ</h2>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">BENTO WORKSPACE • PROJECT OVERVIEW & METRICS</p>
        </div>
        <div className="flex gap-2">
          <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 font-bold rounded-lg border border-indigo-100 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Active Project
          </span>
          <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 font-bold rounded-lg border border-emerald-100 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Phase: Implementation
          </span>
        </div>
      </div>

      {/* 🍱 Core Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        
        {/* Card 1: Circular Progress Block [col-span-4] */}
        <div className="md:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition">
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center justify-between">
              <span>Overall Progress</span>
              <Activity className="w-4 h-4 text-emerald-500" />
            </h3>
            
            <div className="relative flex items-center justify-center my-4">
              <svg className="w-36 h-36 transform -rotate-90">
                <circle 
                  cx="72" 
                  cy="72" 
                  r={radius} 
                  stroke="currentColor" 
                  strokeWidth="10" 
                  fill="transparent" 
                  className="text-slate-100" 
                />
                <circle 
                  cx="72" 
                  cy="72" 
                  r={radius} 
                  stroke="currentColor" 
                  strokeWidth="10" 
                  fill="transparent" 
                  strokeDasharray={circumference} 
                  strokeDashoffset={strokeDashoffset} 
                  className="text-emerald-500 transition-all duration-1000 ease-out" 
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-black text-slate-900">{overallProgressPercent}%</span>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Complete</span>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2.5 pt-4 border-t border-slate-100">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-500">โรงเรียนเสร็จสิ้น</span>
              <span className="text-emerald-600">{totalDone} / {totalSchools}</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${overallProgressPercent}%` }}></div>
            </div>
          </div>
        </div>

        {/* Card 2: Team Performance [col-span-4] */}
        <div className="md:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition">
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Active Teams</h3>
            <p className="text-[11px] text-slate-500 mb-4">ปริมาณความพร้อมสะสมและการดำเนินการของ 3 ทีมปฏิบัติการ</p>
            
            <div className="space-y-3">
              {teamMetrics.map((t, index) => {
                const colors = [
                  { bg: "bg-red-50/70 border-red-100", text: "text-red-700", bullet: "bg-red-500", progress: "bg-red-500" },
                  { bg: "bg-amber-50/70 border-amber-100", text: "text-amber-700", bullet: "bg-amber-500", progress: "bg-amber-500" },
                  { bg: "bg-blue-50/70 border-blue-100", text: "text-blue-700", bullet: "bg-blue-500", progress: "bg-blue-500" },
                ][index] || { bg: "bg-slate-50 border-slate-100", text: "text-slate-700", bullet: "bg-slate-500", progress: "bg-slate-500" };

                return (
                  <div key={t.name} className={`p-3 rounded-2xl border ${colors.bg} flex flex-col gap-2`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${colors.bullet} ${index === 0 ? "animate-pulse" : ""}`}></div>
                        <span className={`text-xs font-black tracking-tight ${colors.text}`}>{t.name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-600">
                        {t.completed} / {t.assigned} งาน
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                        <div className={`h-full ${colors.progress} rounded-full`} style={{ width: `${t.progress}%` }}></div>
                      </div>
                      <span className="text-[10px] font-black w-7 text-right">{t.progress}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 3: Inventory Target [col-span-4] */}
        <div className="md:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition">
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Inventory Tracking</h3>
            <p className="text-[11px] text-slate-500 mb-5">สรุปภาพรวมจำนวนจุดเซฟตี้ RCD คัตเอาต์ และขั้วตอกสายดินเพื่อตรวจความปลอดภัย</p>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-2 bg-slate-50/50 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">RCD</div>
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-bold text-slate-700">ติดตั้งตัดไฟรั่ว (RCDs)</span>
                    <span className="font-mono font-bold text-indigo-700">{totalRcdCountRequired} ชุด</span>
                  </div>
                  <div className="w-full bg-slate-200/85 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full" style={{ width: "65%" }}></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-2 bg-slate-50/50 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-sm shrink-0">GR</div>
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span className="font-bold text-slate-700">หลักปักกราวด์ (Rods)</span>
                    <span className="font-mono font-bold text-emerald-700">{totalGroundRequired} จุด</span>
                  </div>
                  <div className="w-full bg-slate-200/85 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: "75%" }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 text-[10px] text-amber-900 border border-amber-100 rounded-xl p-3 mt-4">
            * ยอดสรุปจำนวนด้านบน คำนวณแปรผันอิงตามปริมาณที่กรอกปรับแก้ในแบบฟอร์มโรงเรียนจริง
          </div>
        </div>

        {/* Card 4: Ground Resistance Summary [col-span-6] */}
        <div className="md:col-span-6 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
            <span>รายงานวิศวกรรมสายนามธรรม (Ohms Quality)</span>
            <Activity className="w-4 h-4 text-indigo-600" />
          </h3>
          <p className="text-[11px] text-slate-500 mb-4">กฎกระทรวงกำหนดค่าความต้านทานสายดินต้องต่ำกว่า 5 Ω เพื่อป้องกันไฟกระชากรุนแรง</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/80 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-indigo-500 uppercase">ค่าความต้านทานเฉลี่ยโครงการ</span>
              <div className="my-2">
                <span className="text-3xl font-black text-indigo-900">{averageGroundResistance}</span>
                {totalValidReadingsCount > 0 && <span className="text-sm font-bold text-slate-500"> โอห์ม (Ω)</span>}
              </div>
              <span className="text-[10px] text-slate-500 font-semibold">เฉลี่ยจากข้อมูลที่กรอกทั้งหมด {totalValidReadingsCount} จุด</span>
            </div>

            <div className="flex flex-col justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
              {groundAnomalies.length > 0 ? (
                <div className="space-y-1.5 flex-1 flex flex-col justify-between">
                  <div className="text-[11px] font-black text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    พบเตือนค่ากราวด์ดินสูงเกณฑ์! ({groundAnomalies.length} จุด)
                  </div>
                  
                  <div className="space-y-1 overflow-y-auto max-h-[80px] text-left pr-1">
                    {groundAnomalies.map((an, i) => (
                      <div 
                        key={i} 
                        className="text-[10px] flex justify-between items-center text-slate-700 bg-white p-1.5 rounded-lg border border-slate-100 cursor-pointer hover:bg-amber-100 hover:border-amber-200 transition"
                        title="คลิกเพื่อกระโดดดูโรงเรียนนี้"
                        onClick={() => onSelectSchool(an.school)}
                      >
                        <span className="truncate max-w-[130px] font-semibold">{an.school.name}</span>
                        <span className="font-mono font-black text-red-600 shrink-0">{an.value} Ω</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center p-2 text-emerald-800">
                  <CheckSquare className="w-6 h-6 text-emerald-600 mb-1" />
                  <span className="text-[11px] font-black">ปลอดภัยดีเยี่ยม</span>
                  <span className="text-[9px] text-slate-500">ไม่มีจุดติดตั้งใดทะลุเกินวิกฤต 5 Ω</span>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Card 5: Subdistrict Status [col-span-6] */}
        <div className="md:col-span-6 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">ความคืบหน้ารายตำบล</h3>
          <p className="text-[11px] text-slate-500 mb-4">อัตราการตอกสายดินและติดตั้งกล่อง RCD สำเร็จเสร็จสิ้นแยกกระจายตามพื้นที่</p>

          <div className="grid grid-cols-2 gap-3 max-h-[144px] overflow-y-auto pr-1">
            {subdistrictProgressList.map(sub => (
              <div 
                key={sub.name} 
                className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-200/60 hover:bg-slate-100/90 transition"
              >
                <div className="space-y-0.5 min-w-0">
                  <span className="text-xs font-extrabold text-slate-800 block truncate">ต. {sub.name}</span>
                  <span className="text-[10px] text-slate-400 font-bold block">
                    เสร็จ {sub.completed} / {sub.total} ตู้
                  </span>
                </div>
                <div className="shrink-0 flex items-center justify-end">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${sub.pct === 100 ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-indigo-100 text-indigo-800 border border-indigo-200"}`}>
                    {sub.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 6: Consolidated Material Procurement Ledger [col-span-12] */}
        <div className="md:col-span-12 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm hover:shadow-md transition">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Material Procurement List</h3>
              <h4 className="text-slate-900 font-bold text-base flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-600" />
                ใบงบประมาณจัดซื้อและวัสดุโครงสร้างสะสม
              </h4>
            </div>
            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4 text-left">
              <div>
                <div className="text-[9px] text-emerald-800 font-bold uppercase tracking-wider">ประมาณการค่าใช้งบประมาณรวม</div>
                <div className="text-xl font-extrabold text-emerald-700">฿{totalProcurementBudget.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold bg-slate-50">
                  <th className="py-2.5 px-3 rounded-l-xl">รายการพัสดุ / อุปกรณ์</th>
                  <th className="py-2.5 px-3 text-center">รวมจำนวนที่ใช้</th>
                  <th className="py-2.5 px-3 text-right">ราคาประมาณต่อชิ้น</th>
                  <th className="py-2.5 px-3 text-right rounded-r-xl">รวมราคาทั้งสิ้น</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {procurementList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{item.name}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-600">{item.totalQty.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-slate-500 font-mono">฿{item.unitPrice.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-800 font-mono">฿{item.totalCost.toLocaleString()}</td>
                  </tr>
                ))}
                {procurementList.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">ยังไม่พบบันทึกสรุปสำรวจอุปกรณ์ที่ต้องการซื้อในโครงการ</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      
    </div>
  );
}
