'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Kanban,
  Plus,
  RefreshCw,
  DollarSign,
  ChevronRight,
  ArrowRight,
  User,
  Building,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { crmApi, extractErrorMessage } from '../../../lib/api';

const STAGES = [
  { key: 'new', label: 'New Inquiries', color: 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30' },
  { key: 'contacted', label: 'Contacted', color: 'border-blue-300 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20' },
  { key: 'qualified', label: 'Qualified', color: 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20' },
  { key: 'proposal', label: 'Proposal Sent', color: 'border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20' },
  { key: 'won', label: 'Closed Won', color: 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20' },
  { key: 'lost', label: 'Closed Lost', color: 'border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20' },
];

export default function CrmPipelinePage() {
  const [pipelineData, setPipelineData] = useState<any>({
    stages: {
      new: { leads: [], totalValue: 0, count: 0 },
      contacted: { leads: [], totalValue: 0, count: 0 },
      qualified: { leads: [], totalValue: 0, count: 0 },
      proposal: { leads: [], totalValue: 0, count: 0 },
      won: { leads: [], totalValue: 0, count: 0 },
      lost: { leads: [], totalValue: 0, count: 0 },
    },
    totalPipelineValue: 0,
    totalDeals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);

  const loadPipeline = async () => {
    setLoading(true);
    try {
      const data = await crmApi.getPipelineSummary();
      setPipelineData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPipeline();
  }, []);

  const handleMoveStage = async (leadId: string, currentStage: string, nextStage: string) => {
    setMovingId(leadId);
    try {
      await crmApi.updateLead(leadId, { stage: nextStage });
      loadPipeline();
    } catch (err) {
      alert(`Failed to update stage: ${extractErrorMessage(err)}`);
    } finally {
      setMovingId(null);
    }
  };

  return (
    <div className="space-y-6 flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            CRM Deal Pipeline
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              Interactive Kanban
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Total Pipeline Valuation: <span className="font-bold text-emerald-600 dark:text-emerald-400">${(pipelineData.totalPipelineValue || 0).toLocaleString()}</span> across {pipelineData.totalDeals || 0} opportunities.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadPipeline}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link
            href="/crm/leads"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Deal
          </Link>
        </div>
      </div>

      {/* Kanban Board Horizontal Scroll View */}
      <div className="flex-1 overflow-x-auto min-h-0 pb-4">
        <div className="inline-flex gap-4 min-w-full h-full">
          {STAGES.map((st, idx) => {
            const stageInfo = pipelineData.stages?.[st.key] || { leads: [], totalValue: 0, count: 0 };
            const nextStageKey = STAGES[idx + 1]?.key;
            const prevStageKey = STAGES[idx - 1]?.key;

            return (
              <div
                key={st.key}
                className={`w-72 md:w-80 flex flex-col rounded-2xl border ${st.color} shadow-2xs flex-shrink-0`}
              >
                {/* Stage Header */}
                <div className="p-3.5 border-b border-slate-200/60 dark:border-slate-800 flex items-center justify-between bg-white/60 dark:bg-slate-900/60 rounded-t-2xl">
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                      {st.label}
                    </span>
                    <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {stageInfo.count}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ${(stageInfo.totalValue || 0).toLocaleString()}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                  {stageInfo.leads.length === 0 ? (
                    <div className="p-8 text-center text-[11px] text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      No deals in {st.label.toLowerCase()}
                    </div>
                  ) : (
                    stageInfo.leads.map((lead: any) => (
                      <div
                        key={lead._id}
                        className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-sm transition-all space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2">
                            {lead.title}
                          </h4>
                          <span className="text-xs font-bold text-slate-900 dark:text-white flex-shrink-0">
                            ${(lead.dealValue || 0).toLocaleString()}
                          </span>
                        </div>

                        {lead.contactId && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                            <div className="flex items-center gap-1.5 truncate">
                              <User className="w-3 h-3 text-slate-400" />
                              <span className="truncate">{lead.contactId.fullName}</span>
                            </div>
                            {lead.contactId.company && (
                              <div className="flex items-center gap-1.5 truncate">
                                <Building className="w-3 h-3 text-slate-400" />
                                <span className="truncate">{lead.contactId.company}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Score & Stage Stepper */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-slate-400">
                            Score: <span className="text-emerald-600">{lead.score || 50}</span>
                          </span>

                          <div className="flex items-center gap-1">
                            {prevStageKey && (
                              <button
                                onClick={() => handleMoveStage(lead._id, st.key, prevStageKey)}
                                disabled={movingId === lead._id}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                                title={`Move to ${prevStageKey}`}
                              >
                                ←
                              </button>
                            )}
                            {nextStageKey && (
                              <button
                                onClick={() => handleMoveStage(lead._id, st.key, nextStageKey)}
                                disabled={movingId === lead._id}
                                className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200 font-bold"
                                title={`Advance to ${nextStageKey}`}
                              >
                                Advance →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
