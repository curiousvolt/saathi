import React, { useState } from "react";
import { ActivityCategory, ActivityFilters, UserProfile } from "../types";
import { X, Calendar, MapPin, Users, Info, Sparkles, Check, Loader2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db } from "../lib/firebase";
import { toast } from "sonner";
import { setDoc, doc, collection, query, where, getDocs } from "firebase/firestore";

interface CreateActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (activity: any) => void;
  currentUser: UserProfile;
}

export default function CreateActivityModal({ isOpen, onClose, onSubmit, currentUser }: CreateActivityModalProps) {
  const [formData, setFormData] = useState({
    category: ActivityCategory.TRAVEL,
    title: "",
    description: "",
    destination: "",
    venue: "",
    dateTime: "",
    meetingPoint: "",
    spotsTotal: 1,
    costSplit: "",
    filters: {
      gender: "any",
      sameYear: false,
      sameCourse: false,
      sameDept: false,
    } as ActivityFilters,
  });

  const [isChecking, setIsChecking] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);

  const handleClose = () => {
    // Reset internal state elements before closing
    setSuggestions([]);
    setShowSuggestions(false);
    setJoiningId(null);
    setJoinedIds([]);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setIsChecking(true);

    let locationCoords: { lat: number; lng: number } | undefined = undefined;
    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        locationCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
      } catch (err) {
        console.log("Geolocation error or denied:", err);
      }
    }

    const finalFormData = { ...formData, locationCoords };

    try {
      const activityDateTime = new Date(finalFormData.dateTime);
      const startTime = new Date(activityDateTime.getTime() - 4 * 60 * 60 * 1000);
      const endTime = new Date(activityDateTime.getTime() + 4 * 60 * 60 * 1000);

      const q = query(
        collection(db, "activities"),
        where("category", "==", formData.category),
        where("status", "==", "active"),
        where("dateTime", ">=", startTime.toISOString()),
        where("dateTime", "<=", endTime.toISOString())
      );

      const snapshot = await getDocs(q);
      const duplicates: any[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.hostId === currentUser.uid) return;
        
        if (formData.category === ActivityCategory.TRAVEL) {
          if (data.destination?.toLowerCase() === formData.destination?.toLowerCase()) {
            duplicates.push({ id: doc.id, ...data });
          }
        } else {
          if (data.venue?.toLowerCase() === formData.venue?.toLowerCase() ||
              data.title.toLowerCase().includes(formData.title.toLowerCase())) {
            duplicates.push({ id: doc.id, ...data });
          }
        }
      });

      if (duplicates.length > 0) {
        setSuggestions(duplicates);
        setShowSuggestions(true);
      } else {
        onSubmit(finalFormData);
        handleClose();
      }
    } catch (err) {
      console.error("Duplicate check failed:", err);
      // Fallback: submit and create anyway
      onSubmit(finalFormData);
      handleClose();
    } finally {
      setIsChecking(false);
    }
  };

  const handleJoinRequest = async (activityId: string) => {
    if (joiningId || joinedIds.includes(activityId) || !currentUser) return;
    setJoiningId(activityId);
    try {
      await setDoc(doc(db, "activities", activityId, "requests", currentUser.uid), {
        activityId,
        userId: currentUser.uid,
        status: "pending",
        createdAt: new Date().toISOString(),
        requesterName: currentUser.fullName,
        requesterDept: currentUser.dept,
        requesterYear: currentUser.year,
        requesterCourse: currentUser.course,
        requesterGender: currentUser.gender,
        requesterPhoto: currentUser.photoUrl || "",
        requesterPhone: currentUser.phone || "",
      });
      setJoinedIds((prev) => [...prev, activityId]);
      toast.success("Join request sent!");
      // Delay for success check animation and then close
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (e) {
      console.error(e);
      toast.error("Failed to send request. Please try again.");
    } finally {
      setJoiningId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-white">
            <div>
              <h2 className="text-2xl font-black text-black tracking-tighter leading-tight">
                {showSuggestions ? "SIMILAR PATHS FOUND" : "POST ACTIVITY"}
              </h2>
              <p className="text-[10px] text-zinc-400 font-bold tracking-widest uppercase">
                {showSuggestions ? "Coordinate first. Pool together!" : "Find your saathi for the next adventure"}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-3 hover:bg-zinc-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          {showSuggestions ? (
            <div className="p-8 overflow-y-auto space-y-6 scrollbar-thin">
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex gap-4">
                <AlertTriangle className="w-8 h-8 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-[10px] font-black text-amber-900 uppercase tracking-wider mb-1">BUNDLING HIGHLY ADVISED</h3>
                  <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                    We found active circles heading to the same spot or within the same category around the same time. Consider joining them instead of starting a new redundant one!
                  </p>
                </div>
              </div>

              <div className="space-y-4 max-h-[35vh] overflow-y-auto pr-2 scrollbar-thin">
                {suggestions.map((act) => {
                  const isJoined = joinedIds.includes(act.id);
                  const isProcessing = joiningId === act.id;
                  
                  return (
                    <div 
                      key={act.id} 
                      className="border border-zinc-100 bg-zinc-50 p-4 rounded-3xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:border-zinc-200 transition-all shadow-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="bg-black text-[7px] text-white font-extrabold tracking-widest px-1.5 py-0.5 rounded uppercase leading-none">
                            {act.category}
                          </span>
                          <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider leading-none">
                            Hosted by {act.hostName}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-black tracking-tight leading-tight mb-2 truncate">
                          {act.title}
                        </h4>
                        
                        <div className="flex flex-col gap-1 text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                            <span className="truncate">{act.destination || act.venue || act.meetingPoint}</span>
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                            <span>{new Date(act.dateTime).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex-shrink-0 w-full sm:w-auto">
                        {isJoined ? (
                          <div className="bg-emerald-50 text-emerald-600 rounded-xl px-4 py-2 text-center text-[9px] font-extrabold tracking-widest uppercase border border-emerald-100 flex items-center justify-center gap-1.5">
                            <Check className="w-3.5 h-3.5" />
                            SENT ✓
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleJoinRequest(act.id)}
                            disabled={!!joiningId}
                            className="bg-black hover:bg-zinc-800 disabled:opacity-50 text-white rounded-xl px-4 py-2 text-center text-[9px] font-black tracking-widest uppercase w-full sm:w-auto flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                SENDING...
                              </>
                            ) : (
                              "JOIN THIS"
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-zinc-100 pt-6 flex flex-col gap-3">
                <p className="text-[10px] text-zinc-400 font-bold uppercase text-center tracking-widest">
                  Not interested? Create yours anyway
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onSubmit(formData);
                      handleClose();
                    }}
                    className="flex-1 bg-white hover:bg-zinc-50 border border-zinc-200 text-black rounded-2xl py-3.5 text-center text-[10px] font-black tracking-widest uppercase transition-colors cursor-pointer"
                  >
                    CREATE ANYWAY
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-650 rounded-2xl py-3.5 text-center text-[10px] font-black tracking-widest uppercase transition-colors cursor-pointer"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-8 scrollbar-thin">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-3 block">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(ActivityCategory).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: cat })}
                        className={`py-2.5 px-5 rounded-full text-[10px] font-black tracking-widest border transition-all ${
                          formData.category === cat
                            ? "bg-black border-black text-white"
                            : "bg-white border-zinc-100 text-zinc-400 hover:border-zinc-300"
                        }`}
                      >
                        {cat.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="relative group">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-black rounded-full transition-all group-focus-within:h-6" />
                    <input
                      required
                      type="text"
                      placeholder="ACTIVITY TITLE"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full bg-white border-b border-zinc-100 py-4 pl-6 text-xl font-bold focus:outline-none focus:border-black transition-all placeholder:text-zinc-200"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="relative group">
                      <MapPin className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300 group-focus-within:text-black" />
                      <input
                        required
                        type="text"
                        placeholder={formData.category === ActivityCategory.TRAVEL ? "DESTINATION" : "VENUE"}
                        value={formData.category === ActivityCategory.TRAVEL ? formData.destination : formData.venue}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          [formData.category === ActivityCategory.TRAVEL ? 'destination' : 'venue']: e.target.value 
                        })}
                        className="w-full bg-white border-b border-zinc-100 py-4 pl-8 text-sm font-bold focus:outline-none focus:border-black transition-all placeholder:text-zinc-200"
                      />
                    </div>
                    <div className="relative group">
                      <Calendar className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300 group-focus-within:text-black" />
                      <input
                        required
                        type="datetime-local"
                        value={formData.dateTime}
                        onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
                        className="w-full bg-white border-b border-zinc-100 py-4 pl-8 text-sm font-bold focus:outline-none focus:border-black transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <input
                      required
                      type="text"
                      placeholder="MEETING POINT"
                      value={formData.meetingPoint}
                      onChange={(e) => setFormData({ ...formData, meetingPoint: e.target.value })}
                      className="w-full bg-white border-b border-zinc-100 py-4 text-sm font-bold focus:outline-none focus:border-black transition-all placeholder:text-zinc-200"
                    />
                    <div className="relative group flex items-center">
                      <Users className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                      <input
                        required
                        type="number"
                        min="1"
                        placeholder="TOTAL SPOTS"
                        value={formData.spotsTotal}
                        onChange={(e) => setFormData({ ...formData, spotsTotal: parseInt(e.target.value) })}
                        className="w-full bg-white border-b border-zinc-100 py-4 pl-8 text-sm font-bold focus:outline-none focus:border-black transition-all placeholder:text-zinc-200"
                      />
                    </div>
                  </div>

                  <textarea
                    placeholder="DESCRIPTION (ADD THE VIBE...)"
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-white border-b border-zinc-100 py-4 text-sm font-bold focus:outline-none focus:border-black transition-all placeholder:text-zinc-200 resize-none md:col-span-2"
                  />
                </div>

                {(formData.category === ActivityCategory.STUDY || formData.category === ActivityCategory.SPORTS) && (
                  <div className="flex items-center justify-between p-6 bg-zinc-50 rounded-[1.5rem] border border-zinc-100">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black text-black uppercase tracking-widest">Recurring Session</span>
                      <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Find buddies for regular practice / sessions</span>
                    </div>
                    <div className="flex gap-2">
                      {["None", "Daily", "Weekly"].map((freq) => (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => setFormData({ 
                            ...formData, 
                            isRecurring: freq !== "None", 
                            recurrenceFrequency: freq !== "None" ? freq as any : undefined 
                          })}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                            (freq === "None" && !formData.isRecurring) || (formData.recurrenceFrequency === freq)
                              ? "bg-black border-black text-white" 
                              : "bg-white border-zinc-200 text-zinc-400 hover:border-zinc-300"
                          }`}
                        >
                          {freq}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-6 bg-zinc-50 rounded-[1.5rem] space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3 h-3 text-black" />
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">Safety Filters</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-3">
                    <select
                      value={formData.filters.gender}
                      onChange={(e) => setFormData({ ...formData, filters: { ...formData.filters, gender: e.target.value as any } })}
                      className="bg-white border border-zinc-200 rounded-xl py-2 px-4 text-[10px] font-bold text-zinc-650 focus:outline-none focus:border-black transition-all"
                    >
                      <option value="any">Any Gender</option>
                      <option value="male">Male Only</option>
                      <option value="female">Female Only</option>
                    </select>
                    
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, filters: { ...formData.filters, sameYear: !formData.filters.sameYear } })}
                      className={`py-2 px-4 rounded-xl text-[10px] font-bold border transition-all ${
                        formData.filters.sameYear 
                          ? "bg-black border-black text-white" 
                          : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300"
                      }`}
                    >
                      Same Year Only
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, filters: { ...formData.filters, sameDept: !formData.filters.sameDept } })}
                      className={`py-2 px-4 rounded-xl text-[10px] font-bold border transition-all ${
                        formData.filters.sameDept 
                          ? "bg-black border-black text-white" 
                          : "bg-white border-zinc-250 text-zinc-500 hover:border-zinc-300"
                      }`}
                    >
                      Same Dept Only
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isChecking}
                  className="uber-button w-full flex items-center justify-center gap-3 disabled:opacity-60"
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      CHECKING ACTIVE PATHS...
                    </>
                  ) : (
                    "PUBLISH ACTIVITY"
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
