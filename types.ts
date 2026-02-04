export enum Subject {
  Maths = 'Maths',
  Science = 'Science',
  SST = 'Social Science',
  English = 'English',
  Hindi = 'Hindi',
  IT = 'IT',
  Other = 'Other'
}

export enum Priority {
  High = 'High',
  Medium = 'Medium',
  Low = 'Low'
}

export interface DailyGoal {
  id?: string;
  userId: string;
  date: string; // YYYY-MM-DD
  title: string;
  subject: Subject;
  targetHours: number;
  completed: boolean;
  priority: Priority;
  createdAt: any; // Firebase Timestamp
  completedAt?: string | null; // YYYY-MM-DD - Date when it was actually marked complete
}

export interface StudySession {
  id?: string;
  userId: string;
  subject: Subject;
  topic: string;
  startTime: any; // Firebase Timestamp
  endTime: any; // Firebase Timestamp
  durationMinutes: number;
  date: string; // YYYY-MM-DD
}

export interface UserSettings {
  motivationNote: string;
  theme: 'light' | 'dark';
}

export interface ExamDate {
  date: string; // DD/MM/YYYY
  subject: string;
  daysLeft: number;
}