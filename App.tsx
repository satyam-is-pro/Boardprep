import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { MOTIVATIONAL_QUOTES } from './constants';
import Dashboard from './components/Dashboard';
import Planner from './components/Planner';
import Analytics from './components/Analytics';
import { Plus, LayoutDashboard, BookOpen, BarChart3, Settings, LogOut, Menu, X, Calendar, BarChart2, Sun, Moon, User, CheckCircle, Clock, Target } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'dashboard' | 'planner' | 'analytics'>('dashboard');
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage for saved theme preference
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      return savedTheme === 'dark';
    }
    return false;
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');

  // Mobile Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Header Stats State
  const [headerStats, setHeaderStats] = useState({ total: 0, completed: 0 });

  // Authentication Listener via API abstraction
  useEffect(() => {
    const unsubscribe = api.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Theme Toggle with Persistence
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Update Stats Function
  const updateHeaderStats = async (providedStats?: { total: number, completed: number }) => {
    if (providedStats) {
      setHeaderStats(providedStats);
      return;
    }
    if (!user) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const goals = await api.getGoals(user.uid, today);
      setHeaderStats({
        total: goals.length,
        completed: goals.filter(g => g.completed).length
      });
    } catch (e) {
      console.error("Failed to update stats", e);
    }
  };

  // Initial Fetch on User Load
  useEffect(() => {
    if (user) updateHeaderStats();
  }, [user]);

  const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24);
  const todaysQuote = MOTIVATIONAL_QUOTES[dayOfYear % MOTIVATIONAL_QUOTES.length];

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await api.signIn(email, password);
      } else {
        await api.signUp(email, password, name);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };



  const handleLogout = async () => {
    await api.signOut();
    setUser(null);
  };

  // Date Formatting: "Good evening Satyam ,3rd Feb Tuesday"
  const getFormattedHeader = () => {
    const date = new Date();
    const hour = date.getHours();

    // Greeting
    let greeting = "Good Morning";
    if (hour >= 12 && hour < 17) greeting = "Good Afternoon";
    else if (hour >= 17) greeting = "Good Evening";

    const userName = user?.displayName ? user.displayName.split(' ')[0] : 'Student';

    // Ordinal Date (1st, 2nd, 3rd, 4th)
    const day = date.getDate();
    const ordinal = (day: number) => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
      }
    }

    const month = date.toLocaleDateString('en-GB', { month: 'short' });
    const weekday = date.toLocaleDateString('en-GB', { weekday: 'long' });

    // "Good evening Satyam ,3rd Feb Tuesday"
    return `${greeting} ${userName} ,${day}${ordinal(day)} ${month} ${weekday} `;
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <div className="text-center mb-8">
            <img src="/logo.jpg" alt="PrepTracker Logo" className="w-24 h-24 mx-auto mb-6 rounded-full object-cover shadow-lg border-4 border-white dark:border-gray-800" />
            <h1 className="text-2xl font-bold text-gray-900">Class 10 Prep Tracker</h1>
            <p className="text-gray-500">Focus. Discipline. Results.</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}

            {!isLogin && (
              <div className="relative">
                <User className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                <input
                  placeholder="Your Name (e.g., Satyam)"
                  className="w-full pl-10 p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-gray-900"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}

            <input
              type="email"
              placeholder="Email"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-gray-900"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-gray-900"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold hover:bg-brand-700 transition">
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>



          <div className="mt-4 text-center">
            <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-sm text-brand-600 hover:underline">
              {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 dark:bg-gray-900 transition-colors duration-200">

      {/* Sidebar */}
      {/* Mobile Menu Button - Visible ONLY on Mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg shadow-sm">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">PrepTracker</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar - Fixed on desktop, Overlay on mobile */}
      <aside className={`
          fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          transform transition-transform duration-300 ease-in-out md:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:top-0
      `}>
        <div className="p-6 pb-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl shadow-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900 dark:text-white tracking-tight">PrepTracker</span>
          </div>
        </div>

        <div className="mx-6 mt-6 mb-2 border-b border-gray-200 dark:border-gray-700/50"></div>

        <nav className="flex flex-col gap-1 p-4 md:p-6 h-full md:h-auto overflow-y-auto pt-20 md:pt-6">
          <button
            onClick={() => { setView('dashboard'); setIsSidebarOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${view === 'dashboard' ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </button>
          <button
            onClick={() => { setView('planner'); setIsSidebarOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${view === 'planner' ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <Calendar className="w-5 h-5" /> Planner & Exams
          </button>
          <button
            onClick={() => { setView('analytics'); setIsSidebarOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${view === 'analytics' ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <BarChart2 className="w-5 h-5" /> History
          </button>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">

          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-gray-500 uppercase font-bold">Settings</span>
            <button onClick={() => setDarkMode(!darkMode)} className="text-gray-500 hover:text-brand-600">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 transition-colors">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto h-screen pt-20 md:pt-8 w-full">
        {/* Header - No longer Sticky */}
        <header className="bg-gray-50/95 dark:bg-gray-900/95 pb-6 border-b border-gray-200 dark:border-gray-800 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                {getFormattedHeader()}
              </h1>
              <div className="mt-1 text-sm italic text-gray-600 dark:text-gray-300">"{todaysQuote}"</div>
            </div>
            <div className="flex items-center gap-3">
              {/* Badge Logic */}
              {headerStats.total > 0 && headerStats.completed === headerStats.total ? (
                <span className="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 rounded-full text-xs font-bold uppercase flex items-center gap-2 border border-green-200 dark:border-green-800">
                  <CheckCircle className="w-4 h-4" /> All Goals Completed
                </span>
              ) : headerStats.total > 0 ? (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200 rounded-full text-xs font-bold uppercase animate-pulse flex items-center gap-2 border border-yellow-200 dark:border-yellow-800">
                  <Clock className="w-4 h-4" /> Goal In Progress
                </span>
              ) : (
                <span className="px-3 py-1 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 rounded-full text-xs font-bold uppercase flex items-center gap-2 border border-gray-200 dark:border-gray-700">
                  <Target className="w-4 h-4" /> Set Daily Goals
                </span>
              )}
            </div>
          </div>
        </header>

        {view === 'dashboard' && <Dashboard onGoalsChange={updateHeaderStats} />}
        {view === 'planner' && <Planner onGoalsChange={updateHeaderStats} />}
        {view === 'analytics' && <Analytics />}

        <footer className="mt-12 py-6 border-t border-gray-200 dark:border-gray-800 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Made with <span className="text-red-500 animate-pulse">❤️</span> by <a href="https://github.com/satyam-is-pro" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 dark:text-brand-400 hover:underline">satyam-is-pro</a>
          </p>
        </footer>
      </main>
    </div>
  );
};

export default App;