import React, { useState } from "react";
import { UserProfile } from "../types";
import { User, BookOpen, GraduationCap, Users2, Building2, Phone, Sparkles } from "lucide-react";
import { motion } from "motion/react";

interface ProfileFormProps {
  initialData?: Partial<UserProfile>;
  onSubmit: (data: Partial<UserProfile>) => void;
  isLoading?: boolean;
}

const departments = [
  "Architecture and Planning", "Biosciences and Bioengineering", "Chemical Engineering",
  "Chemistry", "Civil Engineering", "Computer Science and Engineering",
  "Design", "Earth Sciences", "Earthquake Engineering", "Electrical Engineering",
  "Electronics and Communication Engineering", "Humanities and Social Sciences",
  "Hydrology", "Management Studies", "Mathematics", "Mechanical and Industrial Engineering",
  "Metallurgical and Materials Engineering", "Paper Technology", "Physics",
  "Polymer and Process Engineering", "Water Resources Development and Management"
];

const courses = ["B.Tech", "M.Tech", "PhD", "MBA", "B.Arch", "M.Arch", "MSc", "IDD", "PG Diploma"];

const bhawans = [
  "Azad Bhawan",
  "Cautley Bhawan",
  "Ganga Bhawan",
  "Govind Bhawan",
  "Jawahar Bhawan",
  "Kasturba Bhawan",
  "Rajendra Bhawan",
  "Rajiv Bhawan",
  "Ravindra Bhawan",
  "Sarojini Bhawan",
  "Radhakrishnan Bhawan",
  "Vigyan Kunj"
];

export default function ProfileForm({ initialData, onSubmit, isLoading }: ProfileFormProps) {
  const [formData, setFormData] = useState({
    fullName: initialData?.fullName || "",
    dept: initialData?.dept || departments[0],
    year: initialData?.year || 1,
    course: initialData?.course || courses[0],
    gender: initialData?.gender || "Male",
    phone: initialData?.phone || "",
    upiId: initialData?.upiId || "",
    hostelBlock: initialData?.hostelBlock || bhawans[0],
    interests: initialData?.interests || [],
  });

  const [interestInput, setInterestInput] = useState("");

  const addInterest = () => {
    if (interestInput && !formData.interests.includes(interestInput)) {
      setFormData({ ...formData, interests: [...formData.interests, interestInput] });
      setInterestInput("");
    }
  };

  const removeInterest = (interest: string) => {
    setFormData({ ...formData, interests: formData.interests.filter(i => i !== interest) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ ...formData, isProfileComplete: true });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto bg-white p-8 md:p-16 border-t-8 border-black"
    >
      <div className="mb-16">
        <h2 className="text-6xl font-black text-black tracking-tighter mb-4 font-display">YOUR IDENTITY</h2>
        <p className="text-zinc-400 font-bold uppercase tracking-[0.2em] text-xs">Verify your IITR credentials to start riding</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12 pb-16 border-b border-zinc-100">
          <div className="space-y-10">
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4 block">Full Name</label>
              <input
                required
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full bg-zinc-50 border-b-2 border-transparent focus:border-black py-4 px-0 text-2xl font-bold focus:outline-none transition-all placeholder:text-zinc-200"
                placeholder="Name as per ERP"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4 block">Department</label>
              <select
                required
                value={formData.dept}
                onChange={(e) => setFormData({ ...formData, dept: e.target.value })}
                className="w-full bg-zinc-50 border-b-2 border-transparent focus:border-black py-4 px-0 text-xl font-bold focus:outline-none appearance-none"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4 block">Course</label>
                <select
                  required
                  value={formData.course}
                  onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                  className="w-full bg-zinc-50 border-b-2 border-transparent focus:border-black py-4 px-0 text-xl font-bold focus:outline-none"
                >
                  {courses.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4 block">Year</label>
                <input
                  required
                  type="number"
                  min="1"
                  max="5"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  className="w-full bg-zinc-50 border-b-2 border-transparent focus:border-black py-4 px-0 text-xl font-bold focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-10">
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4 block">Gender</label>
              <div className="grid grid-cols-3 gap-2">
                {["Male", "Female", "Other"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: g })}
                    className={`py-4 font-black uppercase text-[10px] tracking-widest border-2 transition-all ${
                      formData.gender === g
                        ? "bg-black border-black text-white"
                        : "bg-white border-zinc-100 text-zinc-400 hover:border-zinc-200"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4 block">WhatsApp Phone</label>
              <input
                required
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-zinc-50 border-b-2 border-transparent focus:border-black py-4 px-0 text-xl font-bold focus:outline-none"
                placeholder="+91"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4 block">UPI ID (For Expense Splitting)</label>
              <input
                type="text"
                value={formData.upiId}
                onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                className="w-full bg-zinc-50 border-b-2 border-transparent focus:border-black py-4 px-0 text-xl font-bold focus:outline-none"
                placeholder="username@upi"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4 block">Bhawan / Hostel</label>
              <select
                required
                value={formData.hostelBlock}
                onChange={(e) => setFormData({ ...formData, hostelBlock: e.target.value })}
                className="w-full bg-zinc-50 border-b-2 border-transparent focus:border-black py-4 px-0 text-xl font-bold focus:outline-none"
              >
                {bhawans.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="uber-button w-full text-xl py-8"
        >
          {isLoading ? "SAVING..." : "COMPLETE ACCOUNT SETUP"}
        </button>
      </form>
    </motion.div>
  );
}
