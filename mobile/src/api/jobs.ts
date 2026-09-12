import type {
  Application,
  ApplicationStatus,
  Job,
  JobsResponse,
  RecommendationResponse,
} from '../types/job';

const SERVER_CANDIDATES = [
  'http://192.168.100.45:8787',
  'http://192.168.100.37:8787',
  'http://100.97.186.113:8787',
];

let workingBaseUrl: string | null = null;

function offlineRecommendation(error: string): RecommendationResponse {
  return {
    source: 'offline',
    verdict: 'NO_BID',
    reason: error,
    reviewed: 0,
    job: null,
    bidText: null,
    error,
  };
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function probeServer(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/health`, 2500);
    return response.ok;
  } catch {
    return false;
  }
}

async function resolveServerUrl(): Promise<string | null> {
  if (workingBaseUrl && (await probeServer(workingBaseUrl))) {
    return workingBaseUrl;
  }

  const ordered = workingBaseUrl
    ? [workingBaseUrl, ...SERVER_CANDIDATES.filter(url => url !== workingBaseUrl)]
    : SERVER_CANDIDATES;

  for (const baseUrl of ordered) {
    if (await probeServer(baseUrl)) {
      workingBaseUrl = baseUrl;
      return baseUrl;
    }
  }

  workingBaseUrl = null;
  return null;
}

export async function loadJobs(): Promise<JobsResponse> {
  const baseUrl = await resolveServerUrl();
  if (!baseUrl) {
    return { source: 'offline', jobs: [] };
  }

  const response = await fetchWithTimeout(`${baseUrl}/jobs`, 45000);
  if (!response.ok) {
    throw new Error(`Jobs request failed (${response.status})`);
  }
  const payload = (await response.json()) as JobsResponse;
  if (!Array.isArray(payload.jobs)) {
    throw new Error('Jobs response was not a list');
  }
  return payload;
}

export async function loadRecommendation(
  forceFresh = false,
): Promise<RecommendationResponse> {
  const baseUrl = await resolveServerUrl();
  if (!baseUrl) {
    return offlineRecommendation(
      'Cannot reach the Mac server. Keep `npm run dev` running in server/, stay on the same Wi-Fi, and allow local network access when iOS asks.',
    );
  }

  try {
    const path = forceFresh ? '/recommendation?fresh=1' : '/recommendation';
    const response = await fetchWithTimeout(`${baseUrl}${path}`, 45000);
    if (!response.ok) {
      return offlineRecommendation(`Server returned ${response.status} from ${baseUrl}`);
    }
    const payload = (await response.json()) as RecommendationResponse;
    if (payload.verdict !== 'BID' && payload.verdict !== 'NO_BID') {
      return offlineRecommendation('Server response was not a recommendation.');
    }
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Recommendation request failed';
    return offlineRecommendation(`${message} (${baseUrl})`);
  }
}

export async function loadApplications(): Promise<Application[]> {
  const baseUrl = await resolveServerUrl();
  if (!baseUrl) {
    return [];
  }
  const response = await fetchWithTimeout(`${baseUrl}/applications`, 8000);
  if (!response.ok) {
    throw new Error(`Applications request failed (${response.status})`);
  }
  const payload = (await response.json()) as { applications?: Application[] };
  return Array.isArray(payload.applications) ? payload.applications : [];
}

export async function markApplicationSent(
  job: Job,
  bidText: string,
): Promise<Application> {
  const baseUrl = await resolveServerUrl();
  if (!baseUrl) {
    throw new Error('Cannot reach the Mac server');
  }
  const response = await fetch(`${baseUrl}/applications`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ job, bidText }),
  });
  if (!response.ok) {
    throw new Error(`Could not mark sent (${response.status})`);
  }
  const payload = (await response.json()) as { application: Application };
  return payload.application;
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
): Promise<Application> {
  const baseUrl = await resolveServerUrl();
  if (!baseUrl) {
    throw new Error('Cannot reach the Mac server');
  }
  const response = await fetch(`${baseUrl}/applications/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error(`Could not update application (${response.status})`);
  }
  const payload = (await response.json()) as { application: Application };
  return payload.application;
}

export function sortJobs(jobs: Job[]): Job[] {
  return [...jobs].sort((left, right) => {
    const leftScore = left.fitScore + left.qualityScore;
    const rightScore = right.fitScore + right.qualityScore;
    return rightScore - leftScore;
  });
}
