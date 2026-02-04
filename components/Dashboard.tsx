import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { DailyGoal, Priority, StudySession } from '../types.ts';
import { EXAM_SCHEDULE } from '../constants.ts';
import { CheckCircle, Circle, TrendingUp, Calendar as CalIcon, Clock, History, Hourglass } from 'lucide-react';
import SessionTracker from './SessionTracker';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
    onGoalsChange?: (stats: { total: number, completed: number }) => void;
}

const Dashboard: React.FC<Props> = ({ onGoalsChange }) => {
    const [goals, setGoals] = useState<(DailyGoal & { actualHours: number })[]>([]);
    const [todayStats, setTodayStats] = useState({
        totalMinutesStudied: 0,
        targetMinutes: 0,
        completedGoals: 0,
        totalGoals: 0
    });
    const [subjectDistribution, setSubjectDistribution] = useState<{ name: string, value: number }[]>([]);
    const [recentSessions, setRecentSessions] = useState<StudySession[]>([]);
    const [nextExam, setNextExam] = useState<{ subject: string, days: number, date: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [motivationalNote, setMotivationalNote] = useState("");
    const [isEditingNote, setIsEditingNote] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const unsub = api.onAuthStateChanged((u) => {
            setCurrentUser(u);
        });
        return () => unsub();
    }, []);

    const fetchDashboardData = async () => {
        if (!currentUser) return;
        setLoading(true);

        const today = new Date().toISOString().split('T')[0];
        const uid = currentUser.uid;

        // 1. Fetch Goals (Includes rollover logic from API)
        const fetchedGoals = await api.getGoals(uid, today);

        // 2. Fetch All Sessions (For stats AND history)
        const allSessions = await api.getSessions(uid); // Returns all sorted by endTime desc

        // Filter for Today's Stats
        const todaysSessions = allSessions.filter(s => s.date === today);

        // Set History
        setRecentSessions(allSessions.slice(0, 5));

        let totalMinutesStudied = 0;
        const subjectMins: Record<string, number> = {};

        todaysSessions.forEach(data => {
            totalMinutesStudied += data.durationMinutes;
            subjectMins[data.subject] = (subjectMins[data.subject] || 0) + data.durationMinutes;
        });

        let targetMinutes = 0;

        // 3. Map actual hours to goals using TODAY'S sessions
        const goalsWithProgress = fetchedGoals.map(g => {
            targetMinutes += (g.targetHours * 60);

            // Calculate progress specific to this goal (matching by title)
            // If exact match isn't found, we could fallback to subject, but specific is better for tracking
            const goalSpecificMinutes = todaysSessions
                .filter(s => s.subject === g.subject && s.topic === g.title)
                .reduce((sum, s) => sum + s.durationMinutes, 0);

            return {
                ...g,
                actualHours: parseFloat((goalSpecificMinutes / 60).toFixed(1))
            };
        });

        // Sort goals: High priority first, then incomplete
        goalsWithProgress.sort((a, b) => {
            if (a.completed === b.completed) {
                const pMap = { [Priority.High]: 3, [Priority.Medium]: 2, [Priority.Low]: 1 };
                return pMap[b.priority] - pMap[a.priority];
            }
            return a.completed ? 1 : -1;
        });

        setGoals(goalsWithProgress);

        // Stats
        const completedCount = goalsWithProgress.filter(g => g.completed).length;
        const totalGoalsCount = fetchedGoals.length;

        setTodayStats({
            totalMinutesStudied,
            targetMinutes,
            completedGoals: completedCount,
            totalGoals: totalGoalsCount
        });

        // Notify Parent (App.tsx) to update Header Badge
        if (onGoalsChange) {
            onGoalsChange({ total: totalGoalsCount, completed: completedCount });
        }

        // Chart Data
        const chartData = Object.keys(subjectMins).map(key => ({
            name: key,
            value: subjectMins[key]
        }));
        setSubjectDistribution(chartData);

        // Fetch Note
        const note = await api.getNote(uid);
        setMotivationalNote(note || "I will not compromise on Science");

        // Calculate Next Exam
        const calcDays = (dateStr: string) => {
            const [day, month, year] = dateStr.split('/').map(Number);
            const examDate = new Date(year, month - 1, day);
            const now = new Date();
            const diff = examDate.getTime() - now.getTime();
            return Math.ceil(diff / (1000 * 60 * 60 * 24));
        };

        const upcoming = EXAM_SCHEDULE
            .map(e => ({ ...e, days: calcDays(e.date) }))
            .filter(e => e.days >= 0)
            .sort((a, b) => a.days - b.days);

        if (upcoming.length > 0) setNextExam({ ...upcoming[0], days: upcoming[0].days });

        setLoading(false);
    };

    useEffect(() => {
        if (currentUser) fetchDashboardData();
    }, [currentUser]);

    const toggleGoalCompletion = async (goal: DailyGoal & { actualHours: number }) => {
        if (!goal.id || !currentUser) return;
        await api.toggleGoal(currentUser.uid, goal.id, goal.completed);
        fetchDashboardData();
    };

    const saveNote = async () => {
        if (!currentUser) return;
        await api.saveNote(currentUser.uid, motivationalNote);
        setIsEditingNote(false);
    };

    const formatTime = (timeValue: any) => {
        if (!timeValue) return '';

        let date: Date;

        // Handle various time formats: number (timestamp), string (ISO), Date obj, Firestore Timestamp
        if (typeof timeValue === 'number') {
            date = new Date(timeValue);
        } else if (typeof timeValue === 'string') {
            date = new Date(timeValue);
        } else if (timeValue instanceof Date) {
            date = timeValue;
        } else if (typeof timeValue.toDate === 'function') {
            date = timeValue.toDate();
        } else {
            return '';
        }

        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDurationHelper = (decimalHours: number) => {
        const h = Math.floor(decimalHours);
        const m = Math.round((decimalHours - h) * 60);
        return `${h}h ${m}m`;
    };

    const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6'];

    if (loading) return <div className="p-8 text-center dark:text-gray-300">Loading your productivity hub...</div>;

    // Calculation for the Time Progress Bar
    const hoursStudied = todayStats.totalMinutesStudied / 60;
    const hoursTarget = todayStats.targetMinutes / 60;
    const timeProgressPercent = hoursTarget > 0 ? Math.min(100, (todayStats.totalMinutesStudied / todayStats.targetMinutes) * 100) : 0;

    // Calculation for Task Completion Bar
    const taskProgressPercent = todayStats.totalGoals > 0 ? (todayStats.completedGoals / todayStats.totalGoals) * 100 : 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left Column: Goals */}
            <div className="lg:col-span-2 space-y-6">

                {/* Daily Summary */}
                <div className="bg-gradient-to-r from-brand-600 to-brand-500 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold">Today's Progress</h2>
                            <p className="opacity-90 mt-1 text-sm">
                                Keep pushing! You've covered {formatDurationHelper(hoursStudied)}.
                            </p>
                        </div>
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            <TrendingUp className="w-6 h-6 text-white" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* Time Progress */}
                        <div>
                            <div className="flex justify-between text-xs font-semibold mb-1 uppercase tracking-wide opacity-90">
                                <span>Time: {formatDurationHelper(hoursStudied)} / {formatDurationHelper(hoursTarget)}</span>
                                <span>{Math.round((todayStats.totalMinutesStudied / (todayStats.targetMinutes || 1)) * 100)}%</span>
                            </div>
                            <div className="w-full bg-black/20 rounded-full h-3">
                                <div
                                    className="bg-yellow-400 h-3 rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                                    style={{ width: `${timeProgressPercent}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Task Progress */}
                        <div>
                            <div className="flex justify-between text-xs font-semibold mb-1 uppercase tracking-wide opacity-90">
                                <span>Tasks: {todayStats.completedGoals} / {todayStats.totalGoals}</span>
                                <span>{Math.round(taskProgressPercent)}%</span>
                            </div>
                            <div className="w-full bg-black/20 rounded-full h-3">
                                <div
                                    className="bg-white h-3 rounded-full transition-all duration-700"
                                    style={{ width: `${taskProgressPercent}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Goals List */}
                <div>
                    <h3 className="text-xl font-bold mb-4 dark:text-white flex items-center justify-between">
                        <span>Active Goals</span>
                        <span className="text-xs font-normal bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                            {goals.length} Tasks
                        </span>
                    </h3>

                    <div className="space-y-3">
                        {goals.length === 0 ? (
                            <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
                                <p className="text-gray-500">No active goals.</p>
                                <p className="text-sm text-gray-400 mt-1">Check the Planner to add new targets.</p>
                            </div>
                        ) : (
                            goals.map(goal => {
                                const progressPercent = Math.min(100, (goal.actualHours / goal.targetHours) * 100);

                                return (
                                    <div
                                        key={goal.id}
                                        className={`group relative bg-white dark:bg-gray-800 p-4 rounded-xl border-l-4 shadow-sm transition-all hover:shadow-md ${goal.completed ? 'border-green-500 opacity-60' :
                                            goal.priority === Priority.High ? 'border-red-500' :
                                                goal.priority === Priority.Medium ? 'border-yellow-500' : 'border-blue-500'
                                            }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className={`font-semibold text-lg ${goal.completed ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                                                        {goal.title}
                                                    </h4>
                                                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500">
                                                        {goal.subject}
                                                    </span>
                                                </div>

                                                <div className="text-xs text-gray-500 flex items-center gap-4 mb-2">
                                                    <span>Target: {formatDurationHelper(goal.targetHours)}</span>
                                                    <span className={`${goal.actualHours >= goal.targetHours ? 'text-green-600 font-bold' : ''}`}>
                                                        Progress: {formatDurationHelper(goal.actualHours)}
                                                    </span>
                                                </div>

                                                {/* Progress Bar for Individual Goal */}
                                                <div className="w-full max-w-xs bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                                    <div
                                                        className={`h-1.5 rounded-full transition-all duration-500 ${goal.completed ? 'bg-green-500' :
                                                            goal.actualHours >= goal.targetHours ? 'bg-green-500' : 'bg-brand-500'
                                                            }`}
                                                        style={{ width: `${progressPercent}%` }}
                                                    ></div>
                                                </div>

                                            </div>

                                            <button
                                                onClick={() => toggleGoalCompletion(goal)}
                                                className="ml-4 text-gray-400 hover:text-green-500 transition-colors"
                                                title={goal.completed ? "Mark as Incomplete" : "Mark as Complete"}
                                            >
                                                {goal.completed ? <CheckCircle className="w-8 h-8 text-green-500" /> : <Circle className="w-8 h-8" />}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Session History */}
                <div>
                    <h3 className="text-lg font-bold mb-4 dark:text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-gray-500" /> Recent Sessions
                    </h3>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                        {recentSessions.length === 0 ? (
                            <div className="p-4 text-sm text-gray-400 text-center">No study sessions recorded yet.</div>
                        ) : (
                            recentSessions.map((session, idx) => (
                                <div key={idx} className="p-4 flex justify-between items-center">
                                    <div>
                                        <div className="text-sm font-semibold dark:text-gray-200">{session.topic || session.subject}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{session.date} • {formatTime(session.endTime)}</div>
                                    </div>
                                    <div className="text-sm font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-2 py-1 rounded">
                                        {session.durationMinutes} min
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Right Column: Tracker & Motivation */}
            <div className="space-y-6">

                {/* Next Exam Widget */}
                {nextExam && (
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-700 rounded-xl p-5 text-white shadow-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Hourglass className="w-24 h-24 text-white" />
                        </div>
                        <div className="relative z-10">
                            <div className="text-xs font-bold uppercase text-gray-400 mb-1">Next Exam</div>
                            <div className="text-2xl font-bold mb-2">{nextExam.subject}</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-extrabold text-brand-400">{nextExam.days}</span>
                                <span className="text-sm text-gray-300">days left</span>
                            </div>
                            <div className="mt-2 text-xs text-gray-400 bg-white/10 inline-block px-2 py-1 rounded">
                                {nextExam.date}
                            </div>
                        </div>
                    </div>
                )}

                <SessionTracker onSessionComplete={fetchDashboardData} activeGoals={goals} />

                {/* Long Term Motivation */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 dark:text-white">
                        <CalIcon className="w-5 h-5 text-red-500" />
                        The Big Picture
                    </h3>

                    <div className="space-y-4 mb-6">
                        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <span className="font-semibold text-gray-700 dark:text-gray-200">Board Target</span>
                            <span className="font-bold text-brand-600 bg-brand-50 dark:bg-brand-900 px-2 py-1 rounded">98%+</span>
                        </div>
                        <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                            <span className="font-semibold text-gray-700 dark:text-gray-200">Consistency</span>
                            <span className="font-bold text-green-600 bg-green-50 dark:bg-green-900 px-2 py-1 rounded">
                                {Math.round(taskProgressPercent)}%
                            </span>
                        </div>
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                        <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">My Promise to Myself</label>
                        {isEditingNote ? (
                            <div>
                                <textarea
                                    value={motivationalNote}
                                    onChange={(e) => setMotivationalNote(e.target.value)}
                                    className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:text-white dark:border-gray-600 text-sm mb-2"
                                    rows={3}
                                />
                                <button onClick={saveNote} className="text-xs bg-brand-600 text-white px-3 py-1 rounded">Save</button>
                            </div>
                        ) : (
                            <div
                                onClick={() => setIsEditingNote(true)}
                                className="text-sm italic text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded transition-colors border border-transparent hover:border-gray-200"
                            >
                                "{motivationalNote}"
                            </div>
                        )}
                    </div>
                </div>

                {/* Mini Analytics */}
                {subjectDistribution.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm h-64">
                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">Subject Breakdown (Today)</h4>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={subjectDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={60}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {subjectDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;