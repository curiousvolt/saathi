import React from "react";
import { MapPin, Clock, Users, ChevronRight, Share2 } from "lucide-react";
import { Activity, ActivityCategory } from "../types";
import { motion } from "motion/react";

interface ActivityCardProps {
  activity: Activity;
  onClick: (id: string) => void;
}

const categoryColors: Record<ActivityCategory, string> = {
  [ActivityCategory.TRAVEL]: "bg-blue-50 text-blue-600 border-blue-100",
  [ActivityCategory.SOCIAL]: "bg-orange-50 text-orange-600 border-orange-100",
  [ActivityCategory.SPORTS]: "bg-emerald-50 text-emerald-600 border-emerald-100",
  [ActivityCategory.STUDY]: "bg-indigo-50 text-indigo-600 border-indigo-100",
  [ActivityCategory.OTHER]: "bg-zinc-50 text-zinc-600 border-zinc-100",
};

const ActivityCard: React.FC<ActivityCardProps> = ({ activity, onClick }) => {
  const spotsLeft = activity.spotsTotal - activity.spotsOccupied;
  const isFull = spotsLeft <= 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={() => onClick(activity.id)}
      className="bg-white p-8 md:p-10 border border-zinc-100 rounded-3xl mb-6 flex flex-col sm:flex-row gap-8 cursor-pointer group hover:border-zinc-300 hover:shadow-xl hover:shadow-zinc-100 transition-all"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${categoryColors[activity.category]}`}>
            {activity.category}
          </span>
          <span className="text-zinc-200">/</span>
          <span className="text-[10px] font-bold text-zinc-400">
            {activity.hostDept}
          </span>
        </div>

        <h3 className="text-xl font-bold text-black mb-1.5 leading-tight tracking-tight group-hover:text-zinc-700 transition-colors">
          {activity.title}
        </h3>
        
        {activity.description && (
          <p className="text-xs text-zinc-500 font-medium mb-4 line-clamp-2 leading-relaxed">
            {activity.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
          {activity.destination && (
            <div className="flex items-center gap-1.5 bg-zinc-50 px-2 py-1 rounded-md">
              <span className="text-emerald-500">→</span>
              <span>{activity.destination}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-zinc-50 px-2 py-1 rounded-md">
            <MapPin className="w-3 h-3" />
            <span>{activity.meetingPoint}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-zinc-50 px-2 py-1 rounded-md">
            <Clock className="w-3 h-3" />
            <span>{new Date(activity.dateTime).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-zinc-50 px-2 py-1 rounded-md">
            <Users className="w-3 h-3" />
            <span className={isFull ? 'text-red-500' : 'text-zinc-900'}>
              {isFull ? 'FULL' : `${spotsLeft} SPOTS`}
            </span>
          </div>
        </div>
      </div>

      <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex-shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform overflow-hidden">
        {activity.hostPhoto ? (
          <img src={activity.hostPhoto} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-zinc-400 font-bold text-xl">{activity.hostName[0]}</span>
        )}
      </div>
    </motion.div>
  );
};

export default ActivityCard;
