import React, { useState, useEffect } from "react";
import { Activity, UserProfile } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { db } from "../lib/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { Star, X } from "lucide-react";

interface RatingModalProps {
  activity: Activity;
  currentUser: UserProfile;
  onClose: () => void;
}

export default function RatingModal({ activity, currentUser, onClose }: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [review, setReview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alreadyRated, setAlreadyRated] = useState(false);

  useEffect(() => {
    // Check if user already rated this activity
    const checkExisting = async () => {
      const q = query(
        collection(db, "ratings"),
        where("activityId", "==", activity.id),
        where("fromUserId", "==", currentUser.uid)
      );
      const snap = await getDocs(q);
      if (!snap.empty) setAlreadyRated(true);
    };
    checkExisting();
  }, [activity.id, currentUser.uid]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a star rating!");
      return;
    }
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "ratings"), {
        activityId: activity.id,
        activityTitle: activity.title,
        fromUserId: currentUser.uid,
        fromUserName: currentUser.fullName,
        toUserId: activity.hostId,
        rating,
        review: review.trim(),
        createdAt: new Date().toISOString(),
      });
      toast.success("Rating submitted! Thanks for your feedback.");
      onClose();
    } catch (e) {
      toast.error("Failed to submit rating.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-8"
        >
          <button onClick={onClose} className="absolute top-5 right-5 p-2 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-400" />
          </button>

          <div className="mb-6">
            <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest mb-1">Rate Your Experience</p>
            <h2 className="text-2xl font-black text-black tracking-tight leading-tight">{activity.title}</h2>
          </div>

          {alreadyRated ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">⭐</div>
              <p className="font-black text-black text-lg">Already Rated!</p>
              <p className="text-zinc-400 text-sm mt-1">You've already submitted your rating for this activity.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHovered(star)}
                    onMouseLeave={() => setHovered(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-10 h-10 transition-colors ${
                        star <= (hovered || rating)
                          ? "text-amber-400 fill-amber-400"
                          : "text-zinc-200"
                      }`}
                    />
                  </button>
                ))}
              </div>

              <div className="mb-6">
                <textarea
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Leave a short review (optional)..."
                  rows={3}
                  className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl p-4 text-sm font-medium text-zinc-700 focus:outline-none focus:border-zinc-300 resize-none placeholder:text-zinc-300 transition-all"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting || rating === 0}
                className="w-full bg-black text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Submitting..." : "Submit Rating"}
              </button>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
