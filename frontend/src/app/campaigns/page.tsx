'use client';

import React, { useState } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { useCampaigns, useLaunchCampaign } from '../../features/campaigns/hooks';
import { CampaignModal } from '../../features/campaigns/CampaignModal';
import { useAuth } from '../../features/auth/hooks';
import { can } from '../../lib/permissions';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { ErrorState } from '../../components/feedback/ErrorState';
import { EmptyState } from '../../components/feedback/EmptyState';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { formatDate } from '../../lib/utils';
import {
  Send,
  Plus,
  Rocket,
  Calendar,
  Award,
  Users,
  CheckCircle2,
} from 'lucide-react';

export default function CampaignsPage() {
  const { user } = useAuth();
  const canLaunch = can(user, 'launchCampaigns');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [launchError, setLaunchError] = useState('');

  const campaignsQuery = useCampaigns();
  const launchMutation = useLaunchCampaign();

  const handleLaunch = async (campaignId: string) => {
    setLaunchError('');
    try {
      await launchMutation.mutateAsync(campaignId);
    } catch (err: any) {
      setLaunchError(err.message || 'Failed to launch campaign');
    }
  };

  const campaigns = campaignsQuery.data || [];

  return (
    <AppShell requiredAction="manageCampaigns">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Training Campaigns
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Create, configure audience targeting, and launch employee compliance initiatives.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsModalOpen(true)}
            className="min-h-[44px]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </div>

        {launchError && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium"
          >
            {launchError}
          </div>
        )}

        {/* Data View */}
        {campaignsQuery.isLoading ? (
          <LoadingSkeleton rows={5} />
        ) : campaignsQuery.isError ? (
          <ErrorState
            title="Failed to load campaigns"
            message="Could not retrieve the campaign list from the server."
            onRetry={() => campaignsQuery.refetch()}
          />
        ) : campaigns.length === 0 ? (
          <EmptyState
            title="No campaigns yet"
            description="Create your first training campaign to distribute published courses to your workforce."
            icon={<Send className="w-8 h-8 text-slate-400" />}
            action={{
              label: 'Create First Campaign',
              onClick: () => setIsModalOpen(true),
            }}
          />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-4">Campaign Name & Course</th>
                    <th className="p-4">Target Audience</th>
                    <th className="p-4">Pass Mark</th>
                    <th className="p-4">Deadline</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-slate-900">{camp.name}</p>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          {camp.course?.title || 'Unknown course'}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className="font-medium text-slate-700">
                          {camp.audienceType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-800">
                        {camp.passMark}%
                      </td>
                      <td className="p-4 text-slate-600">
                        {formatDate(camp.deadline)}
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={
                            camp.status === 'ACTIVE'
                              ? 'success'
                              : camp.status === 'COMPLETED'
                              ? 'neutral'
                              : 'warning'
                          }
                        >
                          {camp.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        {camp.status === 'DRAFT' && canLaunch && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleLaunch(camp.id)}
                            isLoading={launchMutation.isPending}
                            className="min-h-[44px]"
                          >
                            <Rocket className="w-3.5 h-3.5 mr-1.5" />
                            Launch
                          </Button>
                        )}
                        {camp.status === 'ACTIVE' && (
                          <span className="text-[11px] font-semibold text-emerald-700">
                            Active & Assigned
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Campaign Creation Modal */}
        <CampaignModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    </AppShell>
  );
}
