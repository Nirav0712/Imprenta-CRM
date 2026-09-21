'use client';

import React, { useEffect, useState } from 'react';
import {
  Compass,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Users,
  CheckCircle2,
  PieChart,
} from 'lucide-react';
import { crmApi, extractErrorMessage } from '../../../lib/api';

export default function CrmLeadSourcesPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSources = async () => {
    setLoading(true);
    try {
      const data = await crmApi.getLeadSources();
      setSources(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const totalLeads = sources.reduce((sum, s) => sum + s.count, 0);
  const totalValue = sources.reduce((sum, s) => sum + s.totalValue, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Lead Sources & Attribution
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              Channel ROI
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Analyze which inbound channels and outbound campaigns drive the highest value closed-won deals.
          </p>
        </div>

        <button
          onClick={loadSources}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Attributed Leads</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{totalLeads}</div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Generated Pipeline</div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
            ${totalValue.toLocaleString()}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Channels</div>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">{sources.length}</div>
        </div>
      </div>

      {/* Attribution Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading channel attribution...</div>
        ) : sources.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No source data available. Assign sources to leads to populate analytics.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Channel / Lead Source</th>
                  <th className="py-3.5 px-4">Leads Count</th>
                  <th className="py-3.5 px-4">Pipeline Valuation</th>
                  <th className="py-3.5 px-4">Closed Won Deals</th>
                  <th className="py-3.5 px-4 text-right">Win Conversion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sources.map((src) => (
                  <tr key={src.source} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white capitalize">
                      {src.source}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                      {src.count}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                      ${src.totalValue.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {src.wonCount}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {src.conversionRate}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
