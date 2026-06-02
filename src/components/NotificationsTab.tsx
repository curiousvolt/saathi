import React, { useEffect, useState } from "react";
import { Activity, JoinRequest, UserProfile, AppNotification } from "../types";
import { motion } from "motion/react";
import { Bell, Check, ShieldAlert, ShieldCheck, Calendar, MessageSquare } from "lucide-react";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, orderBy } from "firebase/firestore";

interface NotificationsTabProps {
  user: UserProfile;
  activities: Activity[];
  allRequests: JoinRequest[];
  onApproveRequest: (activityId: string, req: JoinRequest) => void;
  onDeclineRequest: (activityId: string, req: JoinRequest) => void;
  onOpenChat: (activityId: string) => void;
}

interface HostRequestAlert {
  id: string;
  type: "host_request";
  activityId: string;
  activityTitle: string;
  status: string;
  requesterName: string;
  requesterPhoto?: string;
  requesterDept: string;
  requesterYear: number;
  requesterGender: string;
  createdAt: string;
  rawRequest: JoinRequest;
}

interface ParticipantStatusAlert {
  id: string;
  type: "participant_status";
  activityId: string;
  activityTitle: string;
  hostName: string;
  status: string;
  createdAt: string;
  rawRequest: JoinRequest;
}

type AlertItem = HostRequestAlert | ParticipantStatusAlert;

export default function NotificationsTab({
  user,
  activities,
  allRequests,
  onApproveRequest,
  onDeclineRequest,
  onOpenChat
}: NotificationsTabProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    // Listen for new notifications
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
      // Sort in memory since we might not have a composite index for userId + createdAt
      docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(docs);

      // Mark all as read when tab is opened
      docs.filter(n => !n.isRead).forEach(async (n) => {
        try {
          await updateDoc(doc(db, "notifications", n.id), { isRead: true });
        } catch (e) {
          console.error("Failed to mark as read", e);
        }
      });
    });

    return () => unsubscribe();
  }, [user.uid]);

  // Generate alerts chronologically
  const hostAlerts: HostRequestAlert[] = allRequests
    .filter(req => {
      const act = activities.find(a => a.id === req.activityId);
      return act && act.hostId === user.uid;
    })
    .map(req => {
      const act = activities.find(a => a.id === req.activityId);
      return {
        id: `host-${req.id}-${req.activityId}`,
        type: "host_request" as const,
        activityId: req.activityId,
        activityTitle: act?.title || "Activity",
        status: req.status,
        requesterName: req.requesterName,
        requesterPhoto: req.requesterPhoto,
        requesterDept: req.requesterDept,
        requesterYear: req.requesterYear,
        requesterGender: req.requesterGender,
        createdAt: req.createdAt,
        rawRequest: req,
      };
    });

  const participantAlerts: ParticipantStatusAlert[] = allRequests
    .filter(req => req.userId === user.uid)
    .map(req => {
      const act = activities.find(a => a.id === req.activityId);
      return {
        id: `participant-${req.activityId}`,
        type: "participant_status" as const,
        activityId: req.activityId,
        activityTitle: act?.title || "Activity",
        hostName: act?.hostName || "Host",
        status: req.status,
        createdAt: req.createdAt,
        rawRequest: req,
      };
    });

  const mrgAlerts: AlertItem[] = [...hostAlerts, ...participantAlerts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-6 pt-4 md:pt-6">
      <div className="mb-10 text-left border-b border-zinc-100 pb-6">
        <h2 className="text-4xl font-black text-black tracking-tight font-display">ALERTS & JOINS</h2>
        <p className="text-zinc-400 font-bold uppercase tracking-widest text-[10px] mt-1">Real-time requests and circle coordinates</p>
      </div>

      {/* System Notifications List */}
      {notifications.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-black text-black tracking-widest uppercase mb-4">Recent Notifications</h3>
          <div className="space-y-2">
            {notifications.slice(0, 5).map(notif => (
              <div key={notif.id} className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 flex items-center gap-3 shadow-xs">
                <Bell className="w-4 h-4 text-zinc-400 shrink-0" />
                <p className="text-xs font-bold text-zinc-700">{notif.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {mrgAlerts.length > 0 ? (
        <div className="space-y-4">
          {mrgAlerts.map((alertItem) => {
            if (alertItem.type === "host_request") {
              return (
                <div 
                  key={alertItem.id} 
                  className="bg-white p-6 border border-zinc-100 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-zinc-100 text-black flex items-center justify-center font-bold flex-shrink-0 text-lg overflow-hidden">
                      {alertItem.requesterPhoto ? (
                        <img src={alertItem.requesterPhoto} alt="" className="w-full h-full object-cover" />
                      ) : (
                        alertItem.requesterName[0]
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded font-black tracking-wider uppercase">
                        JOIN REQUEST
                      </span>
                      <p className="text-sm font-bold text-zinc-900 leading-tight">
                        <span className="font-extrabold text-black">{alertItem.requesterName}</span> ({alertItem.requesterGender}, Year {alertItem.requesterYear}) requested to join <span className="underline">{alertItem.activityTitle}</span>
                      </p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                        {alertItem.requesterDept}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center">
                    {alertItem.status === "pending" ? (
                      <>
                        <button
                          onClick={() => onDeclineRequest(alertItem.activityId, alertItem.rawRequest)}
                          className="px-4 py-2 text-zinc-400 hover:text-red-500 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => onApproveRequest(alertItem.activityId, alertItem.rawRequest)}
                          className="bg-black hover:bg-zinc-800 text-white px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm hover:shadow-md"
                        >
                          Approve
                        </button>
                      </>
                    ) : (
                      <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        alertItem.status === "approved"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                          : "bg-zinc-50 border-zinc-100 text-zinc-400"
                      }`}>
                        {alertItem.status}
                      </span>
                    )}
                  </div>
                </div>
              );
            } else {
              // participant status update
              const isApproved = alertItem.status === "approved";
              const isDeclined = alertItem.status === "declined";
              const isPending = alertItem.status === "pending";

              return (
                <div 
                  key={alertItem.id} 
                  className="bg-white p-6 border border-zinc-100 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-zinc-50 text-zinc-600 flex items-center justify-center flex-shrink-0">
                      {isApproved ? (
                        <ShieldCheck className="w-6 h-6 text-emerald-500" />
                      ) : isDeclined ? (
                        <ShieldAlert className="w-6 h-6 text-red-500" />
                      ) : (
                        <Calendar className="w-6 h-6 text-zinc-400 animate-pulse" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className={`text-[9px] px-2 py-0.5 rounded font-black tracking-wider uppercase border ${
                        isApproved 
                          ? "bg-emerald-50 border-emerald-150 text-emerald-600" 
                          : isDeclined 
                            ? "bg-red-50 border-red-150 text-red-600" 
                            : "bg-zinc-50 border-zinc-150 text-zinc-500"
                      }`}>
                        MY SENT REQUEST: {alertItem.status.toUpperCase()}
                      </span>
                      <p className="text-sm font-bold text-zinc-900 leading-snug">
                        {isApproved && (
                          <span>Your request to join <span className="font-extrabold text-black">‘{alertItem.activityTitle}’</span> was approved by {alertItem.hostName}! 🎉</span>
                        )}
                        {isDeclined && (
                          <span>Your request to join <span className="font-extrabold text-black">‘{alertItem.activityTitle}’</span> was declined.</span>
                        )}
                        {isPending && (
                          <span>Your request for <span className="font-extrabold text-black">‘{alertItem.activityTitle}’</span> is pending host approval.</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center self-end md:self-center">
                    {isApproved && (
                      <button
                        onClick={() => onOpenChat(alertItem.activityId)}
                        className="flex items-center gap-2 bg-zinc-900 hover:bg-black text-white px-4 py-2.5 rounded-full font-black text-[10px] tracking-wider uppercase transition-all shadow-sm"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> OPEN CHAT
                      </button>
                    )}
                  </div>
                </div>
              );
            }
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-zinc-50 rounded-3xl border border-zinc-100">
          <Bell className="w-12 h-12 text-zinc-200 mb-4 animate-bounce" />
          <h4 className="font-bold text-zinc-800 text-lg">Your feed is clean</h4>
          <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider mt-1">Pending inquiries and coordinates will show up here</p>
        </div>
      )}
    </div>
  );
}
