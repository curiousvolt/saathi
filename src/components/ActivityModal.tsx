import React, { useState, useEffect } from "react";
import { Activity, UserProfile, JoinRequest, ChatMessage, ActivityCategory } from "../types";
import { X, MapPin, Clock, Users, User, Check, Shield, Send, MessageSquare, Trash2, Edit3, Save, Phone, Share2, Receipt, Archive, Star, CalendarPlus, RefreshCw } from "lucide-react";
import RatingModal from "./RatingModal";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { db } from "../lib/firebase";
import ExpenseTracker from "./ExpenseTracker";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  setDoc,
  getDoc,
  increment
} from "firebase/firestore";

interface ActivityModalProps {
  activityId: string;
  onClose: () => void;
  currentUser: UserProfile;
}

export default function ActivityModal({ activityId, onClose, currentUser }: ActivityModalProps) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [myRequest, setMyRequest] = useState<JoinRequest | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editData, setEditData] = useState<Partial<Activity>>({});
  const [isSending, setIsSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [hostPhone, setHostPhone] = useState<string>("");
  const [memberPhones, setMemberPhones] = useState<Record<string, string>>({});
  const [memberUpis, setMemberUpis] = useState<Record<string, string>>({});
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [activeSideTab, setActiveSideTab] = useState<"chat" | "expenses">("chat");
  const [showRatingModal, setShowRatingModal] = useState(false);

  const isHost = activity?.hostId === currentUser.uid;
  const isExpired = activity ? new Date(activity.dateTime) < new Date() : false;

  useEffect(() => {
    const unsubActivity = onSnapshot(doc(db, "activities", activityId), (doc) => {
      if (doc.exists()) {
        const data = { id: doc.id, ...doc.data() } as Activity;
        setActivity(data);
      } else {
        onClose();
      }
      setLoading(false);
    });

    if (isHost) {
      setIsApproved(true);
    }

    return () => {
      unsubActivity();
    };
  }, [activityId, isHost]);

  useEffect(() => {
    let unsubRequests: () => void;

    if (isHost || isApproved) {
      unsubRequests = onSnapshot(collection(db, "activities", activityId, "requests"), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JoinRequest));
        setRequests(data);
        const mine = data.find(r => r.userId === currentUser.uid);
        if (mine) {
          setMyRequest(mine);
        }
      }, (error) => {
        console.error("Requests listener failed:", error);
      });
    } else {
      unsubRequests = onSnapshot(doc(db, "activities", activityId, "requests", currentUser.uid), (snapshot) => {
        if (snapshot.exists()) {
          const r = { id: snapshot.id, ...snapshot.data() } as JoinRequest;
          setRequests([r]);
          setMyRequest(r);
          if (r.status === "approved") {
            setIsApproved(true);
          }
        } else {
          setRequests([]);
          setMyRequest(null);
          setIsApproved(false);
        }
      }, (error) => {
        console.error("Own request listener failed:", error);
      });
    }

    return () => {
      if (unsubRequests) unsubRequests();
    };
  }, [activityId, currentUser.uid, isHost, isApproved]);

  // Fetch host's profile phone and UPI
  useEffect(() => {
    if (activity?.hostId) {
      getDoc(doc(db, "users", activity.hostId)).then(snapshot => {
        if (snapshot.exists()) {
          const userData = snapshot.data() as UserProfile;
          setHostPhone(userData.phone || "");
          setMemberNames(prev => ({ ...prev, [activity.hostId]: userData.fullName }));
          if (userData.upiId) setMemberUpis(prev => ({ ...prev, [activity.hostId]: userData.upiId! }));
        }
      }).catch(err => console.error("Error fetching host user:", err));
    }
  }, [activity?.hostId]);

  // Fetch approved members' missing info
  useEffect(() => {
    if (!isApproved) return;
    const approvedRequests = requests.filter(r => r.status === "approved" && r.userId !== currentUser.uid);
    approvedRequests.forEach(req => {
      setMemberNames(prev => ({ ...prev, [req.userId]: req.requesterName }));
      // Always fetch to ensure we have upiId and phone
      getDoc(doc(db, "users", req.userId)).then(snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data() as UserProfile;
          if (data.phone) setMemberPhones(prev => ({ ...prev, [req.userId]: data.phone }));
          if (data.upiId) setMemberUpis(prev => ({ ...prev, [req.userId]: data.upiId! }));
        }
      }).catch(err => console.error("Error fetching approved member user:", err));
    });
    
    // add self to names/upi
    setMemberNames(prev => ({ ...prev, [currentUser.uid]: currentUser.fullName }));
    if (currentUser.upiId) setMemberUpis(prev => ({ ...prev, [currentUser.uid]: currentUser.upiId! }));
  }, [requests, isApproved, memberPhones, currentUser.uid, currentUser.fullName, currentUser.upiId]);

  useEffect(() => {
    if (isApproved) {
      const unsubMessages = onSnapshot(collection(db, "activities", activityId, "messages"), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
        setMessages(data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      });
      return () => unsubMessages();
    }
  }, [isApproved, activityId]);

  const handleJoinRequest = async () => {
    if (isSending || justSent || myRequest) return;
    setIsSending(true);
    
    const isFull = activity && activity.spotsOccupied >= activity.spotsTotal;
    const requestStatus = isFull ? "waitlisted" : "pending";
    
    try {
      await setDoc(doc(db, "activities", activityId, "requests", currentUser.uid), {
        activityId,
        userId: currentUser.uid,
        status: requestStatus,
        createdAt: new Date().toISOString(),
        requesterName: currentUser.fullName,
        requesterDept: currentUser.dept,
        requesterYear: currentUser.year,
        requesterCourse: currentUser.course,
        requesterGender: currentUser.gender,
        requesterPhoto: currentUser.photoUrl || "",
        requesterPhone: currentUser.phone || "",
      });
      
      if (activity?.hostId) {
        await addDoc(collection(db, "notifications"), {
          userId: activity.hostId,
          type: "join_request",
          activityId: activityId,
          message: `${currentUser.fullName} requested to join your activity: ${activity.title}`,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      }

      setJustSent(true);
      toast.success("Join request sent!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to send request.");
    } finally {
      setIsSending(false);
    }
  };

  const handleApprove = async (request: JoinRequest) => {
    if (activity && activity.spotsOccupied >= activity.spotsTotal) {
      toast.error("No more spots available.");
      return;
    }
    
    try {
      await updateDoc(doc(db, "activities", activityId, "requests", request.id), { status: "approved" });
      await updateDoc(doc(db, "activities", activityId), { 
        spotsOccupied: increment(1) 
      });
      toast.success("Member approved!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to approve member.");
    }
  };

  const handleShare = async () => {
    if (!activity) return;
    
    // Format the date nicely
    const dateObj = new Date(activity.dateTime);
    const dateStr = dateObj.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    
    // Construct a beautiful rich text message
    const location = activity.meetingPoint || activity.venue || activity.destination || "TBD";
    const textToShare = `*${activity.title}*\n📍 ${location}\n🕒 ${dateStr} at ${timeStr}\n\nJoin me on Saathi: ${window.location.origin}?activity=${activityId}`;

    try {
      // Only use native share on mobile devices where it works reliably
      if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
        await navigator.share({
          title: `Saathi: ${activity.title}`,
          text: textToShare,
          // Deliberately omitting 'url' as it causes some apps to drop the 'text'
        });
      } else {
        // On desktop, copy the rich text directly to clipboard
        await navigator.clipboard.writeText(textToShare);
        toast.success("Activity details copied to clipboard!");
      }
    } catch (e) {
      console.log("Error sharing:", e);
    }
  };

  const handleAddToCalendar = () => {
    if (!activity) return;
    const start = new Date(activity.dateTime);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2hrs assumed
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const location = activity.meetingPoint || activity.venue || activity.destination || "";
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${activity.title}`,
      `DESCRIPTION:${activity.description || "Saathi Activity"}`,
      `LOCATION:${location}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\n");
    const blob = new Blob([icsContent], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activity.title.replace(/\s+/g, "_")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Calendar event downloaded!");
  };

  const handleRepeatBooking = async () => {
    if (!activity || isSending) return;
    setIsSending(true);
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
      toast.success("Re-join request sent!");
      setJustSent(true);
    } catch (e) {
      toast.error("Failed to re-join.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      await addDoc(collection(db, "activities", activityId, "messages"), {
        senderId: currentUser.uid,
        senderName: currentUser.fullName,
        text: newMessage,
        createdAt: new Date().toISOString(),
      });
      setNewMessage("");
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return null;
  if (!activity) return null;

  return (
    <>
    <AnimatePresence>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 40 }}
          className="relative bg-white w-full max-w-5xl shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-[80vh] rounded-[2.5rem] overflow-hidden border border-zinc-100"
        >
          {/* Main Content Info */}
          <div className="flex-[1.5] flex flex-col p-8 md:p-14 overflow-y-auto border-r border-zinc-100 bg-white">
            <div className="flex justify-between items-start mb-8">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-300">
                  ACTIVITY DOSSIER
                </span>
                {activity.isRecurring && (
                   <span className="text-[9px] font-black text-black bg-zinc-100 px-2 py-0.5 rounded tracking-widest uppercase">
                    Recurring: {activity.recurrenceFrequency}
                   </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleAddToCalendar}
                  className="p-2 hover:bg-zinc-100 text-zinc-400 hover:text-black rounded-full transition-colors"
                  title="Add to Calendar"
                >
                  <CalendarPlus className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleShare}
                  className="p-2 hover:bg-zinc-100 text-zinc-400 hover:text-black rounded-full transition-colors"
                  title="Share this activity"
                >
                  <Share2 className="w-5 h-5" />
                </button>
                {isHost && (
                  <>
                    <button 
                      onClick={() => {
                        if (!isEditing && activity) setEditData({ ...activity });
                        setIsEditing(!isEditing);
                        setShowDeleteConfirm(false);
                      }} 
                      className={`p-2 rounded-full transition-colors ${isEditing ? 'bg-black text-white' : 'hover:bg-zinc-100 text-zinc-400'}`}
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, "activities", activityId), { isArchived: !activity?.isArchived });
                          toast.success(activity?.isArchived ? "Activity unarchived!" : "Activity archived!");
                        } catch (e: any) {
                          toast.error("Failed to archive.");
                        }
                      }}
                      className={`p-2 rounded-full transition-colors ${activity?.isArchived ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'hover:bg-zinc-100 text-zinc-400 hover:text-black'}`}
                      title={activity?.isArchived ? "Unarchive" : "Archive"}
                    >
                      <Archive className="w-5 h-5" />
                    </button>
                    <div className="relative">
                      <button 
                        onClick={() => setShowDeleteConfirm(true)} 
                        className="p-2 hover:bg-red-50 text-zinc-400 hover:text-red-600 rounded-full transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <AnimatePresence>
                        {showDeleteConfirm && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="absolute right-0 top-full mt-2 w-48 bg-white border border-red-100 shadow-2xl rounded-2xl p-4 z-[80]"
                          >
                            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-3">Confirm Delete?</p>
                            <div className="flex gap-2">
                              <button 
                                onClick={async () => {
                                  try {
                                    console.log("Attempting to delete activity:", activityId);
                                    await deleteDoc(doc(db, "activities", activityId));
                                    console.log("Delete successful");
                                    toast.success("Activity deleted!");
                                    onClose();
                                  } catch (e: any) {
                                    console.error("Delete failed:", e);
                                    toast.error(`Delete failed: ${e.message || "Unknown error"}.`);
                                  }
                                }}
                                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-red-700"
                              >
                                Delete
                              </button>
                              <button 
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 bg-zinc-100 text-zinc-600 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider"
                              >
                                No
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )}
                <button 
                  onClick={onClose} 
                  className="hover:bg-zinc-100 p-2 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-zinc-400" />
                </button>
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-6 mb-10 overflow-y-auto pr-4 scrollbar-thin">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest px-1">TITLE</label>
                  <input
                    type="text"
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    className="text-2xl font-black text-black tracking-tight w-full bg-zinc-50 p-4 rounded-xl focus:outline-none border border-transparent focus:border-zinc-200"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest px-1">
                      {activity.category === ActivityCategory.TRAVEL ? "DESTINATION" : "VENUE"}
                    </label>
                    <input
                      type="text"
                      value={activity.category === ActivityCategory.TRAVEL ? editData.destination : editData.venue}
                      onChange={(e) => setEditData({ 
                        ...editData, 
                        [activity.category === ActivityCategory.TRAVEL ? "destination" : "venue"]: e.target.value 
                      })}
                      className="w-full bg-zinc-50 p-4 rounded-xl text-sm font-bold focus:outline-none border border-transparent focus:border-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest px-1">MEETING POINT</label>
                    <input
                      type="text"
                      value={editData.meetingPoint}
                      onChange={(e) => setEditData({ ...editData, meetingPoint: e.target.value })}
                      className="w-full bg-zinc-50 p-4 rounded-xl text-sm font-bold focus:outline-none border border-transparent focus:border-zinc-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest px-1">SCHEDULE</label>
                    <input
                      type="datetime-local"
                      value={editData.dateTime}
                      onChange={(e) => setEditData({ ...editData, dateTime: e.target.value })}
                      className="w-full bg-zinc-50 p-4 rounded-xl text-sm font-bold focus:outline-none border border-transparent focus:border-zinc-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest px-1">TOTAL SPOTS</label>
                    <input
                      type="number"
                      value={editData.spotsTotal}
                      onChange={(e) => setEditData({ ...editData, spotsTotal: parseInt(e.target.value) })}
                      className="w-full bg-zinc-50 p-4 rounded-xl text-sm font-bold focus:outline-none border border-transparent focus:border-zinc-200"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest px-1">RECURRENCE</label>
                  <select
                    value={editData.recurrenceFrequency || "None"}
                    onChange={(e) => setEditData({ 
                      ...editData, 
                      isRecurring: e.target.value !== "None",
                      recurrenceFrequency: e.target.value !== "None" ? e.target.value as any : undefined
                    })}
                    className="w-full bg-zinc-50 p-4 rounded-xl text-sm font-bold focus:outline-none border border-transparent focus:border-zinc-200"
                  >
                    <option value="None">No Recurrence</option>
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-300 uppercase tracking-widest px-1">VIBE CHECK</label>
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    className="w-full bg-zinc-50 p-4 rounded-xl text-lg font-medium focus:outline-none h-32 resize-none border border-transparent focus:border-zinc-200"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-4 text-xs font-black text-zinc-400 uppercase tracking-widest hover:text-black transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        // Only send fields that Firestore rules allow the host to update
                        const updatePayload: Record<string, any> = {};
                        if (editData.title !== undefined) updatePayload.title = editData.title;
                        if (editData.description !== undefined) updatePayload.description = editData.description;
                        if (editData.destination !== undefined) updatePayload.destination = editData.destination;
                        if (editData.venue !== undefined) updatePayload.venue = editData.venue;
                        if (editData.dateTime !== undefined) updatePayload.dateTime = editData.dateTime;
                        if (editData.meetingPoint !== undefined) updatePayload.meetingPoint = editData.meetingPoint;
                        if (editData.spotsTotal !== undefined) updatePayload.spotsTotal = editData.spotsTotal;
                        if (editData.isRecurring !== undefined) updatePayload.isRecurring = editData.isRecurring;
                        if (editData.recurrenceFrequency !== undefined) updatePayload.recurrenceFrequency = editData.recurrenceFrequency;

                        await updateDoc(doc(db, "activities", activityId), updatePayload);
                        toast.success("Activity updated!");
                        setIsEditing(false);
                      } catch (e: any) {
                        console.error("Update failed:", e);
                        toast.error(`Update failed: ${e.message || "Unknown error"}.`);
                      }
                    }}
                    className="flex-[2] uber-button flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" /> SAVE CHANGES
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-4xl font-black text-black tracking-tight mb-10 leading-none font-display">
                  {activity.title}
                </h2>
              </>
            )}

            <div className="flex items-center gap-6 mb-12 border-b border-zinc-50 pb-12">
              <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                {activity.hostPhoto ? (
                  <img src={activity.hostPhoto} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-zinc-400 font-bold text-2xl">{activity.hostName[0]}</span>
                )}
              </div>
              <div className="space-y-1">
                <span className="block text-[10px] font-black text-zinc-300 uppercase tracking-widest">HOSTED BY</span>
                <span className="block text-xl font-bold tracking-tight">{activity.hostName}</span>
                <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{activity.hostDept} • YEAR {activity.hostYear}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-12">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                    {activity.category === "Travel" ? "DESTINATION" : "VENUE"}
                  </span>
                </div>
                <p className="text-lg font-bold text-black border-l-2 border-zinc-100 pl-4 py-1">
                  {activity.category === "Travel" ? activity.destination || "TBD" : activity.venue || "TBD"}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">MEETING POINT</span>
                </div>
                <p className="text-lg font-bold text-black border-l-2 border-zinc-100 pl-4 py-1">{activity.meetingPoint}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">SCHEDULE</span>
                </div>
                <p className="text-lg font-bold text-black border-l-2 border-zinc-100 pl-4 py-1">
                  {new Date(activity.dateTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>

            {activity.description && (
              <div className="mb-12">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-4 block">VIBE CHECK</span>
                <p className="text-lg font-medium text-zinc-650 leading-relaxed italic">
                  "{activity.description}"
                </p>
              </div>
            )}

            {isApproved && (
              <div className="mb-12 border-t border-zinc-100 pt-8">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-6 block">
                  CIRCLE MEMBERS ({requests.filter(r => r.status === "approved").length + 1})
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Host Miniature Profile */}
                  <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-3xl flex items-center gap-3 shadow-xs hover:border-zinc-200 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-black text-white flex-shrink-0 flex items-center justify-center font-bold text-sm overflow-hidden">
                      {activity.hostPhoto ? (
                        <img src={activity.hostPhoto} alt="" className="w-full h-full object-cover" />
                      ) : (
                        activity.hostName ? activity.hostName[0] : "?"
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-black text-black leading-none truncate">{activity.hostName}</span>
                        <span className="bg-black text-[7px] text-white font-extrabold tracking-widest px-1 py-0.5 rounded uppercase scale-90">Host</span>
                      </div>
                      <span className="text-[9px] text-zinc-400 font-bold block mt-1 uppercase tracking-wider truncate">
                        {activity.hostDept} • YR {activity.hostYear || "N/A"}
                      </span>
                      {hostPhone && (
                        <a 
                          href={`https://wa.me/${hostPhone.replace(/[^0-9]/g, "")}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 font-extrabold mt-1.5 transition-colors"
                        >
                          <Phone className="w-3 h-3 text-emerald-500 fill-emerald-500" /> {hostPhone}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Approved Requesters Miniature Profiles */}
                  {requests.filter(r => r.status === "approved").map(req => {
                    const phone = req.requesterPhone || memberPhones[req.userId];
                    return (
                      <div key={req.id} className="bg-zinc-50 border border-zinc-100 p-4 rounded-3xl flex items-center gap-3 shadow-xs hover:border-zinc-200 transition-all">
                        <div className="w-10 h-10 rounded-xl bg-zinc-250 text-zinc-650 flex-shrink-0 flex items-center justify-center font-bold text-sm overflow-hidden border border-zinc-100">
                          {req.requesterPhoto ? (
                            <img src={req.requesterPhoto} alt="" className="w-full h-full object-cover" />
                          ) : (
                            req.requesterName[0]
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-black text-black leading-none truncate">{req.requesterName}</span>
                          </div>
                          <span className="text-[9px] text-zinc-400 font-bold block mt-1 uppercase tracking-wider truncate">
                            {req.requesterDept} (Yr {req.requesterYear})
                          </span>
                          {phone && (
                            <a 
                              href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 font-extrabold mt-1.5 transition-colors"
                            >
                              <Phone className="w-3 h-3 text-emerald-500 fill-emerald-500" /> {phone}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-auto pt-10 flex flex-col gap-4">
              <div className="flex items-end justify-between border-b border-zinc-100 pb-4">
                <div className="space-y-1">
                   <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest">AVAILABILITY</span>
                   <div className="flex items-center gap-2">
                      <span className="text-3xl font-black">{activity.spotsOccupied}</span>
                      <span className="text-zinc-200 text-2xl font-light">/</span>
                      <span className="text-xl font-bold text-zinc-400">{activity.spotsTotal}</span>
                   </div>
                </div>
                <Users className="w-10 h-10 text-zinc-100" strokeWidth={1.5} />
              </div>

              {!isHost && !myRequest && !justSent && (
                <button
                  onClick={handleJoinRequest}
                  disabled={isSending}
                  className="uber-button disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSending ? "SENDING REQUEST..." : activity.spotsOccupied >= activity.spotsTotal ? "JOIN WAITLIST" : "REQUEST TO JOIN"}
                </button>
              )}
              {(justSent || myRequest) && (
                <div className="bg-emerald-50 rounded-2xl py-5 text-center font-bold uppercase text-[10px] tracking-[0.2em] text-emerald-600 border border-emerald-100 flex items-center justify-center gap-2">
                  <Check className="w-4 h-4 text-emerald-555" />
                  {myRequest?.status === 'waitlisted' || (justSent && activity.spotsOccupied >= activity.spotsTotal) ? "WAITLISTED" : "REQUEST SENT SUCCESSFULLY"}
                </div>
              )}

              {/* Rate Activity Button - shown to approved non-host members after event ends */}
              {!isHost && isApproved && isExpired && (
                <button
                  onClick={() => setShowRatingModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-amber-200 bg-amber-50 text-amber-700 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-100 transition-colors"
                >
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  Rate This Activity
                </button>
              )}

              {/* Repeat Booking - for recurring activities after the event, if member was approved and now spot is gone */}
              {!isHost && isApproved && isExpired && activity?.isRecurring && (
                <button
                  onClick={handleRepeatBooking}
                  disabled={isSending}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-100 text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Re-Join Next Session
                </button>
              )}
            </div>
          </div>

          {/* Sidepanel */}
          <div className="w-full md:w-[400px] bg-zinc-50 flex flex-col border-l border-zinc-100">
            {!isApproved ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="p-5 bg-white rounded-3xl shadow-sm mb-6">
                  <Shield className="w-8 h-8 text-zinc-300" />
                </div>
                <h5 className="text-sm font-black text-black uppercase tracking-tight mb-2">Private Group Access</h5>
                <p className="text-[11px] text-zinc-400 font-bold leading-relaxed max-w-[240px]">
                  Verified attendees get access to real-time chat, expenses, and host coordinates.
                </p>
              </div>
            ) : (
              <>
                <div className="flex border-b border-zinc-200 bg-white">
                  <button
                    onClick={() => setActiveSideTab("chat")}
                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${
                      activeSideTab === "chat" ? "text-black border-b-2 border-black" : "text-zinc-400 hover:text-black"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Chat
                  </button>
                  <button
                    onClick={() => setActiveSideTab("expenses")}
                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${
                      activeSideTab === "expenses" ? "text-black border-b-2 border-black" : "text-zinc-400 hover:text-black"
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" /> Expenses
                  </button>
                </div>

                {activeSideTab === "chat" ? (
                  <>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin bg-zinc-50">
                      {messages.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.senderId === currentUser.uid ? 'items-end' : 'items-start'}`}>
                          <span className="text-[8px] font-black text-zinc-400 uppercase mb-2 px-1">{msg.senderName}</span>
                          <div className={`max-w-[90%] px-5 py-3 rounded-2xl text-xs font-bold leading-relaxed ${
                            msg.senderId === currentUser.uid 
                              ? 'bg-black text-white rounded-tr-none' 
                              : 'bg-white border border-zinc-100 text-zinc-600 rounded-tl-none'
                          }`}>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleSendMessage} className="p-6 bg-white border-t border-zinc-100 flex gap-3">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="SAY SOMETHING..."
                        className="flex-1 bg-zinc-100 rounded-xl py-3 px-5 text-[10px] font-bold focus:outline-none focus:bg-white focus:ring-1 focus:ring-black transition-all"
                      />
                      <button type="submit" className="p-3 bg-black text-white rounded-xl hover:bg-zinc-800 transition-colors">
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </>
                ) : (
                  <ExpenseTracker 
                    activityId={activityId} 
                    currentUser={currentUser}
                    approvedMembers={Object.keys(memberNames)}
                    memberNames={memberNames}
                    memberUpis={memberUpis}
                  />
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
    {showRatingModal && activity && (
      <RatingModal
        activity={activity}
        currentUser={currentUser}
        onClose={() => setShowRatingModal(false)}
      />
    )}
    </>
  );
}
