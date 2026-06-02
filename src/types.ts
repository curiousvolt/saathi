export enum ActivityCategory {
  TRAVEL = "Travel",
  SOCIAL = "Social",
  SPORTS = "Sports",
  STUDY = "Study",
  OTHER = "Other",
}

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  dept: string;
  year: number;
  course: string;
  gender: string;
  photoUrl?: string;
  phone?: string;
  hostelBlock?: string;
  interests?: string[];
  rating?: number;
  activityCount?: number;
  upiId?: string;
  isProfileComplete: boolean;
  createdAt: string;
}

export interface ActivityFilters {
  gender?: "any" | "male" | "female";
  sameYear?: boolean;
  sameCourse?: boolean;
  sameDept?: boolean;
}

export interface Activity {
  id: string;
  hostId: string;
  category: ActivityCategory;
  title: string;
  description?: string;
  destination?: string; // For Travel
  venue?: string; // For Food/Sports/Study
  dateTime: string;
  meetingPoint: string;
  spotsTotal: number;
  spotsOccupied: number;
  filters: ActivityFilters;
  costSplit?: string;
  status: "active" | "cancelled" | "completed";
  createdAt: string;
  hostName: string;
  hostPhoto?: string;
  hostDept: string;
  hostYear?: number;
  hostBhawan?: string;
  recurrenceFrequency?: "Daily" | "Weekly";
  isRecurring?: boolean;
  isArchived?: boolean;
}

export interface JoinRequest {
  id: string;
  activityId: string;
  userId: string;
  status: "pending" | "approved" | "declined" | "waitlisted";
  createdAt: string;
  requesterName: string;
  requesterPhoto?: string;
  requesterDept: string;
  requesterYear: number;
  requesterCourse: string;
  requesterGender: string;
  requesterPhone?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  activityId: string;
  payerId: string;
  payerName: string;
  amount: number;
  description: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string; // The user receiving the notification
  type: "join_request" | "request_approved" | "request_declined";
  activityId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
