import React, { useState, useEffect } from 'react';
import { EXAM_SCHEDULE, SUBJECTS_LIST } from '../constants';
import { Subject, Priority, DailyGoal } from '../types';
import { api } from '../services/api';
import { Plus, Calendar, AlertTriangle, Trash2, Edit2, X, Check } from 'lucide-react';

interface Props {
  onGoalsChange?: (stats: { total: number, completed: number }) => void;
}

const Planner: React.FC<Props> = ({ onGoalsChange }) => {
  // Form State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<Subject>(Subject.Science);
  // Split targetHours into two states
  const [hoursInput, setHoursInput] = useState(1);
  const [minutesInput, setMinutesInput] = useState(0);
  const [priority, setPriority] = useState<Priority>(Priority.Medium);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // List State
  const [goals, setGoals] = useState<DailyGoal[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Edit State
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = api.onAuthStateChanged((u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  const fetchGoals = async () => {
    if (!currentUser) return;
    const today = new Date().toISOString().split('T')[0];
    const fetched = await api.getGoals(currentUser.uid, today);
    setGoals(fetched);

    // Notify Parent for Header Badge Update
    const total = fetched.length;
    const completed = fetched.filter(g => g.completed).length;
    if (onGoalsChange) onGoalsChange({ total, completed });
  };

  useEffect(() => {
    fetchGoals();
  }, [currentUser]);

  const calculateDaysLeft = (dateStr: string) => {
    const [day, month, year] = dateStr.split('/').map(Number);
    const examDate = new Date(year, month - 1, day);
    const today = new Date();
    const diffTime = examDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      await api.addGoal(currentUser.uid, {
        userId: currentUser.uid,
        date: today,
        title,
        subject,
        targetHours: hoursInput + (minutesInput / 60),
        priority,
        completed: false
      });
      setTitle('');
      setHoursInput(1);
      setMinutesInput(0);
      fetchGoals();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (goalId: string) => {
    if (!currentUser || !confirm("Delete this goal?")) return;
    await api.deleteGoal(currentUser.uid, goalId);
    fetchGoals();
  };

  const startEdit = (goal: DailyGoal) => {
    setEditingGoalId(goal.id!);
    setTitle(goal.title);
    setSubject(goal.subject);

    const totalHours = goal.targetHours;
    const h = Math.floor(totalHours);
    const m = Math.round((totalHours - h) * 60);
    setHoursInput(h);
    setMinutesInput(m);

    setPriority(goal.priority);
  };

  const cancelEdit = () => {
    setEditingGoalId(null);
    setTitle('');
    setHoursInput(1);
    setMinutesInput(0);
  };

  const handleUpdate = async () => {
    if (!currentUser || !editingGoalId) return;
    await api.updateGoal(currentUser.uid, editingGoalId, {
      title, subject, targetHours: hoursInput + (minutesInput / 60), priority
    });
    cancelEdit();
    fetchGoals();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

      {/* Create / Edit Goal Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-fit">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 dark:text-white">
          {editingGoalId ? <Edit2 className="w-5 h-5 text-brand-600" /> : <Plus className="w-5 h-5 text-brand-600" />}
          {editingGoalId ? 'Edit Goal' : 'Set Daily Goal'}
        </h2>

        <form onSubmit={editingGoalId ? (e) => { e.preventDefault(); handleUpdate(); } : handleAddGoal} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Goal Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Finish Electricity Chapter 12"
              required
              className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value as Subject)}
                className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white"
              >
                {SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hours</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={hoursInput}
                  onChange={(e) => setHoursInput(parseInt(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Minutes</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutesInput}
                  onChange={(e) => setMinutesInput(parseInt(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
            <div className="flex gap-2">
              {[Priority.High, Priority.Medium, Priority.Low].map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 text-sm rounded-lg border ${priority === p
                    ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900'
                    : 'bg-transparent text-gray-600 border-gray-300 dark:text-gray-400 dark:border-gray-600'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            {editingGoalId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg transition-colors"
            >
              {isSubmitting ? 'Saving...' : editingGoalId ? 'Update Goal' : 'Lock Goal 🔒'}
            </button>
          </div>
        </form>

        {/* Existing Goals List (Manage) */}
        <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-sm font-bold text-gray-500 uppercase mb-4">Manage Pending Goals</h3>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {goals.filter(g => !g.completed).length === 0 && <p className="text-sm text-gray-400 italic">No pending goals.</p>}
            {goals.filter(g => !g.completed).map(g => (
              <div key={g.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
                <div>
                  <div className="font-semibold text-sm dark:text-white">{g.title}</div>
                  <div className="text-xs text-gray-500">
                    {g.subject} • {Math.floor(g.targetHours)}h {Math.round((g.targetHours % 1) * 60)}m
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(g)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(g.id!)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Exam Schedule */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2 dark:text-white">
          <Calendar className="w-5 h-5 text-red-500" />
          Exam Countdown
        </h2>

        <div className="space-y-3">
          {EXAM_SCHEDULE.map((exam, idx) => {
            const daysLeft = calculateDaysLeft(exam.date);
            const isUrgent = daysLeft < 7 && daysLeft >= 0;
            const isPassed = daysLeft < 0;

            return (
              <div
                key={idx}
                className={`flex justify-between items-center p-4 rounded-lg border ${isUrgent ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'bg-gray-50 border-gray-100 dark:bg-gray-700/50 dark:border-gray-700'
                  } ${isPassed ? 'opacity-50 grayscale' : ''}`}
              >
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">{exam.subject}</h4>
                  <p className="text-xs text-gray-500">{exam.date}</p>
                </div>

                <div className="text-right">
                  {isPassed ? (
                    <span className="text-sm font-medium text-gray-400">Done ✅</span>
                  ) : (
                    <>
                      <div className={`text-xl font-black ${isUrgent ? 'text-red-600' : 'text-brand-600'}`}>
                        {daysLeft}
                      </div>
                      <div className="text-[10px] uppercase text-gray-400 font-medium">Days Left</div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
          <p className="text-xs text-yellow-800 dark:text-yellow-200 leading-relaxed">
            <strong>Note:</strong> Prioritize subjects with fewer days remaining. Stick to the 80/20 rule: 20% of the syllabus often carries 80% of the marks.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Planner;