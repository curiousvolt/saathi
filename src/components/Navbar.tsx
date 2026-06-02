import { LucideIcon, Compass, PlusSquare, User, LogOut, Bell } from "lucide-react";
import { motion } from "motion/react";

interface NavbarProps {
  onTabChange: (tab: string) => void;
  activeTab: string;
  userPhoto?: string;
  onLogout: () => void;
  unreadCount?: number;
}

export default function Navbar({ onTabChange, activeTab, userPhoto, onLogout, unreadCount = 0 }: NavbarProps) {
  const tabs = [
    { id: "feed", label: "FEED", icon: Compass },
    { id: "notifications", label: "ALERTS", icon: Bell },
    { id: "profile", label: "PROFILE", icon: User },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 md:h-20 bg-black text-white px-4 md:px-12 flex justify-between items-center z-50 border-b border-zinc-800 shadow-xl">
      <div 
        className="flex items-center gap-3 cursor-pointer select-none"
        onClick={() => onTabChange("feed")}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 md:w-8 md:h-8 text-white">
          <circle cx="9" cy="12" r="6" fill="currentColor" fillOpacity="0.2" />
          <circle cx="15" cy="12" r="6" />
        </svg>
        <span className="font-extrabold tracking-tight text-xl md:text-2xl text-white">SAATHI</span>
      </div>

      <div className="flex gap-2 sm:gap-6 md:gap-10 h-full items-stretch">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 md:gap-2 transition-all relative px-2.5 md:px-4 cursor-pointer outline-none ${
                activeTab === tab.id 
                  ? "text-white font-extrabold opacity-100" 
                  : "text-zinc-500 hover:text-white opacity-60 hover:opacity-100"
              }`}
            >
              <Icon className="w-4.5 h-4.5 md:w-5 md:h-5" />
              <span className="hidden sm:inline text-xs md:text-sm font-extrabold tracking-widest">{tab.label}</span>
              {tab.id === "notifications" && unreadCount > 0 && (
                <span className="absolute top-1 right-1 md:right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabNav"
                  className="absolute bottom-0 left-0 right-0 h-[3px] bg-white"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={() => onTabChange("create")}
          className="flex items-center gap-1.5 bg-white text-black px-3.5 py-1.5 md:px-5 md:py-2 rounded-full hover:scale-[1.03] transition-all active:scale-95 shadow-md hover:shadow-lg font-black text-[10px] md:text-xs tracking-wider uppercase"
        >
          <PlusSquare className="w-4 h-4 md:w-4.5 md:h-4.5" />
          <span>POST</span>
        </button>

        <button
          onClick={onLogout}
          className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-500 hover:bg-zinc-800 transition-all active:scale-95"
          title="Logout"
        >
          <LogOut className="w-4 h-4 md:w-4.5 md:h-4.5" />
        </button>
      </div>
    </nav>
  );
}
