import React, { useState, useEffect, useRef } from 'react';
import { Subject, DailyGoal } from '../types.ts';
import { api } from '../services/api';
import { Play, Square, Save, Clock, Target } from 'lucide-react';

interface Props {
  onSessionComplete: () => void;
  activeGoals: DailyGoal[];
}

const SessionTracker: React.FC<Props> = ({ onSessionComplete, activeGoals }) => {
  const [activeTab, setActiveTab] = useState<'timer' | 'manual'>('timer');
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // Selection State
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');

  // Derived state from selected goal
  const [subject, setSubject] = useState<Subject | ''>('');
  const [topic, setTopic] = useState('');

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [feedback, setFeedback] = useState<string>('');

  // Timer Ref
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  useEffect(() => {
    const unsub = api.onAuthStateChanged((u) => setCurrentUser(u));
    return () => {
      unsub();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Clear feedback after 3 seconds
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(''), 3000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const handleGoalSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const gId = e.target.value;
    setSelectedGoalId(gId);

    const goal = activeGoals.find(g => g.id === gId);
    if (goal) {
      setSubject(goal.subject);
      setTopic(goal.title);
    } else {
      setSubject('');
      setTopic('');
    }
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    if (!selectedGoalId) {
      alert("Please select a goal to work on first!");
      return;
    }
    setIsRunning(true);
    startTimeRef.current = new Date();

    // Update UI using timestamp difference for accuracy (avoids interval drift)
    timerRef.current = window.setInterval(() => {
      if (startTimeRef.current) {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTimeRef.current.getTime()) / 1000);
        setSeconds(elapsed);
      }
    }, 1000);
  };

  const stopTimer = async () => {
    if (!currentUser || !startTimeRef.current) return;

    clearInterval(timerRef.current!);
    setIsRunning(false);

    const endTime = new Date();
    // Calculate precise duration in seconds based on timestamps
    const elapsedSeconds = (endTime.getTime() - startTimeRef.current.getTime()) / 1000;

    // Save if > 5 seconds to catch short tests and "automatic" feel
    if (elapsedSeconds >= 5) {
      // Calculate minutes as float for better accuracy on short sessions
      const duration = elapsedSeconds / 60;
      await saveSession(startTimeRef.current, endTime, duration);
      setFeedback('Session Logged! ✅');
    } else {
      setFeedback('Too short (< 5s) ❌');
    }

    setSeconds(0);
    startTimeRef.current = null;
    // Don't clear selection so they can continue if needed
  };

  const saveSession = async (start: Date, end: Date, duration: number) => {
    try {
      if (!currentUser) return;
      const today = new Date().toISOString().split('T')[0];
      await api.addSession(currentUser.uid, {
        userId: currentUser.uid,
        subject: subject as Subject,
        topic,
        startTime: start,
        endTime: end,
        durationMinutes: duration,
        date: today
      });
      onSessionComplete();
    } catch (error) {
      console.error("Error saving session", error);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!selectedGoalId) {
      alert("Select a goal first.");
      return;
    }

    const form = e.target as HTMLFormElement;
    const durationInput = parseFloat(form.duration.value);

    if (isNaN(durationInput) || durationInput <= 0) {
      alert("Please enter a valid duration.");
      return;
    }

    // Create approximate start/end times based on now
    const end = new Date();
    const start = new Date(end.getTime() - durationInput * 60000);

    await saveSession(start, end, durationInput);
    setFeedback('Manual Log Saved! ✅');
    form.reset();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2 dark:text-white">
        <Clock className="w-5 h-5 text-brand-600" />
        Start Studying
      </h3>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('timer')}
          className={`pb-2 text-sm font-medium ${activeTab === 'timer' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500'}`}
        >
          Stopwatch
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`pb-2 text-sm font-medium ${activeTab === 'manual' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500'}`}
        >
          Manual Log
        </button>
      </div>

      <div className="space-y-4">
        <div className="bg-brand-50 dark:bg-brand-900/20 p-3 rounded-lg border border-brand-100 dark:border-brand-800">
          <label className="block text-xs font-bold text-brand-800 dark:text-brand-300 uppercase mb-2 flex items-center gap-1">
            <Target className="w-3 h-3" /> Select Target Goal
          </label>
          <select
            value={selectedGoalId}
            onChange={handleGoalSelect}
            disabled={isRunning}
            className="w-full p-2.5 rounded bg-white dark:bg-gray-700 border border-brand-200 dark:border-brand-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          >
            <option value="">-- Choose a Goal --</option>
            {activeGoals.filter(g => !g.completed).map(g => (
              <option key={g.id} value={g.id}>
                [{g.subject}] {g.title}
              </option>
            ))}
            {activeGoals.length === 0 && <option disabled>No pending goals. Add one in Planner!</option>}
          </select>
          {selectedGoalId && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Current Target: <span className="font-semibold text-gray-800 dark:text-gray-200">{topic}</span>
            </div>
          )}
        </div>

        {activeTab === 'timer' ? (
          <div className="mt-6 flex flex-col items-center">
            <div className={`text-5xl font-mono font-bold mb-6 ${isRunning ? 'text-brand-600' : 'text-gray-400'}`}>
              {formatTime(seconds)}
            </div>

            {feedback && (
              <div className="mb-4 text-sm font-semibold text-green-600 dark:text-green-400 animate-bounce">
                {feedback}
              </div>
            )}

            {!isRunning ? (
              <button
                onClick={startTimer}
                disabled={!selectedGoalId}
                className={`w-full py-3 text-white rounded-lg flex items-center justify-center gap-2 font-semibold transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg ${!selectedGoalId ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 hover:from-purple-500 hover:via-pink-500 hover:to-red-500 shadow-purple-500/50'}`}
              >
                <Play className="w-5 h-5 fill-current" /> START FOCUS SESSION
              </button>
            ) : (
              <button
                onClick={stopTimer}
                className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center gap-2 font-semibold transition-colors"
              >
                <Square className="w-5 h-5" /> Stop Session
              </button>
            )}
            {isRunning && <p className="text-xs text-gray-500 mt-2 animate-pulse">Stay focused. You got this!</p>}
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="mt-4">
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Duration (Minutes)</label>
              <input
                type="number"
                name="duration"
                min="0.1"
                step="0.1"
                required
                className="w-full p-2 rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 dark:text-white"
              />
            </div>
            {feedback && (
              <div className="mb-4 text-sm font-semibold text-green-600 dark:text-green-400">
                {feedback}
              </div>
            )}
            <button
              type="submit"
              disabled={!selectedGoalId}
              className={`w-full py-3 text-white rounded-lg flex items-center justify-center gap-2 font-semibold ${!selectedGoalId ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-800 dark:bg-gray-600 hover:bg-gray-900'}`}
            >
              <Save className="w-5 h-5" /> Log Session
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SessionTracker;