import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Activity, UserProfile } from "../types";
import { MapPin, Clock, Users, Home } from "lucide-react";

// Fix for default leaflet icons not showing in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface MapViewProps {
  activities: Activity[];
  onActivityClick: (id: string) => void;
  currentUser?: UserProfile | null;
}

// Rough mapping of IITR locations to coordinates for demonstration
const locationCoords: Record<string, [number, number]> = {
  // Academic & Commons
  "mac": [29.8655, 77.8965],
  "library": [29.8645, 77.8945],
  "main building": [29.8648, 77.8960],
  "sports stadium": [29.8690, 77.8970],
  "lido": [29.8635, 77.8975],
  "nescafe": [29.8640, 77.8950],
  
  // Bhawans
  "azad bhawan": [29.8650, 77.8980],
  "cautley bhawan": [29.8680, 77.8930],
  "ganga bhawan": [29.8690, 77.8950],
  "govind bhawan": [29.8615, 77.8975],
  "jawahar bhawan": [29.8600, 77.8990],
  "kasturba bhawan": [29.8650, 77.8900],
  "radhakrishnan bhawan": [29.8670, 77.8990],
  "rajendra bhawan": [29.8630, 77.8995],
  "rajiv bhawan": [29.8620, 77.8980],
  "ravindra bhawan": [29.8610, 77.8960],
  "sarojini bhawan": [29.8660, 77.8910],
  "vigyan kunj": [29.8675, 77.8920],
};

const IITR_CENTER: [number, number] = [29.8649, 77.8966];

function getCoordinatesForActivity(activity: Activity): [number, number] {
  // Prioritize plotting based on where the Host is from (Bhawan)
  const locationText = (activity.hostBhawan || activity.meetingPoint || activity.venue || activity.destination || "").toLowerCase();
  
  for (const [key, coords] of Object.entries(locationCoords)) {
    if (locationText.includes(key)) {
      // Add slight jitter so markers from the same Bhawan don't perfectly overlap
      return [coords[0] + (Math.random() - 0.5) * 0.0015, coords[1] + (Math.random() - 0.5) * 0.0015];
    }
  }
  
  // Default to center with random jitter if location is not recognized
  return [IITR_CENTER[0] + (Math.random() - 0.5) * 0.005, IITR_CENTER[1] + (Math.random() - 0.5) * 0.005];
}

export default function MapView({ activities, onActivityClick, currentUser }: MapViewProps) {
  // Create a custom icon generator
  const createCustomIcon = (isMyBhawan: boolean) => {
    return L.divIcon({
      className: "custom-map-marker",
      html: `
        <div style="
          background-color: ${isMyBhawan ? '#10b981' : '#000000'};
          color: white;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid white;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
          z-index: ${isMyBhawan ? 1000 : 1};
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${isMyBhawan 
              ? '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>' 
              : '<circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path>'}
          </svg>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15],
    });
  };

  return (
    <div className="w-full h-[60vh] md:h-[70vh] rounded-[2rem] overflow-hidden border border-zinc-200 shadow-md relative z-0">
      <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-sm border border-zinc-100 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[10px] font-black tracking-widest uppercase">
          <div className="w-3 h-3 rounded-full bg-emerald-500 border border-white shadow-sm"></div>
          <span className="text-zinc-600">Your Bhawan ({currentUser?.hostelBlock || "N/A"})</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black tracking-widest uppercase">
          <div className="w-3 h-3 rounded-full bg-black border border-white shadow-sm"></div>
          <span className="text-zinc-600">Other Bhawans</span>
        </div>
      </div>

      <MapContainer center={IITR_CENTER} zoom={16} scrollWheelZoom={true} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {activities.map((activity) => {
          const position = getCoordinatesForActivity(activity);
          const isMyBhawan = Boolean(currentUser?.hostelBlock && activity.hostBhawan && currentUser.hostelBlock.toLowerCase() === activity.hostBhawan.toLowerCase());
          
          return (
            <Marker 
              key={activity.id} 
              position={position}
              icon={createCustomIcon(isMyBhawan)}
              zIndexOffset={isMyBhawan ? 1000 : 0}
            >
              <Popup className="rounded-xl overflow-hidden">
                <div className="p-1 min-w-[200px]">
                  <div className="text-[10px] font-black tracking-widest text-zinc-400 uppercase mb-1">
                    {activity.category}
                  </div>
                  <h3 className="font-extrabold text-sm mb-2 leading-tight">
                    {activity.title}
                  </h3>
                  <div className="flex flex-col gap-1.5 text-xs text-zinc-600 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(activity.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Home className="w-3.5 h-3.5" />
                      <span className="truncate">{activity.hostBhawan || "Campus"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{activity.meetingPoint}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span>{activity.spotsOccupied} / {activity.spotsTotal} Joined</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onActivityClick(activity.id);
                    }}
                    className="w-full bg-black text-white text-[10px] font-black uppercase tracking-wider py-2 rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    View Details
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
