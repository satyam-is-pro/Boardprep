import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Zap, Target, TrendingUp, Calendar, Clock, Award, BookOpen, ChevronRight } from 'lucide-react';

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
    const [weeklyData, setWeeklyData] = useState<{ date: string, hours: number }[]>([]);
    const [subjectData, setSubjectData] = useState<{ name: string, value: number }[]>([]);
    const [heatmapData, setHeatmapData] = useState<{ date: string, mins: number, intensity: number }[]>([]);
    const [dailyLog, setDailyLog] = useState<DailyLogEntry[]>([]);
    const [stats, setStats] = useState({
        totalHours: 0,
        avgConfidence: 0,
        streak: 0,
        bestDay: '',
        avgSession: 0
    });
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const unsub = api.onAuthStateChanged((u) => setCurrentUser(u));
        return () => unsub();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser) return;

            const sessions = await api.getSessions(currentUser.uid);
            const uid = currentUser.uid;

            // 1. Basic Stats & Daily Log Processing
            let totalMins = 0;
            const subjMins: Record<string, number> = {};
            const dayMins: Record<number, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
            const logMap: Record<string, Record<string, { topics: Set<string>, duration: number }>> = {};

            sessions.forEach(s => {
                totalMins += s.durationMinutes;
                subjMins[s.subject] = (subjMins[s.subject] || 0) + s.durationMinutes;

                const day = new Date(s.date).getDay();
                dayMins[day].push(s.durationMinutes);

                // Daily Log Logic
                if (!logMap[s.date]) logMap[s.date] = {};
                if (!logMap[s.date][s.subject]) logMap[s.date][s.subject] = { topics: new Set(), duration: 0 };
                logMap[s.date][s.subject].topics.add(s.topic);
                logMap[s.date][s.subject].duration += s.durationMinutes;
            });

            // Convert Log Map to Array
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

            // 2. Trend Data (Last 14 Days)
            const trendMap: Record<string, number> = {};
            for (let i = 13; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                trendMap[d.toISOString().split('T')[0]] = 0;
            }

            sessions.forEach(s => {
                if (trendMap[s.date] !== undefined) {
                    trendMap[s.date] += s.durationMinutes;
                }
            });

            const trendChartData = Object.keys(trendMap).sort().map(date => ({
                date: date.substring(5), // MM-DD
                hours: parseFloat((trendMap[date] / 60).toFixed(1))
            }));
            setWeeklyData(trendChartData);

            // 3. Heatmap Data (Last 30 Days)
            const heatmapArr = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const dayMinsVal = sessions
                    .filter(s => s.date === dateStr)
                    .reduce((sum, s) => sum + s.durationMinutes, 0);

                heatmapArr.push({
                    date: dateStr,
                    mins: dayMinsVal,
                    intensity: dayMinsVal === 0 ? 0 : dayMinsVal < 60 ? 1 : dayMinsVal < 120 ? 2 : dayMinsVal < 240 ? 3 : 4
                });
            }
            setHeatmapData(heatmapArr);

            // 4. Streak Calculation
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

            // 5. Subject Data
            const pieData = Object.keys(subjMins).map(key => ({
                name: key,
                value: parseFloat((subjMins[key] / 60).toFixed(1))
            }));
            setSubjectData(pieData);

            // 6. Average Confidence
            const allConf = await api.getConfidence(uid);
            const avgConf = allConf.length > 0 ? Math.round(allConf.reduce((a: number, b: number) => a + b, 0) / allConf.length) : 0;

            setStats({
                totalHours: Math.round(totalMins / 60),
                avgConfidence: avgConf,
                streak: currentStreak,
                bestDay: dayNames[bestDayIndex],
                avgSession: sessions.length > 0 ? Math.round(totalMins / sessions.length) : 0
            });
        };

        fetchData();
    }, [currentUser]);

    const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6'];

    const formatDuration = (mins: number) => {
        if (mins < 60) return `${mins}m`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
    };

    return (
        <div className="space-y-8 pb-12">

            {/* Header Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-brand-600 to-brand-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden group">
                    <Zap className="absolute -right-2 -bottom-2 w-24 h-24 opacity-10 group-hover:scale-110 transition-transform" />
                    <div className="relative z-10">
                        <div className="text-brand-100 text-xs font-bold uppercase tracking-wider mb-1">Total Study</div>
                        <div className="text-3xl font-black">{stats.totalHours}h</div>
                        <div className="text-xs mt-2 opacity-80 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Lifetime Hours
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">Current Streak</div>
                        <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg">
                            < Award className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-gray-900 dark:text-white">{stats.streak} Days</div>
                        <div className="text-xs text-orange-600 dark:text-orange-400 font-semibold mt-1">Keep it up! 🔥</div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">Best Day</div>
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
                            <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                    </div>
                    <div>
                        <div className="text-2xl font-black text-gray-900 dark:text-white uppercase">{stats.bestDay}</div>
                        <div className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1">Maximum Focus 🎯</div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">Avg Session</div>
                        <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg">
                            <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                    <div>
                        <div className="text-3xl font-black text-gray-900 dark:text-white">{stats.avgSession}m</div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">Per Study Bout ⏱️</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Main Trend Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h2 className="text-xl font-bold dark:text-white">Study Intensity Trend</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Your focus levels over the last 14 days</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase text-brand-600 bg-brand-50 dark:bg-brand-900/20 px-3 py-1 rounded-full">
                            <Target className="w-3 h-3" /> Focus Factor
                        </div>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={weeklyData}>
                                <defs>
                                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.5} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#9ca3af"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#9ca3af"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}h`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', color: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    itemStyle={{ color: '#fff' }}
                                    cursor={{ stroke: '#0ea5e9', strokeWidth: 2 }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="hours"
                                    stroke="#0ea5e9"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorHours)"
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Subject Distribution */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                    <h2 className="text-xl font-bold mb-2 dark:text-white">Subject Mastery</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Allocation of your prep time</p>
                    <div className="h-64 w-full">
                        {subjectData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={subjectData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={85}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {subjectData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={4} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number) => [`${value} hrs`, 'Study Time']}
                                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Clock className="w-12 h-12 mb-2 opacity-20" />
                                <span>No data available</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Heatmap Section (Datesheet) */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
                <div className="flex justify-between items-end mb-6">
                    <div>
                        <h2 className="text-xl font-bold dark:text-white">Learning Datesheet</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Study presence over the last 30 days</p>
                    </div>
                    <div className="flex gap-1 items-center">
                        <span className="text-[10px] text-gray-400 uppercase font-bold mr-1">Less</span>
                        {[0, 1, 2, 3, 4].map(i => (
                            <div key={i} className={`w-3 h-3 rounded-sm ${i === 0 ? 'bg-gray-100 dark:bg-gray-700' :
                                    i === 1 ? 'bg-brand-200' :
                                        i === 2 ? 'bg-brand-400' :
                                            i === 3 ? 'bg-brand-600' : 'bg-brand-800'
                                }`}></div>
                        ))}
                        <span className="text-[10px] text-gray-400 uppercase font-bold ml-1">More</span>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {heatmapData.map((day, idx) => (
                        <div
                            key={idx}
                            title={`${day.date}: ${day.mins} mins`}
                            className={`w-7 h-7 sm:w-10 sm:h-10 rounded-lg transition-all hover:scale-110 cursor-pointer flex items-center justify-center text-[8px] sm:text-[10px] font-bold ${day.intensity === 0 ? 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500' :
                                    day.intensity === 1 ? 'bg-brand-100 text-brand-600' :
                                        day.intensity === 2 ? 'bg-brand-300 text-brand-800' :
                                            day.intensity === 3 ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' :
                                                'bg-brand-700 text-white shadow-lg shadow-brand-700/20 ring-2 ring-brand-400 ring-offset-2 dark:ring-offset-gray-800'
                                }`}
                        >
                            {day.date.split('-')[2]}
                        </div>
                    ))}
                </div>
            </div>

            {/* Daily Study Log Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-brand-600" />
                        Detailed Study Log
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Daily breakdown of subjects and topics covered</p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Subject & Topics</th>
                                <th className="px-6 py-4 text-right">Total Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {dailyLog.length > 0 ? (
                                dailyLog.map((day, idx) => (
                                    <tr key={idx} className="group hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="px-6 py-4 align-top">
                                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                                                {new Date(day.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </div>
                                            <div className="text-[10px] text-gray-400 uppercase font-bold mt-1">
                                                {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-3">
                                                {day.subjects.map((subj, sIdx) => (
                                                    <div key={sIdx} className="flex items-start gap-4">
                                                        <div className="min-w-[80px]">
                                                            <span className="text-xs font-bold px-2 py-1 rounded bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-800">
                                                                {subj.name}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="text-sm text-gray-600 dark:text-gray-300 flex flex-wrap gap-2">
                                                                {subj.topics.join(' • ')}
                                                            </div>
                                                            <div className="text-[10px] text-gray-400 mt-1 font-medium italic">
                                                                Contributed {formatDuration(subj.duration)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right align-top">
                                            <span className="text-sm font-black text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-3 py-1 rounded-full">
                                                {formatDuration(day.totalMins)}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic">
                                        No study logs found for the selected period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-900 via-brand-900 to-brand-800 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Award className="w-32 h-32 text-yellow-400 group-hover:rotate-12 transition-transform duration-500" />
                </div>
                <h3 className="text-xl font-bold mb-4 relative z-10 flex items-center gap-2">
                    Performance Insights
                </h3>
                <p className="text-brand-100 text-sm mb-6 leading-relaxed relative z-10">
                    Based on your sessions, you are most productive on <span className="text-white font-bold">{stats.bestDay}s</span>.
                    Your average session lasts <span className="text-white font-bold">{stats.avgSession} minutes</span>.
                </p>
                <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                        <div className="text-xs text-brand-200 font-bold uppercase mb-1">Avg Confidence</div>
                        <div className="text-2xl font-black">{stats.avgConfidence}%</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                        <div className="text-xs text-brand-200 font-bold uppercase mb-1">Consistency</div>
                        <div className="text-2xl font-black">High</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;