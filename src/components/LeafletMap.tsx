import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { School, SchoolStatus, AssignedTeam } from "../types";

// Setup status color map
export const getStatusColor = (status: SchoolStatus, team: AssignedTeam): string => {
  if (status === "ตรวจรับงานแล้ว") return "#6B7280"; // Grey
  if (status === "ดำเนินการแล้วเสร็จ") return "#10B981"; // Green
  if (status === "มอบหมายงานแล้ว") {
    if (team === "ทีม 1") return "#EF4444"; // Red
    if (team === "ทีม 2") return "#FBBF24"; // Yellow (We can use Yellow/Amber)
    if (team === "ทีม 3") return "#3B82F6"; // Blue
  }
  return "#8B5CF6"; // Default / "ดำเนินการสำรวจแล้ว" is Purple or Orange
};

// Help generate high-quality glyphs for the pin content
const getStatusGlyph = (status: SchoolStatus, team: AssignedTeam): string => {
  if (status === "ตรวจรับงานแล้ว") return "★"; // Audited star
  if (status === "ดำเนินการแล้วเสร็จ") return "✔"; // Completed tick
  if (status === "มอบหมายงานแล้ว") {
    if (team === "ทีม 1") return "1";
    if (team === "ทีม 2") return "2";
    if (team === "ทีม 3") return "3";
  }
  return "สำรวจ"; // Surveyed
};

interface LeafletMapProps {
  schools: School[];
  selectedSchool: School | null;
  onSelectSchool: (school: School) => void;
}

export function LeafletMap({ schools, selectedSchool, onSelectSchool }: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: number]: L.Marker }>({});

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up previous instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Center around หนองบัวลำภู / Udon Thani schools centroid
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([17.06, 102.15], 10);
    
    mapInstanceRef.current = map;

    // Add zoom control to top-right
    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Listen for window resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    refreshMarkers(L, map);

    // Enforce an invalidation check right after mount to handle dynamic layout shifts (especially on mobile)
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update/re-render markers when schools list changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && schools.length > 0) {
      refreshMarkers(L, map);
    }
  }, [schools]);

  // Pan map and open popup when selectedSchool changes from parent list
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && selectedSchool) {
      const latLng = [selectedSchool.lat, selectedSchool.lng];
      map.setView(latLng, 13, { animate: true });
      
      const marker = markersRef.current[selectedSchool.id];
      if (marker) {
        setTimeout(() => {
          marker.openPopup();
        }, 300);
      }
    }
  }, [selectedSchool]);

  const refreshMarkers = (L: any, map: any) => {
    // Clear old markers from map
    Object.values(markersRef.current).forEach((marker: any) => {
      map.removeLayer(marker);
    });
    markersRef.current = {};

    schools.forEach((school) => {
      const pinColor = getStatusColor(school.status, school.assignedTeam);
      const glyph = getStatusGlyph(school.status, school.assignedTeam);

      // Create high-fidelity custom HTML PIN structure with ripples and tags
      const customIcon = L.divIcon({
        html: `
          <div class="relative flex flex-col items-center justify-center">
            <!-- Ping animation on working pins -->
            ${school.status === "มอบหมายงานแล้ว" ? `
              <div class="absolute -top-1 w-8 h-8 rounded-full opacity-40 animate-ping" style="background-color: ${pinColor}"></div>
            ` : ""}
            
            <!-- Pin Body -->
            <div class="flex items-center justify-center w-8 h-8 rounded-full text-white font-bold shadow-md ring-2 ring-white border transition-all duration-300 hover:scale-115 hover:shadow-xl" 
                 style="background-color: ${pinColor}; border-color: ${pinColor}">
              <span class="text-[10px] uppercase font-bold">${glyph}</span>
            </div>
            
            <!-- Pointer needle -->
            <div class="w-2 h-2 rotate-45 -mt-1 shadow-sm" style="background-color: ${pinColor}; margin-top: -4px;"></div>
          </div>
        `,
        className: "custom-gmp-marker",
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -36]
      });

      const marker = L.marker([school.lat, school.lng], { icon: customIcon })
        .addTo(map)
        .on("click", () => {
          onSelectSchool(school);
        });

      // Simple interactive marker popup content
      const popupHTML = `
        <div class="p-2 select-none" style="font-family: inherit;">
          <div class="text-xs uppercase font-semibold text-gray-500 mb-0.5">หมายเลขงาน: ${school.jobNo}</div>
          <h4 class="font-bold text-sm text-slate-800 mb-1 leading-snug">${school.name}</h4>
          <div class="text-xs text-slate-600 mb-2">ต. ${school.subdistrict}</div>
          <div class="flex flex-wrap gap-1.5 mb-2.5">
            <span class="px-2 py-0.5 text-[10px] font-medium rounded-full text-white" style="background-color: ${pinColor}">
              ${school.status}
            </span>
            ${school.assignedTeam ? `
              <span class="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                ${school.assignedTeam}
              </span>
            ` : ""}
          </div>
          <div class="grid grid-cols-2 gap-1 text-[11px] bg-slate-50 p-1.5 rounded border border-slate-200">
            <div>⚡ RCD: <span class="font-bold">${school.rcdCountRequired} ชุด</span></div>
            <div>🌱 สายดิน: <span class="font-bold">${school.groundRequired} อุปกรณ์</span></div>
          </div>
          <button class="mt-2.5 w-full bg-emerald-600 text-white rounded py-1 px-2 text-xs font-medium hover:bg-emerald-700 transition" 
                  id="btn-popup-${school.id}">
            ดูใบงานสำรวจ & บันทึกผล
          </button>
        </div>
      `;

      marker.bindPopup(popupHTML, {
        maxWidth: 240,
        className: "gmp-popup-wrap"
      });

      // Hook up the button inside the L Popup once it's created and displayed
      marker.on("popupopen", () => {
        const btn = document.getElementById(`btn-popup-${school.id}`);
        if (btn) {
          btn.addEventListener("click", () => {
            onSelectSchool(school);
          });
        }
      });

      markersRef.current[school.id] = marker;
    });
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-inner border border-slate-200">
      {/* Fallback backdrop if Leaflet loads slowly */}
      <div className="absolute inset-0 bg-slate-50 flex flex-col items-center justify-center pointer-events-none z-0">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2"></div>
        <div className="text-sm text-slate-500 font-medium">กำลังโหลดแผนที่สภาพหน้างาน...</div>
      </div>
      <div ref={mapContainerRef} className="w-full h-full relative z-10" />
    </div>
  );
}
