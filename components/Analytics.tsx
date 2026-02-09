import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, BarChart, Bar, Line } from 'recharts';
import { Zap, Target, TrendingUp, Calendar, Clock, Award, BookOpen, Brain, Star, Flame } from 'lucide-react';

interface DailyLogEntry {
    date: string;
    subjects: {
        name: string;
        topics: string[];
        duration: number;
    }[];
    totalMins: number;
}

const Analytics: React.FC = () => {
    const [weeklyData, setWeeklyData] = useState<{ date: string, hours: number, confidence: number | null, fullDate: string }[]>([]);
    const [subjectData, setSubjectData] = useState<{ name: string, value: number }[]>([]);
    const [dailyLog, setDailyLog] = useState<DailyLogEntry[]>([]);
    const [isDark, setIsDark] = useState(false);
    const [stats, setStats] = useState({
        totalHours: 0,
        avgConfidence: 0,
        streak: 0,
        bestDay: '',
        avgSession: 0,
        totalTopics: 0
    });
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const unsub = api.onAuthStateChanged((u) => setCurrentUser(u));
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        setIsDark(document.documentElement.classList.contains('dark'));

        return () => {
            unsub();
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser) return;

            const sessions = await api.getSessions(currentUser.uid);
            const uid = currentUser.uid;
            const allConf = await api.getConfidence(uid);
            const confHistory = await api.getConfidenceHistory(uid);

            // 1. Basic Stats & Daily Log Processing
            let totalMins = 0;
            const subjMins: Record<string, number> = {};
            const dayMins: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
            const logMap: Record<string, Record<string, { topics: Set<string>, duration: number }>> = {};
            const totalTopicsSet = new Set<string>();

            sessions.forEach(s => {
                totalMins += s.durationMinutes;
                subjMins[s.subject] = (subjMins[s.subject] || 0) + s.durationMinutes;
                totalTopicsSet.add(`${s.subject}-${s.topic}`);

                const day = new Date(s.date).getDay();
                dayMins[day].push(s.durationMinutes);

                if (!logMap[s.date]) logMap[s.date] = {};
                if (!logMap[s.date][s.subject]) logMap[s.date][s.subject] = { topics: new Set(), duration: 0 };
                logMap[s.date][s.subject].topics.add(s.topic);
                logMap[s.date][s.subject].duration += s.durationMinutes;
            });

            const logArr: DailyLogEntry[] = Object.keys(logMap).sort().reverse().map(date => {
                const subjects = Object.keys(logMap[date]).map(subj => ({
                    name: subj,
                    topics: Array.from(logMap[date][subj].topics),
                    duration: Math.round(logMap[date][subj].duration)
                }));
                const totalMins = subjects.reduce((sum, s) => sum + s.duration, 0);
                return { date, subjects, totalMins };
            });
            setDailyLog(logArr);

            // 2. Trend Data with Confidence Correlation (Proper Scaling)
            const trendMap: Record<string, { mins: number, conf?: number }> = {};
            // Last 14 days
            for (let i = 13; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dStr = d.toISOString().split('T')[0];
                trendMap[dStr] = { mins: 0 };
            }

            sessions.forEach(s => {
                if (trendMap[s.date]) trendMap[s.date].mins += s.durationMinutes;
            });

            const confMap: Record<string, number> = {};
            confHistory.forEach(c => { confMap[c.date] = c.score; });

            const trendChartData = Object.keys(trendMap).sort().map(date => ({
                fullDate: date,
                date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
                hours: parseFloat((trendMap[date].mins / 60).toFixed(2)), // Better precision
                confidence: confMap[date] || null
            }));
            setWeeklyData(trendChartData);

            // 3. Streak Calculation
            let currentStreak = 0;
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            const sessionDatesSet = new Set(sessions.map(s => s.date));
            let tempDate = sessionDatesSet.has(today) ? today : (sessionDatesSet.has(yesterday) ? yesterday : null);
            if (tempDate) {
                while (sessionDatesSet.has(tempDate)) {
                    currentStreak++;
                    const d = new Date(tempDate);
                    d.setDate(d.getDate() - 1);
                    tempDate = d.toISOString().split('T')[0];
                }
            }

            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            let bestDayIndex = 0;
            let maxTotal = 0;
            Object.keys(dayMins).forEach(day => {
                const idx = parseInt(day);
                const total = dayMins[idx].reduce((a, b) => a + b, 0);
                if (total > maxTotal) {
                    maxTotal = total;
                    bestDayIndex = idx;
                }
            });

            const pieData = Object.keys(subjMins).map(key => ({
                name: key,
                value: parseFloat((subjMins[key] / 60).toFixed(1))
            }));
            setSubjectData(pieData);

            const avgConf = allConf.length > 0 ? Math.round(allConf.reduce((a: number, b: number) => a + b, 0) / allConf.length) : 0;

            setStats({
                totalHours: Math.round(totalMins / 60),
                avgConfidence: avgConf,
                streak: currentStreak,
                bestDay: dayNames[bestDayIndex],
                avgSession: sessions.length > 0 ? Math.round(totalMins / sessions.length) : 0,
                totalTopics: totalTopicsSet.size
            });
        };

        fetchData();
    }, [currentUser]);

    const COLORS = ['#8b5cf6', '#0ea5e9', '#10b981', '#f43f5e', '#f59e0b', '#ec4899'];

    const formatDuration = (mins: number) => {
        if (mins < 60) return `${mins}m`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const dateObj = new Date(payload[0].payload.fullDate);
            const formattedDate = dateObj.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'short',
                day: 'numeric'
            });

            return (
                <div className={`${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} border p-4 rounded-xl shadow-2xl min-w-[200px]`}>
                    <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} text-xs font-bold uppercase mb-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'} pb-2`}>
                        {formattedDate}
                    </p>
                    <div className="space-y-3">
                        {payload.map((entry: any, index: number) => {
                            const isHours = entry.name === 'hours';
                            return (
                                <div key={index} className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                        <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            {isHours ? 'Study Effort' : 'Readiness'}
                                        </span>
                                    </div>
                                    <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {isHours ? `${entry.value}h` : `${entry.value ?? 0}%`}
                                    </span>
                                </div>
                            );
                        })}
                        {/* Ensure confidence shows even if not in payload (if possible) */}
                        {!payload.find((p: any) => p.name === 'confidence') && (
                            <div className="flex items-center justify-between gap-4 opacity-50">
                                <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500 opacity-50"></div>
                                    <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        Readiness
                                    </span>
                                </div>
                                <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    --%
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };

    const PieTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className={`${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} border p-4 rounded-xl shadow-2xl`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: payload[0].color }}></div>
                        <span className={`text-sm font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {data.name}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1 pl-6">
                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} font-bold`}>
                            Time Spent: <span className={isDark ? 'text-white' : 'text-gray-900'}>{data.value} hrs</span>
                        </div>
                        <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} font-bold`}>
                            Distribution: <span className={isDark ? 'text-white' : 'text-gray-900'}>{((data.value / stats.totalHours) * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        if (percent < 0.1) return null;

        return (
            <text
                x={x}
                y={y}
                fill={isDark ? "white" : "#1f2937"}
                textAnchor={x > cx ? 'start' : 'end'}
                dominantBaseline="central"
                className="text-[10px] font-black"
            >
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    return (
        <div className="space-y-8 pb-12">

            {/* Motivational Hero Header */}
            <div className="bg-gradient-to-br from-indigo-900 via-brand-900 to-purple-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Brain className="w-64 h-64 text-white scale-150 rotate-12" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="text-center md:text-left">
                        <h1 className="text-4xl font-black mb-2 flex items-center justify-center md:justify-start gap-3">
                            Growth Analytics <Star className="w-8 h-8 text-yellow-400 fill-current" />
                        </h1>
                        <p className="text-indigo-200 text-lg max-w-md">
                            Your hard work is compounding. You've conquered <span className="text-white font-bold">{stats.totalTopics} topics</span> across <span className="text-white font-bold">{stats.totalHours} hours</span>.
                        </p>
                        <div className="mt-6 flex flex-wrap gap-4 justify-center md:justify-start">
                            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                                <Flame className="w-5 h-5 text-orange-400" />
                                <span className="font-bold">{stats.streak} Day Streak</span>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                                <Target className="w-5 h-5 text-emerald-400" />
                                <span className="font-bold">{stats.avgConfidence}% Ready</span>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-xl p-6 rounded-2xl border border-white/20 shadow-2xl min-w-[280px]">
                        <div className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-4">Weekly Momentum</div>
                        <div className="h-32 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyData}>
                                    <Bar dataKey="hours" fill="#a78bfa" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="text-center mt-4 text-xs font-medium text-indigo-100 italic">
                            Success is built day by day.
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Motivation Correlation Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-2xl font-black dark:text-white">Study Power Index</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total hours vs. Confidence levels</p>
                        </div>
                        <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-xl">
                            <Award className="w-6 h-6 text-brand-600" />
                        </div>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={weeklyData}>
                                <defs>
                                    <linearGradient id="colorMins" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#374151' : '#f3f4f6'} opacity={0.5} />
                                <XAxis
                                    dataKey="fullDate"
                                    stroke="#9ca3af"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(str) => {
                                        const date = new Date(str);
                                        return date.toLocaleDateString('en-US', { weekday: 'short' });
                                    }}
                                />
                                <YAxis
                                    yAxisId="left"
                                    stroke="#9ca3af"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => `${v}h`}
                                    domain={[0, 'auto']}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#9ca3af"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => `${v}%`}
                                    domain={[0, 100]}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: isDark ? '#4b5563' : '#e5e7eb', strokeWidth: 1 }} />
                                <Area
                                    yAxisId="left"
                                    type="monotone"
                                    name="hours"
                                    dataKey="hours"
                                    stroke="#8b5cf6"
                                    strokeWidth={4}
                                    fill="url(#colorMins)"
                                    animationDuration={2000}
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    name="confidence"
                                    dataKey="confidence"
                                    stroke="#f59e0b"
                                    strokeWidth={3}
                                    dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4, stroke: isDark ? '#1f2937' : '#fff' }}
                                    activeDot={{ r: 7, strokeWidth: 0 }}
                                    animationDuration={2000}
                                    connectNulls
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-8 flex justify-center gap-8">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-purple-500 rounded-md shadow-lg shadow-purple-500/30"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Total Effort (h)</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 bg-amber-500 rounded-md shadow-lg shadow-amber-500/30"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Readiness Score (%)</span>
                        </div>
                    </div>
                </div>

                {/* Subject Mastery Pie */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-2xl font-black mb-2 dark:text-white">Prep Distribution</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Time allocation across your curriculum</p>
                    <div className="h-80 w-full relative">
                        {subjectData.length > 0 ? (
                            <>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="text-center">
                                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Time</div>
                                        <div className="text-3xl font-black text-gray-900 dark:text-white">{stats.totalHours}h</div>
                                    </div>
                                </div>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={subjectData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={85}
                                            outerRadius={115}
                                            paddingAngle={8}
                                            dataKey="value"
                                            stroke="none"
                                            labelLine={false}
                                            label={renderCustomizedLabel}
                                        >
                                            {subjectData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={12} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<PieTooltip />} />
                                        <Legend
                                            iconType="circle"
                                            wrapperStyle={{ paddingTop: '30px', color: isDark ? '#fff' : '#000' }}
                                            formatter={(value) => <span style={{ color: isDark ? '#9ca3af' : '#4b5563', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{value}</span>}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Clock className="w-16 h-16 mb-4 opacity-10" />
                                <span className="font-medium">Complete a session to unlock insights!</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Daily Study Log Table */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20">
                    <h3 className="text-2xl font-black dark:text-white flex items-center gap-3">
                        <BookOpen className="w-7 h-7 text-brand-600" />
                        Focus History
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">A chronical of your daily academic milestones</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">
                                <th className="px-8 py-5">Date</th>
                                <th className="px-8 py-5">Activity Details</th>
                                <th className="px-8 py-5 text-right w-32">Daily Effort</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {dailyLog.length > 0 ? (
                                dailyLog.map((day, idx) => (
                                    <tr key={idx} className="group hover:bg-brand-50/20 dark:hover:bg-brand-900/10 transition-colors">
                                        <td className="px-8 py-6 align-top">
                                            <div className="text-base font-black text-gray-900 dark:text-white">
                                                {new Date(day.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                            <div className="text-[11px] text-gray-400 uppercase font-black mt-1 tracking-wider">
                                                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' })}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="space-y-4">
                                                {day.subjects.map((subj, sIdx) => (
                                                    <div key={sIdx} className="flex items-start gap-4">
                                                        <div className="min-w-[100px]">
                                                            <span className="text-[10px] font-black px-3 py-1.5 rounded-lg bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 shadow-sm inline-block w-full text-center">
                                                                {subj.name}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-sm font-bold text-gray-700 dark:text-gray-200 leading-relaxed">
                                                                {subj.topics.join(' • ')}
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 mt-1.5 font-bold uppercase tracking-wider flex items-center gap-2">
                                                                <Clock className="w-3 h-3" /> {formatDuration(subj.duration)} spent
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right align-top">
                                            <div className="inline-flex flex-col items-end">
                                                <span className="text-sm font-black text-white bg-brand-600 dark:bg-brand-500 px-4 py-2 rounded-xl shadow-lg shadow-brand-500/30 whitespace-nowrap">
                                                    {formatDuration(day.totalMins)}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="px-8 py-20 text-center text-gray-400 font-medium">
                                        <div className="flex flex-col items-center gap-4">
                                            <Star className="w-12 h-12 opacity-10" />
                                            <span>Your study chronicle is waiting to be written!</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Quick Insights Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-5">
                    <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-2xl">
                        <TrendingUp className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Efficiency</div>
                        <div className="text-xl font-black text-gray-900 dark:text-white">Optimized</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-5">
                    <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-2xl">
                        <Zap className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Focus Peak</div>
                        <div className="text-xl font-black text-gray-900 dark:text-white">{stats.bestDay}s</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-5">
                    <div className="bg-emerald-100 dark:bg-emerald-900/30 p-4 rounded-2xl">
                        <Target className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Consistency</div>
                        <div className="text-xl font-black text-gray-900 dark:text-white">Reliable</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;