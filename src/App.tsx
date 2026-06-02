import { useState, useEffect, FormEvent } from "react";
import Navbar from "./components/Navbar";
import ActivityFeed from "./components/ActivityFeed";
import CreateActivityModal from "./components/CreateActivityModal";
import ActivityModal from "./components/ActivityModal";
import ProfileForm from "./components/ProfileForm";
import NotificationsTab from "./components/NotificationsTab";
import { Activity, UserProfile, ActivityCategory, JoinRequest } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Calendar, Bell, Compass, User, LogOut, Check, X, MessageSquare, Flame, ShieldAlert, ShieldCheck, Eye, Compass as MapPin } from "lucide-react";
import { auth, db } from "./lib/firebase";
import { toast } from "sonner";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  addDoc,
  updateDoc
} from "firebase/firestore";

export default function App() {
  const [activeTab, setActiveTab] = useState("feed");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [allRequests, setAllRequests] = useState<JoinRequest[]>([]);
  const [profileSubTab, setProfileSubTab] = useState<"groups" | "edit">("groups");
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailLogin, setIsEmailLogin] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Enforce IITR domains
          const email = firebaseUser.email || "";
          const allowedDomains = ["@iitr.ac.in", ".iitr.ac.in"];
          const isAllowed = allowedDomains.some(domain => email.endsWith(domain));

          if (!isAllowed) {
            setAuthError("Only @*.iitr.ac.in emails are allowed.");
            await signOut(auth);
            setIsLoading(false);
            return;
          }

          // Fetch User Profile
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() || {};
            setUser({
              ...data,
              photoUrl: data.photoUrl || "",
            } as UserProfile);
          } else {
            // New user, partial profile
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              fullName: firebaseUser.displayName || "",
              photoUrl: firebaseUser.photoURL || "",
              isProfileComplete: false,
              createdAt: new Date().toISOString(),
              dept: "",
              year: 1,
              course: "",
              gender: "",
            };
            setUser(newUser);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Failed to load user profile:", error);
        setAuthError("Failed to load your profile. Please check your network and refresh.");
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.isProfileComplete) {
      const q = query(
        collection(db, "activities"), 
        where("status", "==", "active"),
        orderBy("dateTime", "asc")
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
        setActivities(docs);
      });

      return () => unsubscribe();
    }
  }, [user?.isProfileComplete]);

  // Real-time unread notifications count
  useEffect(() => {
    if (user?.uid) {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", user.uid),
        where("isRead", "==", false)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setUnreadCount(snapshot.docs.length);
      });
      return () => unsubscribe();
    }
  }, [user?.uid]);

  // Real-time synchronization of join requests concerning the current user
  useEffect(() => {
    if (!user?.isProfileComplete || activities.length === 0) {
      setAllRequests([]);
      return;
    }

    const unsubscribes: (() => void)[] = [];

    activities.forEach((activity) => {
      if (activity.hostId === user.uid) {
        // As Host: listen to all pending/approved/declined requests for this activity
        const qRef = collection(db, "activities", activity.id, "requests");
        const unsub = onSnapshot(qRef, (snapshot) => {
          const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as JoinRequest));
          setAllRequests(prev => {
            const filtered = prev.filter(r => r.activityId !== activity.id);
            return [...filtered, ...reqs];
          });
        }, (err) => {
          console.error("Failed to subscribe to requests for active activity:", activity.id, err);
        });
        unsubscribes.push(unsub);
      } else {
        // As requester: listen to our individual join request document for this activity
        const docRef = doc(db, "activities", activity.id, "requests", user.uid);
        const unsub = onSnapshot(docRef, (snapshot) => {
          if (snapshot.exists()) {
            const req = { id: snapshot.id, ...snapshot.data() } as JoinRequest;
            setAllRequests(prev => {
              const filtered = prev.filter(r => !(r.userId === user.uid && r.activityId === activity.id));
              return [...filtered, req];
            });
          } else {
            setAllRequests(prev => prev.filter(r => !(r.userId === user.uid && r.activityId === activity.id)));
          }
        }, (err) => {
          // Ignore permission-denied read check errors
        });
        unsubscribes.push(unsub);
      }
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [activities, user?.uid, user?.isProfileComplete]);

  // Request decision flow handlers
  const handleApproveRequest = async (activityId: string, req: JoinRequest) => {
    const act = activities.find(a => a.id === activityId);
    if (act && act.spotsOccupied >= act.spotsTotal) {
      toast.error("No spots left in this group!");
      return;
    }

    try {
      await updateDoc(doc(db, "activities", activityId, "requests", req.id), { status: "approved" });
      await updateDoc(doc(db, "activities", activityId), {
        spotsOccupied: (act?.spotsOccupied || 1) + 1
      });
      
      await addDoc(collection(db, "notifications"), {
        userId: req.userId,
        type: "request_approved",
        activityId: activityId,
        message: `Your request to join ${act?.title} was approved!`,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      toast.success("Request approved!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to approve join request.");
    }
  };

  const handleDeclineRequest = async (activityId: string, req: JoinRequest) => {
    const act = activities.find(a => a.id === activityId);
    try {
      await updateDoc(doc(db, "activities", activityId, "requests", req.id), { status: "declined" });
      
      await addDoc(collection(db, "notifications"), {
        userId: req.userId,
        type: "request_declined",
        activityId: activityId,
        message: `Your request to join ${act?.title} was declined.`,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      toast.success("Request declined.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to decline join request.");
    }
  };

  const handleLogin = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === "auth/unauthorized-domain") {
        setAuthError(
          "Google Login is blocked because this domain is not authorized in Firebase. " +
          "To fix this for Vercel/Netlify, create your own Firebase project, add your domain to Authorized Domains, " +
          "and set the VITE_FIREBASE_* variables in your .env file. For now, please use Email Login to test."
        );
      } else {
        setAuthError(`Authentication failed: ${error.message || "Unknown error"}. Please try again.`);
      }
    }
  };

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    // Validate IITR domain BEFORE hitting Firebase to prevent non-IITR registrations
    const allowedDomains = ["@iitr.ac.in", ".iitr.ac.in"];
    const isAllowed = allowedDomains.some(domain => email.endsWith(domain));
    if (!isAllowed) {
      setAuthError("Only @*.iitr.ac.in emails are allowed.");
      return;
    }

    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      // Firebase v10+ merged user-not-found and wrong-password into a single error code
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (createError: any) {
          if (createError.code === 'auth/email-already-in-use') {
            setAuthError("Incorrect password for this account.");
          } else {
            setAuthError("Failed to create account. " + (createError.message || ""));
          }
        }
      } else if (error.code === 'auth/wrong-password') {
        setAuthError("Incorrect password.");
      } else if (error.code === 'auth/too-many-requests') {
        setAuthError("Too many failed login attempts. Please try again later.");
      } else {
        setAuthError("Login failed. " + error.message);
      }
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setActiveTab("feed");
  };

  const handleCreateActivity = async (data: any) => {
    if (!user) return;

    try {
      const newActivity = {
        ...data,
        hostId: user.uid,
        hostName: user.fullName,
        hostPhoto: user.photoUrl,
        hostDept: user.dept,
        hostYear: user.year,
        hostBhawan: user.hostelBlock || "",
        spotsOccupied: 1,
        status: "active",
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "activities"), newActivity);
      setIsCreateModalOpen(false);
      setActiveTab("feed");
      toast.success("Activity published successfully!");
    } catch (error) {
      console.error("Failed to create activity:", error);
      toast.error("Failed to publish activity. Check your connection.");
    }
  };

  const handleProfileComplete = async (data: Partial<UserProfile>) => {
    if (!user) return;

    const updatedUser = {
      ...user,
      ...data,
      isProfileComplete: true,
    } as UserProfile;

    // Filter out undefined values to prevent Firestore validation issues
    const cleanedUser = Object.keys(updatedUser).reduce((acc: any, key) => {
      const val = (updatedUser as any)[key];
      if (val !== undefined && val !== null) {
        acc[key] = val;
      }
      return acc;
    }, {});

    // Ensure photoUrl is never undefined or null
    if (cleanedUser.photoUrl === undefined || cleanedUser.photoUrl === null) {
      cleanedUser.photoUrl = "";
    }

    try {
      await setDoc(doc(db, "users", user.uid), cleanedUser);
      setUser(cleanedUser as UserProfile);
      toast.success("Profile saved!");
    } catch (error) {
      console.error("Failed to save profile:", error);
      toast.error("Error saving profile. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex w-full font-sans">
        {/* Left Panel */}
        <div className="hidden lg:flex lg:w-1/2 bg-black relative overflow-hidden flex-col items-start justify-center p-16 tracking-wide">
          
          {/* Logo */}
          <div className="absolute top-8 left-8 flex items-center gap-3 text-white font-bold z-10 tracking-tight text-2xl">
            <div className="w-10 h-10 flex items-center justify-center bg-white text-black rounded-xl shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-black">
                <circle cx="9" cy="12" r="6" fill="currentColor" fillOpacity="0.2" />
                <circle cx="15" cy="12" r="6" />
              </svg>
            </div>
            <span>Saathi</span>
          </div>

          <div className="z-10 w-full max-w-lg mt-10">
            <h1 className="text-6xl font-bold text-white mb-6 tracking-tight leading-tight">Find your people.<br/>On campus.</h1>
            <p className="text-gray-400 text-lg leading-relaxed max-w-sm">
              Connecting IITR students for travel, study, and everything in between.
            </p>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white relative">
          <div className="w-full max-w-md">
            <div className="mb-12">
              <h2 className="text-3xl font-bold text-black mb-2 tracking-tight">Login Account</h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Enter your credentials to access your Saathi account and connect.
              </p>
            </div>

            {authError && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 font-medium text-sm border border-red-100">
                {authError}
              </div>
            )}

            {!isEmailLogin ? (
              <div className="space-y-4">
                 <button
                  onClick={handleLogin}
                  className="w-full bg-black text-white py-4 px-6 font-bold hover:bg-gray-900 transition-all flex items-center justify-center gap-3 text-sm"
                 >
                   <svg viewBox="0 0 24 24" className="w-5 h-5 bg-white rounded-full p-[2px]"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                   Continue with Google
                 </button>
                 
                 <div className="flex items-center gap-4 py-4">
                    <div className="h-[1px] bg-gray-200 flex-1"></div>
                    <span className="text-gray-400 text-xs font-medium px-2">or</span>
                    <div className="h-[1px] bg-gray-200 flex-1"></div>
                 </div>

                 <button
                    onClick={() => setIsEmailLogin(true)}
                    className="w-full bg-[#f8f8f8] text-black py-4 px-6 font-bold hover:bg-[#efefef] transition-all text-sm flex items-center justify-center gap-3"
                 >
                    Continue with Email
                 </button>


              </div>
            ) : (
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="relative">
                  <input
                    type="email"
                    placeholder="Email (@iitr.ac.in)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#f8f8f8] text-black text-sm py-4 px-4 focus:outline-none transition-all focus:bg-gray-100 placeholder-gray-500"
                    required
                  />
                </div>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#f8f8f8] text-black text-sm py-4 px-4 focus:outline-none transition-all focus:bg-gray-100 placeholder-gray-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-between py-2 text-sm text-gray-600">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" className="w-4 h-4 bg-[#f8f8f8] border-gray-300 text-black focus:ring-black rounded-sm" />
                    <span className="group-hover:text-black transition-colors">Keep me signed in</span>
                  </label>
                  <button type="button" className="text-black hover:underline font-medium transition-colors">
                    Already a member?
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full mt-4 bg-black hover:bg-gray-900 text-white font-bold py-4 transition-all text-sm"
                >
                  Sign in / Register
                </button>

                <div className="pt-6 text-center">
                  <button
                    type="button"
                    onClick={() => setIsEmailLogin(false)}
                    className="text-gray-500 hover:text-black text-xs font-bold transition-colors underline"
                  >
                    Back to options
                  </button>
                </div>
              </form>
            )}
            
          </div>
        </div>
      </div>
    );
  }

  if (!user.isProfileComplete) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-6 md:py-24">
        <ProfileForm initialData={user} onSubmit={handleProfileComplete} />
      </div>
    );
  }

  const myApprovedRequests = allRequests.filter(r => r.userId === user.uid && r.status === "approved");
  const joinedActivities = activities.filter(act => 
    myApprovedRequests.some(req => req.activityId === act.id)
  );
  const hostedActivities = activities.filter(act => act.hostId === user.uid);

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === "create") setIsCreateModalOpen(true);
          else setActiveTab(tab);
        }}
        onLogout={handleLogout}
        userPhoto={user.photoUrl}
        unreadCount={unreadCount}
      />

      <main className="max-w-5xl mx-auto px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <AnimatePresence mode="wait">
          {activeTab === "feed" && (
            <motion.div
              key="feed"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              <ActivityFeed 
                activities={activities} 
                onActivityClick={(id) => setSelectedActivityId(id)} 
                currentUser={user}
              />
            </motion.div>
          )}

          {activeTab === "notifications" && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
            >
              <NotificationsTab
                user={user}
                activities={activities}
                allRequests={allRequests}
                onApproveRequest={handleApproveRequest}
                onDeclineRequest={handleDeclineRequest}
                onOpenChat={(id) => setSelectedActivityId(id)}
              />
            </motion.div>
          )}

          {activeTab === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6 pt-4 md:pt-6"
            >
              {/* Profile sub tabs switcher */}
              <div className="flex gap-6 border-b border-zinc-100 pb-4 mb-8">
                <button
                  type="button"
                  onClick={() => setProfileSubTab("groups")}
                  className={`pb-2 text-xs font-black tracking-widest uppercase transition-all relative ${
                    profileSubTab === "groups" ? "text-black font-extrabold" : "text-zinc-400 hover:text-black"
                  }`}
                >
                  My Social Circles
                  {profileSubTab === "groups" && (
                    <motion.div layoutId="profileSubTab" className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-black" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setProfileSubTab("edit")}
                  className={`pb-2 text-xs font-black tracking-widest uppercase transition-all relative ${
                    profileSubTab === "edit" ? "text-black font-extrabold" : "text-zinc-400 hover:text-black"
                  }`}
                >
                  Edit My Details
                  {profileSubTab === "edit" && (
                    <motion.div layoutId="profileSubTab" className="absolute -bottom-[17px] left-0 right-0 h-0.5 bg-black" />
                  )}
                </button>
              </div>

              {profileSubTab === "edit" ? (
                <ProfileForm initialData={user} onSubmit={handleProfileComplete} />
              ) : (
                <div className="space-y-12">
                  {/* Hosted Activities Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-6 border-l-4 border-black pl-3">
                      <h3 className="text-xl font-black uppercase tracking-wider text-black">COORDINATED PATHS</h3>
                      <span className="text-xs bg-zinc-100 text-zinc-500 font-bold px-2 py-0.5 rounded-full">{hostedActivities.length}</span>
                    </div>

                    {hostedActivities.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {hostedActivities.map(act => {
                          const isFull = act.spotsOccupied >= act.spotsTotal;
                          return (
                            <div 
                              key={act.id}
                              onClick={() => setSelectedActivityId(act.id)}
                              className="bg-white p-6 border border-zinc-100 rounded-3xl shadow-sm hover:border-zinc-300 transition-all cursor-pointer flex flex-col justify-between h-48 hover:shadow-lg group"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[9px] bg-black text-white px-2 py-0.5 rounded font-black tracking-wider uppercase">
                                    {act.category}
                                  </span>
                                  {isFull ? (
                                    <span className="text-[9px] bg-emerald-50 border border-emerald-100 text-emerald-600 px-2.5 py-0.5 rounded font-black tracking-widest uppercase flex items-center gap-1">
                                      <Flame className="w-3 h-3 text-emerald-500 fill-emerald-500" /> FULL & ACTIVE 🔒
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-zinc-400 font-bold uppercase">
                                      {act.spotsTotal - act.spotsOccupied} spots left
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-lg font-bold text-black tracking-tight line-clamp-2 md:leading-snug pr-4 group-hover:text-zinc-650 transition-colors">
                                  {act.title}
                                </h4>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest pt-4 border-t border-zinc-50">
                                <span>{act.meetingPoint}</span>
                                <span className="bg-zinc-50 text-zinc-800 rounded px-2 py-1 text-[9px] font-black">
                                  {act.spotsOccupied}/{act.spotsTotal} SPOTS
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-zinc-100 p-8 rounded-3xl text-center">
                        <p className="text-zinc-400 font-bold text-sm">YOU ARE NOT COORDINATING ANY PATHS</p>
                        <button 
                          onClick={() => {
                            setIsCreateModalOpen(true);
                          }}
                          className="mt-3 text-xs bg-black text-white font-extrabold uppercase py-2 px-4 rounded-full tracking-wider hover:bg-zinc-800 transition-colors cursor-pointer"
                        >
                          PUBLISH AN ACTIVITY
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Joined Activities Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-6 border-l-4 border-black pl-3">
                      <h3 className="text-xl font-black uppercase tracking-wider text-black">JOINED CIRCLES</h3>
                      <span className="text-xs bg-zinc-100 text-zinc-500 font-bold px-2 py-0.5 rounded-full">{joinedActivities.length}</span>
                    </div>

                    {joinedActivities.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {joinedActivities.map(act => {
                          const isFull = act.spotsOccupied >= act.spotsTotal;
                          return (
                            <div 
                              key={act.id}
                              onClick={() => setSelectedActivityId(act.id)}
                              className="bg-white p-6 border border-zinc-100 rounded-3xl shadow-sm hover:border-zinc-300 transition-all cursor-pointer flex flex-col justify-between h-48 hover:shadow-lg group"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[9px] bg-zinc-100 border border-zinc-150 text-zinc-700 px-2 py-0.5 rounded font-black tracking-wider uppercase">
                                    {act.category}
                                  </span>
                                  {isFull ? (
                                    <span className="text-[9px] bg-emerald-50 border border-emerald-100 text-emerald-600 px-2.5 py-0.5 rounded font-black tracking-widest uppercase flex items-center gap-1">
                                      <Flame className="w-3 h-3 text-emerald-500 fill-emerald-500" /> FULL & READY 🔒
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-zinc-400 font-bold uppercase">
                                      Join Confirmed
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-lg font-bold text-black tracking-tight line-clamp-2 md:leading-snug pr-4 group-hover:text-zinc-650 transition-colors">
                                  {act.title}
                                </h4>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest pt-4 border-t border-zinc-50">
                                <span className="truncate pr-2">HOSTED BY {act.hostName}</span>
                                <span className="bg-emerald-50 text-emerald-700 rounded px-2 py-1 text-[9px] font-black whitespace-nowrap">
                                  MEMBER ✓
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-zinc-100 p-8 rounded-3xl text-center">
                        <p className="text-zinc-400 font-bold text-sm">YOU HAVE NOT JOINED ANY ACTIVE CIRCLES YET</p>
                        <button 
                          onClick={() => setActiveTab("feed")}
                          className="mt-3 text-xs bg-zinc-100 text-black font-extrabold uppercase py-2 px-4 rounded-full tracking-wider hover:bg-zinc-200 transition-colors cursor-pointer border border-zinc-200"
                        >
                          EXPLORE PATHS
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <CreateActivityModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateActivity}
        currentUser={user!}
      />

      {selectedActivityId && (
        <ActivityModal
          activityId={selectedActivityId}
          onClose={() => setSelectedActivityId(null)}
          currentUser={user}
        />
      )}
    </div>
  );
}
