import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingDown } from 'lucide-react';
import { getBurndown } from '../../services/api';
import { BurndownSnapshot } from '../../types';

interface BurndownChartProps {
  sprintId: string;
  sprintName?: string;
}

export const BurndownChart: React.FC<BurndownChartProps> = ({ sprintId, sprintName }) => {
  const [data, setData] = useState<BurndownSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sprintId) return;
    setIsLoading(true);
    getBurndown(sprintId)
      .then((res) => { if (res.success) setData(res.data ?? []); })
      .finally(() => setIsLoading(false));
  }, [sprintId]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><TrendingDown size={22} /></div>
        <p>No burndown data yet.<br />Add tasks with estimates and start the sprint.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 20,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          Burndown — {sprintName}
        </h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Ideal vs actual remaining work (hours)
        </p>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border-subtle)' }}
          />
          <YAxis
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }}
          />
          <Line
            type="monotone"
            dataKey="idealPoints"
            stroke="hsl(215, 20%, 55%)"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            name="Ideal"
          />
          <Line
            type="monotone"
            dataKey="remainingPoints"
            stroke="hsl(217, 91%, 60%)"
            strokeWidth={2.5}
            dot={{ fill: 'hsl(217, 91%, 60%)', r: 3 }}
            activeDot={{ r: 5 }}
            name="Remaining"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
