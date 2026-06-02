import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Activity } from "../types";
import { MapPin, Clock, Users } from "lucide-react";

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
}

// Rough mapping of IITR locations to coordinates for demonstration
const locationCoords: Record<string, [number, number]> = {
  "mac": [29.8655, 77.8965],
  "library": [29.8645, 77.8945],
  "main building": [29.8648, 77.8960],
  "rajiv bhawan": [29.8620, 77.8980],
  "radhakrishnan bhawan": [29.8670, 77.8990],
  "cautley bhawan": [29.8680, 77.8930],
  "sarojini bhawan": [29.8660, 77.8910],
  "kasturba bhawan": [29.8650, 77.8900],
  "sports stadium": [29.8690, 77.8970],
  "lido": [29.8635, 77.8975],
  "nescafe": [29.8640, 77.8950],
};

const IITR_CENTER: [number, number] = [29.8649, 77.8966];

function getCoordinatesForActivity(activity: Activity): [number, number] {
  const locationText = (activity.meetingPoint || activity.venue || activity.destination || "").toLowerCase();
  
  for (const [key, coords] of Object.entries(locationCoords)) {
    if (locationText.includes(key)) {
      // Add slight jitter so markers don't perfectly overlap
      return [coords[0] + (Math.random() - 0.5) * 0.0005, coords[1] + (Math.random() - 0.5) * 0.0005];
    }
  }
  
  // Default to center with random jitter if location is not recognized
  return [IITR_CENTER[0] + (Math.random() - 0.5) * 0.005, IITR_CENTER[1] + (Math.random() - 0.5) * 0.005];
}

export default function MapView({ activities, onActivityClick }: MapViewProps) {
  return (
    <div className="w-full h-[60vh] md:h-[70vh] rounded-[2rem] overflow-hidden border border-zinc-200 shadow-md relative z-0">
      <MapContainer center={IITR_CENTER} zoom={16} scrollWheelZoom={true} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        {activities.map((activity) => {
          const position = getCoordinatesForActivity(activity);
          return (
            <Marker key={activity.id} position={position}>
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
