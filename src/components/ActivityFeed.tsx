import React, { useState } from "react";
import { Activity, ActivityCategory, UserProfile } from "../types";
import ActivityCard from "./ActivityCard";
import { Search, Filter, Sparkles, MapPin, Clock, Users, ChevronRight, BookOpen, Home, GraduationCap, Map, List } from "lucide-react";
import { motion } from "motion/react";
import MapView from "./MapView";

interface ActivityFeedProps {
  activities: Activity[];
  onActivityClick: (id: string) => void;
  currentUser?: UserProfile | null;
}

export default function ActivityFeed({ activities, onActivityClick, currentUser }: ActivityFeedProps) {
  const [activeCategory, setActiveCategory] = useState<ActivityCategory | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const categories: (ActivityCategory | "All")[] = ["All", ...Object.values(ActivityCategory)];

  // Calculate suggestions based on similarity metrics
  const suggestions: { activity: Activity; score: number; reasons: string[]; percent: number }[] = [];
  
  if (currentUser) {
    activities.forEach((act) => {
      // Safety and privacy filters
      if (act.hostId === currentUser.uid) return;
      if (act.status !== "active") return;
      if (act.spotsOccupied >= act.spotsTotal) return;

      let score = 0;
      const reasons: string[] = [];

      // Bhawan / Hostel match (Very high score since living together is an active contact)
      if (
        act.hostBhawan &&
        currentUser.hostelBlock &&
        act.hostBhawan.trim().toLowerCase() === currentUser.hostelBlock.trim().toLowerCase()
      ) {
        score += 35;
        reasons.push(currentUser.hostelBlock);
      }

      // Dept / Branch match
      if (
        act.hostDept &&
        currentUser.dept &&
        act.hostDept.trim().toLowerCase() === currentUser.dept.trim().toLowerCase()
      ) {
        score += 30;
        // Simple short name for the branch
        reasons.push(currentUser.dept.split(" ")[0]);
      }

      // Year match
      if (
        act.hostYear &&
        currentUser.year &&
        Number(act.hostYear) === Number(currentUser.year)
      ) {
        score += 25;
        reasons.push(`Yr ${currentUser.year} Batch`);
      }

      // Interest keyword overlap
      if (currentUser.interests && currentUser.interests.length > 0) {
        const matchesInterest = currentUser.interests.some(interest =>
          act.category.toLowerCase().includes(interest.toLowerCase()) ||
          act.title.toLowerCase().includes(interest.toLowerCase())
        );
        if (matchesInterest) {
          score += 10;
          reasons.push("Topic Fit");
        }
      }

      if (score > 0) {
        // Base match probability starts at 55% and scales with similarity score
        const percent = Math.min(99, 50 + score);
        suggestions.push({
          activity: act,
          score,
          reasons,
          percent
        });
      }
    });

    // Sort by highest score first
    suggestions.sort((a, b) => b.score - a.score);
  }

  const filteredActivities = activities.filter((activity) => {
    const isNotFull = activity.spotsOccupied < activity.spotsTotal;
    const matchesCategory = activeCategory === "All" || activity.category === activeCategory;
    const matchesSearch =
      activity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.destination?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.hostName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (activity.hostBhawan && activity.hostBhawan.toLowerCase().includes(searchQuery.toLowerCase()));
    return isNotFull && matchesCategory && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-0 pb-24">
      <div className="sticky top-[64px] md:top-[80px] bg-white pt-4 pb-4 z-10 md:pt-6 md:pb-6">
        <div className="flex flex-col gap-8">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-black transition-colors" />
            <input
              type="text"
              placeholder="Find your next adventure or bhawan circle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-100 border border-zinc-200/50 focus:border-zinc-300 focus:bg-white rounded-xl py-4 pl-12 pr-4 text-xl font-bold focus:outline-none transition-all placeholder:text-zinc-400"
            />
          </div>

          <div className="flex justify-between items-center gap-4">
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none flex-1">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-6 py-2.5 rounded-full text-[10px] font-black tracking-[0.15em] whitespace-nowrap transition-all border ${
                    activeCategory === category
                      ? "bg-black border-black text-white"
                      : "bg-white border-zinc-100 text-zinc-400 hover:border-zinc-300"
                  }`}
                >
                  {category.toUpperCase()}
                </button>
              ))}
            </div>
            
            <div className="flex bg-zinc-100 p-1 rounded-full shrink-0">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-full transition-all ${viewMode === "list" ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-zinc-600"}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`p-2 rounded-full transition-all ${viewMode === "map" ? "bg-white text-black shadow-sm" : "text-zinc-400 hover:text-zinc-600"}`}
                title="Map View"
              >
                <Map className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Matches Section (Smart Algorithm based on hostel, year, dept) */}
      {viewMode === "list" && suggestions.length > 0 && searchQuery === "" && activeCategory === "All" && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 p-6 bg-zinc-50 border border-zinc-100 rounded-[2rem]"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-zinc-800 animate-pulse" />
              <div>
                <h3 className="text-xs font-black text-black tracking-tight uppercase">SUGGESTED FOR YOU</h3>
                <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest leading-none mt-0.5">
                  IITR Batchmates & Bhawan neighbours you likely know
                </p>
              </div>
            </div>
            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest bg-zinc-200/50 px-2.5 py-1 rounded-full">
              {suggestions.length} Circles matched
            </span>
          </div>

          {/* Horizontal Swiper */}
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none snap-x">
            {suggestions.map(({ activity, percent, reasons }) => (
              <div
                key={activity.id}
                onClick={() => onActivityClick(activity.id)}
                className="snap-start inline-block w-[280px] md:w-[320px] bg-white border border-zinc-100 hover:border-zinc-300 rounded-[1.8rem] p-5 transition-all flex-shrink-0 whitespace-normal text-left cursor-pointer shadow-xs relative group/card hover:shadow-sm"
              >
                {/* Match bubble */}
                <div className="flex items-center justify-between mb-3">
                  <span className="bg-black text-[8px] text-white font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                    {percent}% Match
                  </span>
                  <span className="text-[8px] bg-zinc-100 text-zinc-400 font-extrabold tracking-widest uppercase px-2 py-0.5 rounded">
                    {activity.category}
                  </span>
                </div>

                <h4 className="text-sm font-black text-black tracking-tight leading-snug line-clamp-2 mb-3 group-hover/card:text-zinc-700 transition-colors">
                  {activity.title}
                </h4>

                <div className="space-y-1.5 mb-4 text-[9px] font-bold text-zinc-400 uppercase tracking-wide">
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-zinc-300 flex-shrink-0" />
                    <span className="truncate">{activity.destination || activity.venue || activity.meetingPoint}</span>
                  </div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <Clock className="w-3.5 h-3.5 text-zinc-300 flex-shrink-0" />
                    <span>{new Date(activity.dateTime).toLocaleDateString([], { month: "short", day: "numeric" })} • {new Date(activity.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {/* Tags explaining why it matches */}
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-zinc-50">
                  {reasons.slice(0, 3).map((r, i) => (
                    <span 
                      key={i} 
                      className="inline-flex items-center gap-1 bg-zinc-50 border border-zinc-100 text-zinc-500 text-[8px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider"
                    >
                      {r.includes("Bhawan") ? (
                        <Home className="w-2.5 h-2.5 text-zinc-400" />
                      ) : r.includes("Branch") ? (
                        <BookOpen className="w-2.5 h-2.5 text-zinc-400" />
                      ) : (
                        <GraduationCap className="w-2.5 h-2.5 text-zinc-400" />
                      )}
                      {r}
                    </span>
                  ))}
                </div>

                {/* Hover overlay hint */}
                <div className="absolute right-4 bottom-4 w-6 h-6 rounded-full bg-zinc-100 text-black flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {viewMode === "map" ? (
        <MapView activities={filteredActivities} onActivityClick={onActivityClick} />
      ) : filteredActivities.length > 0 ? (
        <div className="flex flex-col">
          {filteredActivities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onClick={onActivityClick}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="bg-gray-100 p-6 rounded-full mb-4">
            <Filter className="w-8 h-8 text-gray-400" />
          </div>
          <h4 className="text-lg font-bold text-gray-900 mb-1">No activities found</h4>
          <p className="text-sm text-gray-500 max-w-xs">
            Try adjusting your filters or search query to find what you're looking for.
          </p>
        </div>
      )}
    </div>
  );
}
