import { mockJobs } from '../data/mockJobs';
import type { Job, JobsResponse } from '../types/job';

// Empty until the Mac server is reachable from the phone (LAN IP).
const API_BASE_URL = '';

export async function loadJobs(): Promise<JobsResponse> {
  if (!API_BASE_URL) {
    return { source: 'mock', jobs: mockJobs };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/jobs`);
    if (!response.ok) {
      return { source: 'mock', jobs: mockJobs };
    }
    const payload = (await response.json()) as JobsResponse;
    if (!Array.isArray(payload.jobs)) {
      return { source: 'mock', jobs: mockJobs };
    }
    return payload;
  } catch {
    return { source: 'mock', jobs: mockJobs };
  }
}

export function sortJobs(jobs: Job[]): Job[] {
  return [...jobs].sort((left, right) => {
    const leftScore = left.fitScore + left.qualityScore;
    const rightScore = right.fitScore + right.qualityScore;
    return rightScore - leftScore;
  });
}
