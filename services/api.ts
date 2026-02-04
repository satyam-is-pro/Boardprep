import { db, auth } from '../firebase';
import { 
  collection, addDoc, getDocs, query, where, updateDoc, doc, Timestamp, orderBy, limit, setDoc, getDoc, deleteDoc 
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, User 
} from 'firebase/auth';
import { DailyGoal, StudySession, Subject, Priority } from '../types';

// Check if Firebase is configured with real keys
const isFirebaseConfigured = auth && auth.app.options.apiKey !== "YOUR_API_KEY_HERE";

// --- MOCK DATA STORE ---
const MOCK_DELAY = 400; // Simulate network latency

interface MockUser {
  uid: string;
  email: string;
  displayName: string;
}

let currentMockUser: MockUser | null = JSON.parse(localStorage.getItem('mock_user') || 'null');

// Helper to seed data for Demo Account
const seedMockData = (uid: string) => {
  if (localStorage.getItem(`goals_${uid}`)) return;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const initialGoals: DailyGoal[] = [
    {
      id: 'g1', userId: uid, date: today, title: 'Science - Electricity Numericals', 
      subject: Subject.Science, targetHours: 2, completed: false, priority: Priority.High, createdAt: Date.now()
    },
    {
      id: 'g2', userId: uid, date: today, title: 'Maths - Quadratic Equations', 
      subject: Subject.Maths, targetHours: 1.5, completed: true, priority: Priority.Medium, createdAt: Date.now()
    },
    {
      id: 'g3', userId: uid, date: yesterday, title: 'SST - Nationalism in Europe', 
      subject: Subject.SST, targetHours: 1, completed: false, priority: Priority.High, createdAt: Date.now()
    }
  ];

  const initialSessions: StudySession[] = [
    {
      id: 's1', userId: uid, date: today, subject: Subject.Maths, topic: 'Quadratic Eq Ex 4.1', 
      startTime: Date.now() - 3600000, endTime: Date.now(), durationMinutes: 60
    },
    {
      id: 's2', userId: uid, date: yesterday, subject: Subject.Science, topic: 'Ohm Law', 
      startTime: Date.now() - 90000000, endTime: Date.now() - 86400000, durationMinutes: 120
    }
  ];

  localStorage.setItem(`goals_${uid}`, JSON.stringify(initialGoals));
  localStorage.setItem(`sessions_${uid}`, JSON.stringify(initialSessions));
  localStorage.setItem(`settings_${uid}`, JSON.stringify({ motivationNote: "I will top the boards!" }));
};

// --- API EXPORTS ---

export const api = {
  // AUTH
  onAuthStateChanged: (callback: (user: any) => void) => {
    if (isFirebaseConfigured) {
      return onAuthStateChanged(auth, callback);
    } else {
      callback(currentMockUser);
      // Return dummy unsubscribe
      return () => {};
    }
  },

  signIn: async (email: string, pass: string) => {
    if (isFirebaseConfigured) {
      await signInWithEmailAndPassword(auth, email, pass);
    } else {
      // Mock Login
      if (email === 'satyam@demo.com' && pass === 'demo123') {
        currentMockUser = { uid: 'demo-satyam', email, displayName: 'Satyam' };
        localStorage.setItem('mock_user', JSON.stringify(currentMockUser));
        seedMockData('demo-satyam');
        window.location.reload(); // Force refresh to trigger auth state
      } else {
        throw new Error('Invalid demo credentials. Use satyam@demo.com / demo123');
      }
    }
  },

  signUp: async (email: string, pass: string, name: string) => {
    if (isFirebaseConfigured) {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      if (name) await updateProfile(cred.user, { displayName: name });
      return cred.user;
    } else {
      // Mock Signup
      const uid = 'user_' + Date.now();
      currentMockUser = { uid, email, displayName: name || email.split('@')[0] };
      localStorage.setItem('mock_user', JSON.stringify(currentMockUser));
      seedMockData(uid);
      window.location.reload();
      return currentMockUser;
    }
  },

  signOut: async () => {
    if (isFirebaseConfigured) {
      await signOut(auth);
    } else {
      currentMockUser = null;
      localStorage.removeItem('mock_user');
      window.location.reload();
    }
  },

  // DATA - GOALS
  getGoals: async (userId: string, date: string): Promise<DailyGoal[]> => {
    // Logic: Get goals for TODAY OR (Goals from PAST that are NOT COMPLETED) OR (Goals from PAST that were COMPLETED TODAY)
    const shouldIncludeGoal = (g: DailyGoal) => {
        const isToday = g.date === date;
        // Incomplete goals from the past stay visible (rollover)
        const isPastIncomplete = g.date < date && !g.completed;
        // Completed goals from the past stay visible ONLY if they were completed today
        const isPastCompletedToday = g.date < date && g.completed && g.completedAt === date;
        
        return isToday || isPastIncomplete || isPastCompletedToday;
    };

    if (isFirebaseConfigured) {
      const q = query(collection(db, `users/${userId}/dailyGoals`)); 
      const snap = await getDocs(q);
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyGoal));
      
      return all.filter(shouldIncludeGoal);
    } else {
      await new Promise(r => setTimeout(r, MOCK_DELAY));
      const all = JSON.parse(localStorage.getItem(`goals_${userId}`) || '[]');
      return all.filter(shouldIncludeGoal);
    }
  },

  addGoal: async (userId: string, goal: Partial<DailyGoal>) => {
    if (isFirebaseConfigured) {
      await addDoc(collection(db, `users/${userId}/dailyGoals`), { ...goal, createdAt: Timestamp.now() });
    } else {
      const all = JSON.parse(localStorage.getItem(`goals_${userId}`) || '[]');
      const newGoal = { ...goal, id: 'g_' + Date.now(), createdAt: Date.now() };
      all.push(newGoal);
      localStorage.setItem(`goals_${userId}`, JSON.stringify(all));
    }
  },

  updateGoal: async (userId: string, goalId: string, updates: Partial<DailyGoal>) => {
    if (isFirebaseConfigured) {
      await updateDoc(doc(db, `users/${userId}/dailyGoals`, goalId), updates);
    } else {
      const all = JSON.parse(localStorage.getItem(`goals_${userId}`) || '[]');
      const idx = all.findIndex((g: DailyGoal) => g.id === goalId);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        localStorage.setItem(`goals_${userId}`, JSON.stringify(all));
      }
    }
  },

  deleteGoal: async (userId: string, goalId: string) => {
     if (isFirebaseConfigured) {
      await deleteDoc(doc(db, `users/${userId}/dailyGoals`, goalId));
    } else {
      const all = JSON.parse(localStorage.getItem(`goals_${userId}`) || '[]');
      const filtered = all.filter((g: DailyGoal) => g.id !== goalId);
      localStorage.setItem(`goals_${userId}`, JSON.stringify(filtered));
    }
  },

  toggleGoal: async (userId: string, goalId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const today = new Date().toISOString().split('T')[0];
    const updates = { 
        completed: newStatus,
        completedAt: newStatus ? today : null
    };

    if (isFirebaseConfigured) {
      await updateDoc(doc(db, `users/${userId}/dailyGoals`, goalId), updates);
    } else {
      const all = JSON.parse(localStorage.getItem(`goals_${userId}`) || '[]');
      const idx = all.findIndex((g: DailyGoal) => g.id === goalId);
      if (idx !== -1) {
        all[idx] = { ...all[idx], ...updates };
        localStorage.setItem(`goals_${userId}`, JSON.stringify(all));
      }
    }
  },

  // DATA - SESSIONS
  getSessions: async (userId: string, date?: string): Promise<StudySession[]> => {
    if (isFirebaseConfigured) {
      let q;
      if (date) {
        q = query(collection(db, `users/${userId}/studySessions`), where("date", "==", date));
      } else {
        q = query(collection(db, `users/${userId}/studySessions`), orderBy("endTime", "desc"), limit(200));
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as StudySession));
    } else {
      await new Promise(r => setTimeout(r, MOCK_DELAY));
      const all = JSON.parse(localStorage.getItem(`sessions_${userId}`) || '[]');
      if (date) return all.filter((s: StudySession) => s.date === date);
      return all.sort((a: StudySession, b: StudySession) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());
    }
  },

  addSession: async (userId: string, session: Partial<StudySession>) => {
    if (isFirebaseConfigured) {
      await addDoc(collection(db, `users/${userId}/studySessions`), {
        ...session,
        startTime: Timestamp.fromDate(new Date(session.startTime)),
        endTime: Timestamp.fromDate(new Date(session.endTime))
      });
    } else {
      const all = JSON.parse(localStorage.getItem(`sessions_${userId}`) || '[]');
      const newSession = { ...session, id: 's_' + Date.now() };
      all.push(newSession);
      localStorage.setItem(`sessions_${userId}`, JSON.stringify(all));
    }
  },

  // SETTINGS
  getNote: async (userId: string) => {
    if (isFirebaseConfigured) {
      const snap = await getDoc(doc(db, `users/${userId}/settings/config`));
      return snap.exists() ? snap.data().motivationNote : "";
    } else {
      const settings = JSON.parse(localStorage.getItem(`settings_${userId}`) || '{}');
      return settings.motivationNote || "";
    }
  },

  saveNote: async (userId: string, note: string) => {
    if (isFirebaseConfigured) {
      await setDoc(doc(db, `users/${userId}/settings/config`), { motivationNote: note }, { merge: true });
    } else {
      const settings = JSON.parse(localStorage.getItem(`settings_${userId}`) || '{}');
      settings.motivationNote = note;
      localStorage.setItem(`settings_${userId}`, JSON.stringify(settings));
    }
  }
};