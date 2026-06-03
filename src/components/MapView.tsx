import React, { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import L from "leaflet";
import "leaflet.markercluster";
import { Activity, UserProfile } from "../types";
import { renderToStaticMarkup } from "react-dom/server";

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
  "mac": [29.8655, 77.8965],
  "library": [29.8645, 77.8945],
  "main building": [29.8648, 77.8960],
  "sports stadium": [29.8690, 77.8970],
  "lido": [29.8635, 77.8975],
  "nescafe": [29.8640, 77.8950],
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

// Simple deterministic hash for stable jitter — no random() so markers never jump
function hashJitter(id: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return ((hash % 1000) / 1000) * 0.001;
}

export function getCoordinatesForActivity(activity: Activity): [number, number] {
  const jLat = hashJitter(activity.id, 1);
  const jLng = hashJitter(activity.id, 2);

  if (activity.locationCoords) {
    return [activity.locationCoords.lat + jLat, activity.locationCoords.lng + jLng];
  }

  const locationText = (activity.hostBhawan || activity.meetingPoint || activity.venue || activity.destination || "").toLowerCase();
  for (const [key, coords] of Object.entries(locationCoords)) {
    if (locationText.includes(key)) {
      return [coords[0] + jLat * 3, coords[1] + jLng * 3];
    }
  }

  return [IITR_CENTER[0] + jLat * 10, IITR_CENTER[1] + jLng * 10];
}

// Inner component that uses the map context — handles clustering imperatively
function ClusteredMarkers({
  activities,
  currentUser,
  onActivityClick,
}: {
  activities: Activity[];
  currentUser?: UserProfile | null;
  onActivityClick: (id: string) => void;
}) {
  const map = useMap();
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    // Remove old cluster group
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
    }

    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      // Custom cluster icon — numbered bubble with our design
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const size = count < 10 ? 36 : count < 50 ? 42 : 50;
        return L.divIcon({
          html: `
            <div style="
              background: #000;
              color: #fff;
              width: ${size}px;
              height: ${size}px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 900;
              font-size: ${count < 10 ? 13 : 11}px;
              font-family: system-ui, sans-serif;
              border: 3px solid white;
              box-shadow: 0 4px 12px rgba(0,0,0,0.25);
              letter-spacing: -0.5px;
            ">${count}</div>
          `,
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });

    activities.forEach((activity) => {
      const position = getCoordinatesForActivity(activity);
      const isMyBhawan = Boolean(
        currentUser?.hostelBlock &&
        activity.hostBhawan &&
        currentUser.hostelBlock.toLowerCase() === activity.hostBhawan.toLowerCase()
      );

      const markerIcon = L.divIcon({
        className: "",
        html: `
          <div style="
            background-color: ${isMyBhawan ? "#10b981" : "#000"};
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          ">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              ${isMyBhawan
                ? '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>'
                : '<circle cx="12" cy="10" r="3"></circle><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>'
              }
            </svg>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -18],
      });

      const timeStr = new Date(activity.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const dateStr = new Date(activity.dateTime).toLocaleDateString([], { month: "short", day: "numeric" });
      const location = activity.destination || activity.venue || activity.meetingPoint || "Campus";
      const spotsLeft = activity.spotsTotal - activity.spotsOccupied;

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 200px; padding: 4px;">
          <div style="font-size: 9px; font-weight: 900; letter-spacing: 0.1em; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px;">${activity.category}</div>
          <h3 style="font-weight: 900; font-size: 14px; margin: 0 0 8px; line-height: 1.3; color: #000;">${activity.title}</h3>
          <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">📍 ${location}</div>
          <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">🕒 ${dateStr} · ${timeStr}</div>
          <div style="font-size: 11px; color: #6b7280; margin-bottom: 10px;">👥 ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left</div>
          <button
            onclick="window.__saathiActivityClick && window.__saathiActivityClick('${activity.id}')"
            style="width: 100%; background: #000; color: #fff; border: none; padding: 8px; border-radius: 8px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; cursor: pointer;"
          >View Details</button>
        </div>
      `;

      const marker = L.marker(position, { icon: markerIcon, zIndexOffset: isMyBhawan ? 1000 : 0 });
      marker.bindPopup(popupHtml, { maxWidth: 240 });
      clusterGroup.addLayer(marker);
    });

    clusterGroupRef.current = clusterGroup;
    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [activities, currentUser, map, onActivityClick]);

  // Expose click handler globally for popup button (safe within IITR app scope)
  useEffect(() => {
    (window as any).__saathiActivityClick = onActivityClick;
    return () => { delete (window as any).__saathiActivityClick; };
  }, [onActivityClick]);

  return null;
}

export default function MapView({ activities, onActivityClick, currentUser }: MapViewProps) {
  return (
    <div className="w-full h-[60vh] md:h-[70vh] rounded-[2rem] overflow-hidden border border-zinc-200 shadow-md relative z-0">
      {/* Legend */}
      <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-sm border border-zinc-100 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[10px] font-black tracking-widest uppercase">
          <div className="w-3 h-3 rounded-full bg-emerald-500 border border-white shadow-sm" />
          <span className="text-zinc-600">Your Bhawan ({currentUser?.hostelBlock || "N/A"})</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black tracking-widest uppercase">
          <div className="w-3 h-3 rounded-full bg-black border border-white shadow-sm" />
          <span className="text-zinc-600">Other Bhawans</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black tracking-widest uppercase">
          <div className="w-5 h-5 rounded-full bg-black border border-white shadow-sm flex items-center justify-center text-[8px] text-white font-black">N</div>
          <span className="text-zinc-600">Cluster (zoom to split)</span>
        </div>
      </div>

      {/* Activity count badge */}
      <div className="absolute top-4 right-4 z-[400] bg-black text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm">
        {activities.length} activit{activities.length !== 1 ? "ies" : "y"}
      </div>

      <MapContainer center={IITR_CENTER} zoom={16} scrollWheelZoom={true} className="w-full h-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <ClusteredMarkers
          activities={activities}
          currentUser={currentUser}
          onActivityClick={onActivityClick}
        />
      </MapContainer>
    </div>
  );
}
