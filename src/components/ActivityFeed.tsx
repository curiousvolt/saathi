import React, { useState, useMemo } from "react";
import { Activity, ActivityCategory, UserProfile } from "../types";
import ActivityCard from "./ActivityCard";
import { Search, Sparkles, MapPin, Clock, Home, BookOpen, GraduationCap, Map, List, ChevronRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import MapView, { getCoordinatesForActivity } from "./MapView";

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const VISIBLE_BY_DEFAULT = 6;

interface ActivityFeedProps {
  activities: Activity[];
  onActivityClick: (id: string) => void;
  currentUser?: UserProfile | null;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

export default function ActivityFeed({
  activities,
  onActivityClick,
  currentUser,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: ActivityFeedProps) {
  const [activeCategory, setActiveCategory] = useState<ActivityCategory | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [bhawanFilter, setBhawanFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [sortBy, setSortBy] = useState<"latest" | "distance">("latest");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const isSearching = searchQuery.trim().length > 0 || activeCategory !== "All" || bhawanFilter !== null || sortBy === "distance";

  const categories: (ActivityCategory | "All")[] = ["All", ...Object.values(ActivityCategory)];

  // Unique bhawans from loaded activities for quick-filter chips
  const availableBhawans = useMemo(() => {
    const set = new Set<string>();
    activities.forEach(a => { if (a.hostBhawan) set.add(a.hostBhawan); });
    return Array.from(set).sort();
  }, [activities]);

  const handleSortDistance = () => {
    if (sortBy === "distance") { setSortBy("latest"); return; }
    if (userLocation) { setSortBy("distance"); return; }
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setSortBy("distance");
        setIsLocating(false);
        toast.success("Location found! Sorting by distance.");
      },
      () => {
        toast.error("Could not get your location. Please allow location access.");
        setIsLocating(false);
      }
    );
  };

  // Suggestions: only from loaded activities, scored by similarity
  const suggestions = useMemo(() => {
    if (!currentUser) return [];
    const result: { activity: Activity; score: number; reasons: string[]; percent: number }[] = [];
    activities.forEach((act) => {
      if (act.hostId === currentUser.uid) return;
      if (act.status !== "active") return;
      if (act.spotsOccupied >= act.spotsTotal) return;
      if (act.isArchived) return;
      const expiry = new Date(act.dateTime).getTime() + 2 * 60 * 60 * 1000;
      if (expiry < Date.now()) return;

      let score = 0;
      const reasons: string[] = [];
      if (act.hostBhawan && currentUser.hostelBlock &&
        act.hostBhawan.trim().toLowerCase() === currentUser.hostelBlock.trim().toLowerCase()) {
        score += 35; reasons.push(currentUser.hostelBlock);
      }
      if (act.hostDept && currentUser.dept &&
        act.hostDept.trim().toLowerCase() === currentUser.dept.trim().toLowerCase()) {
        score += 30; reasons.push(currentUser.dept.split(" ")[0]);
      }
      if (act.hostYear && currentUser.year && Number(act.hostYear) === Number(currentUser.year)) {
        score += 25; reasons.push(`Yr ${currentUser.year} Batch`);
      }
      if (currentUser.interests?.length) {
        const matches = currentUser.interests.some(i =>
          act.category.toLowerCase().includes(i.toLowerCase()) ||
          act.title.toLowerCase().includes(i.toLowerCase())
        );
        if (matches) { score += 10; reasons.push("Topic Fit"); }
      }
      if (score > 0) result.push({ activity: act, score, reasons, percent: Math.min(99, 50 + score) });
    });
    return result.sort((a, b) => b.score - a.score);
  }, [activities, currentUser]);

  // Filtered + sorted list
  const filteredActivities = useMemo(() => {
    const now = Date.now();
    const list = activities.filter((activity) => {
      if (activity.isArchived) return false;
      const expiry = new Date(activity.dateTime).getTime() + 2 * 60 * 60 * 1000;
      if (expiry < now) return false;
      if (activeCategory !== "All" && activity.category !== activeCategory) return false;
      if (bhawanFilter && activity.hostBhawan !== bhawanFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          activity.title.toLowerCase().includes(q) ||
          activity.destination?.toLowerCase().includes(q) ||
          activity.venue?.toLowerCase().includes(q) ||
          activity.hostName.toLowerCase().includes(q) ||
          activity.hostBhawan?.toLowerCase().includes(q) ||
          activity.meetingPoint.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    if (sortBy === "distance" && userLocation) {
      list.sort((a, b) => {
        const [latA, lngA] = getCoordinatesForActivity(a);
        const [latB, lngB] = getCoordinatesForActivity(b);
        return getDistance(userLocation.lat, userLocation.lng, latA, lngA) -
               getDistance(userLocation.lat, userLocation.lng, latB, lngB);
      });
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [activities, activeCategory, bhawanFilter, searchQuery, sortBy, userLocation]);

  // When not searching/filtering, only show VISIBLE_BY_DEFAULT; user can expand
  const visibleActivities = isSearching || showAll
    ? filteredActivities
    : filteredActivities.slice(0, VISIBLE_BY_DEFAULT);

  const hiddenCount = filteredActivities.length - visibleActivities.length;

  return (
    <div className="flex flex-col gap-0 pb-24">
      {/* Sticky Controls */}
      <div className="sticky top-[64px] md:top-[80px] bg-white pt-4 pb-4 z-10 md:pt-6 md:pb-4 space-y-4">
        {/* Search bar */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-black transition-colors" />
          <input
            type="text"
            placeholder="Search activities, bhawan, host name..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowAll(false); }}
            className="w-full bg-zinc-100 border border-zinc-200/50 focus:border-zinc-300 focus:bg-white rounded-xl py-3.5 pl-12 pr-4 text-sm font-bold focus:outline-none transition-all placeholder:text-zinc-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black text-xs font-bold px-2 py-1 bg-zinc-200 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category + Sort + View controls */}
        <div className="flex items-center gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setShowAll(false); }}
                className={`px-4 py-2 rounded-full text-[10px] font-black tracking-[0.15em] whitespace-nowrap transition-all border ${
                  activeCategory === cat
                    ? "bg-black border-black text-white"
                    : "bg-white border-zinc-100 text-zinc-400 hover:border-zinc-300"
                }`}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Distance sort */}
          <button
            onClick={handleSortDistance}
            disabled={isLocating}
            className={`p-2 rounded-full transition-all flex items-center gap-1 text-[10px] font-bold border shrink-0 ${
              sortBy === "distance"
                ? "bg-black text-white border-black"
                : "bg-white border-zinc-200 text-zinc-400 hover:border-zinc-400"
            }`}
            title="Sort by Distance"
          >
            {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            <span className="hidden md:inline">{sortBy === "distance" ? "Nearest" : "Distance"}</span>
          </button>

          {/* List / Map toggle */}
          <div className="flex bg-zinc-100 p-1 rounded-full shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-full transition-all ${viewMode === "list" ? "bg-white text-black shadow-sm" : "text-zinc-400"}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`p-2 rounded-full transition-all ${viewMode === "map" ? "bg-white text-black shadow-sm" : "text-zinc-400"}`}
              title="Map View"
            >
              <Map className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bhawan quick-filter chips */}
        {availableBhawans.length > 0 && !searchQuery && activeCategory === "All" && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest self-center shrink-0">Bhawan:</span>
            {bhawanFilter && (
              <button
                onClick={() => setBhawanFilter(null)}
                className="px-3 py-1.5 rounded-full text-[9px] font-black tracking-widest border bg-black text-white border-black whitespace-nowrap shrink-0"
              >
                ✕ {bhawanFilter.split(" ")[0]}
              </button>
            )}
            {availableBhawans.filter(b => b !== bhawanFilter).map((bhawan) => (
              <button
                key={bhawan}
                onClick={() => { setBhawanFilter(bhawan); setShowAll(false); }}
                className="px-3 py-1.5 rounded-full text-[9px] font-black tracking-widest border bg-white border-zinc-100 text-zinc-400 hover:border-zinc-400 whitespace-nowrap shrink-0 transition-all"
              >
                {bhawan.replace(" Bhawan", "").replace(" bhawan", "")}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Suggestions strip (only on default view, no search) */}
      {viewMode === "list" && suggestions.length > 0 && !searchQuery && activeCategory === "All" && !bhawanFilter && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-5 bg-zinc-50 border border-zinc-100 rounded-[2rem]"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-zinc-800 animate-pulse" />
              <div>
                <h3 className="text-xs font-black text-black tracking-tight uppercase">Suggested For You</h3>
                <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">
                  Batchmates & Bhawan neighbours you likely know
                </p>
              </div>
            </div>
            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-200/50 px-2.5 py-1 rounded-full">
              {suggestions.length} matched
            </span>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none snap-x">
            {suggestions.slice(0, 8).map(({ activity, percent, reasons }) => (
              <div
                key={activity.id}
                onClick={() => onActivityClick(activity.id)}
                className="snap-start inline-block w-[260px] md:w-[300px] bg-white border border-zinc-100 hover:border-zinc-300 rounded-[1.8rem] p-5 transition-all flex-shrink-0 whitespace-normal text-left cursor-pointer shadow-xs relative group/card hover:shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="bg-black text-[8px] text-white font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                    {percent}% Match
                  </span>
                  <span className="text-[8px] bg-zinc-100 text-zinc-400 font-extrabold tracking-widest uppercase px-2 py-0.5 rounded">
                    {activity.category}
                  </span>
                </div>
                <h4 className="text-sm font-black text-black tracking-tight leading-snug line-clamp-2 mb-3">{activity.title}</h4>
                <div className="space-y-1.5 mb-4 text-[9px] font-bold text-zinc-400 uppercase tracking-wide">
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3 h-3 text-zinc-300 flex-shrink-0" />
                    <span className="truncate">{activity.destination || activity.venue || activity.meetingPoint}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-zinc-300 flex-shrink-0" />
                    <span>{new Date(activity.dateTime).toLocaleDateString([], { month: "short", day: "numeric" })} · {new Date(activity.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-zinc-50">
                  {reasons.slice(0, 3).map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-zinc-50 border border-zinc-100 text-zinc-500 text-[8px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                      {r.includes("Bhawan") ? <Home className="w-2.5 h-2.5" /> : r.includes("Batch") ? <GraduationCap className="w-2.5 h-2.5" /> : <BookOpen className="w-2.5 h-2.5" />}
                      {r}
                    </span>
                  ))}
                </div>
                <div className="absolute right-4 bottom-4 w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Section header when searching */}
      {isSearching && (
        <div className="flex items-center justify-between mb-4 py-2 border-b border-zinc-100">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            {filteredActivities.length} result{filteredActivities.length !== 1 ? "s" : ""}
            {searchQuery ? ` for "${searchQuery}"` : ""}
            {bhawanFilter ? ` in ${bhawanFilter}` : ""}
          </span>
          {(searchQuery || bhawanFilter || activeCategory !== "All") && (
            <button
              onClick={() => { setSearchQuery(""); setBhawanFilter(null); setActiveCategory("All"); setSortBy("latest"); setShowAll(false); }}
              className="text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-black transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      )}

      {/* Activity list */}
      {viewMode === "map" ? (
        <MapView activities={filteredActivities} onActivityClick={onActivityClick} currentUser={currentUser} />
      ) : visibleActivities.length > 0 ? (
        <>
          {!isSearching && !showAll && (
            <div className="text-[9px] font-black uppercase tracking-widest text-zinc-300 mb-4 flex items-center gap-2">
              <span className="flex-1 h-px bg-zinc-100" />
              <span>Latest Posts</span>
              <span className="flex-1 h-px bg-zinc-100" />
            </div>
          )}

          <div className="flex flex-col">
            <AnimatePresence>
              {visibleActivities.map((activity, idx) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.2) }}
                >
                  <ActivityCard activity={activity} onClick={onActivityClick} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Show more within loaded set */}
          {!isSearching && hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-4 w-full py-4 border-2 border-dashed border-zinc-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:border-zinc-400 hover:text-black transition-all"
            >
              Show {hiddenCount} more loaded post{hiddenCount !== 1 ? "s" : ""}
            </button>
          )}

          {/* Load more from Firestore */}
          {(showAll || isSearching) && hasMore && (
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="mt-6 w-full py-5 bg-zinc-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoadingMore ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Loading more...</>
              ) : (
                "Load More Activities"
              )}
            </button>
          )}

          {/* End of results indicator */}
          {!hasMore && (showAll || isSearching) && filteredActivities.length > 0 && (
            <div className="mt-8 text-center text-[9px] font-black uppercase tracking-widest text-zinc-300 flex items-center gap-3">
              <span className="flex-1 h-px bg-zinc-100" />
              All caught up · {filteredActivities.length} total
              <span className="flex-1 h-px bg-zinc-100" />
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="bg-zinc-100 p-6 rounded-full mb-4">
            <Search className="w-8 h-8 text-zinc-300" />
          </div>
          <h4 className="text-lg font-bold text-zinc-800 mb-1">
            {isSearching ? "No results found" : "No activities yet"}
          </h4>
          <p className="text-sm text-zinc-400 max-w-xs">
            {isSearching
              ? "Try different keywords, a different bhawan, or clear your filters."
              : "Be the first to post an activity and find your Saathi!"}
          </p>
          {isSearching && (
            <button
              onClick={() => { setSearchQuery(""); setBhawanFilter(null); setActiveCategory("All"); setShowAll(false); }}
              className="mt-4 text-xs bg-black text-white font-extrabold uppercase py-2.5 px-5 rounded-full tracking-wider hover:bg-zinc-800 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
