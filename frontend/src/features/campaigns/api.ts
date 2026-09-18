import { apiFetch } from '../../lib/api-client';
import { Campaign, CreateCampaignInput } from './types';

export async function listCampaigns(): Promise<Campaign[]> {
  return apiFetch<Campaign[]>('/campaigns');
}

export async function getCampaign(id: string): Promise<Campaign> {
  return apiFetch<Campaign>(`/campaigns/${id}`);
}

export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  return apiFetch<Campaign>('/campaigns', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function launchCampaign(id: string): Promise<{ campaign: Campaign; assignmentsCreated: number }> {
  return apiFetch(`/campaigns/${id}/launch`, {
    method: 'POST',
  });
}
