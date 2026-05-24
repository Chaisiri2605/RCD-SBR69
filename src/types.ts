export interface EquipmentItem {
  name: string;
  qty: number;
}

export type SchoolStatus =
  | "ดำเนินการสำรวจแล้ว" // Survey completed, ready for team assignment
  | "มอบหมายงานแล้ว"    // Assigned to Team 1, 2, or 3
  | "ดำเนินการแล้วเสร็จ"  // Installed and ground resistance recorded, awaiting final audit
  | "ตรวจรับงานแล้ว";    // Final check completed by executive

export type AssignedTeam = "ทีม 1" | "ทีม 2" | "ทีม 3" | null;

export interface School {
  id: number;
  jobNo: string;
  name: string;
  subdistrict: string;
  lat: number;
  lng: number;
  rcdCountRequired: number;
  groundRequired: number;
  status: SchoolStatus;
  assignedTeam: AssignedTeam;
  equipmentList: EquipmentItem[];
  photoBefore: string | null;  // Base64 string of equipment preparation
  photoDuring: string | null;  // Base64 string of installation work
  photoAfter: string | null;   // Base64 string of handover photo
  groundResistanceReadings: string[]; // List of ground ohmmeter values e.g. ["2.8", "3.4"]
  surveyNotes: string;
  completionNotes: string;
  updatedAt: string;
}

export interface DatabaseState {
  schools: School[];
  equipmentCatalog: string[];
  lastReset: string;
}

export type UserRole = "executive" | "team_1" | "team_2" | "team_3" | "surveyor";
