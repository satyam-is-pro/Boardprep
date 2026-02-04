import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';

const Analytics: React.FC = () => {
  const [weeklyData, setWeeklyData] = useState<{date: string, hours: number}[]>([]);
  const [subjectData, setSubjectData] = useState<{name: string, value: number}[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const unsub = api.onAuthStateChanged((u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentUser) return;
      
      const sessions = await api.getSessions(currentUser.uid);
      
      let totalMins = 0;
      const subjMins: Record<string, number> = {};

      sessions.forEach(d => {
        totalMins += d.durationMinutes;
        subjMins[d.subject] = (subjMins[d.subject] || 0) + d.durationMinutes;
      });

      setTotalHours(Math.round(totalMins / 60));

      // Aggregate by Date for Weekly Bar Chart
      const groupedByDate: Record<string, number> = {};
      // Initialize last 7 days with 0
      for(let i=6; i>=0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          groupedByDate[dateStr] = 0;
      }

      sessions.forEach(s => {
          if (groupedByDate[s.date] !== undefined) {
              groupedByDate[s.date] += s.durationMinutes;
          }
      });

      const chartData = Object.keys(groupedByDate).sort().map(date => ({
          date: date.substring(5), // MM-DD
          hours: parseFloat((groupedByDate[date] / 60).toFixed(1))
      }));
      setWeeklyData(chartData);

      // Aggregate for Subject Pie Chart
      const pieData = Object.keys(subjMins).map(key => ({
          name: key,
          value: parseFloat((subjMins[key] / 60).toFixed(1))
      }));
      setSubjectData(pieData);
    };

    fetchHistory();
  }, [currentUser]);

  const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Weekly Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-6 dark:text-white">Weekly Consistency</h2>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}h`} />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#1f2937', color: '#fff', border: 'none', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            cursor={{fill: 'transparent'}}
                        />
                        <Bar dataKey="hours" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Subject Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-6 dark:text-white">Lifetime Subject Distribution (Hours)</h2>
            <div className="h-64 w-full">
                {subjectData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={subjectData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {subjectData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                formatter={(value: number) => [`${value} hrs`, 'Study Time']}
                                contentStyle={{ backgroundColor: '#1f2937', color: '#fff', border: 'none', borderRadius: '8px' }}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">No data yet</div>
                )}
            </div>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-brand-600 rounded-xl p-6 text-white shadow-lg">
             <div className="text-4xl font-bold mb-1">{totalHours}</div>
             <div className="text-brand-100 text-sm uppercase font-medium">Total Lifetime Hours</div>
          </div>
          
           <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 flex flex-col justify-center items-center text-center">
             <div className="text-gray-500 dark:text-gray-400 text-sm mb-2">Consistency Score</div>
             <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {weeklyData.filter(d => d.hours > 0).length * 10}%
             </div>
             <div className="text-xs text-green-500 mt-1">Based on daily streaks</div>
          </div>
      </div>
    </div>
  );
};

export default Analytics;