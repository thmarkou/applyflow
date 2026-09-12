import '../env.js';
import type { FreelancerSearchResponse } from './types.js';

const PRODUCTION_API = 'https://www.freelancer.com/api';

export function freelancerToken(): string {
  return process.env.FREELANCER_TOKEN?.trim() ?? '';
}

export function freelancerConfigured(): boolean {
  return freelancerToken().length > 0;
}

export async function freelancerGet(
  path: string,
  params: Record<string, string | number | boolean | Array<string | number>> = {},
): Promise<{ httpStatus: number; payload: unknown }> {
  const token = freelancerToken();
  const url = new URL(`${PRODUCTION_API}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      'freelancer-oauth-v1': token,
      'user-agent': 'ApplyFlow/0.1',
    },
  });

  const text = await response.text();
  let payload: unknown = { message: text.slice(0, 180) };
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    // Keep the truncated text payload.
  }

  return { httpStatus: response.status, payload };
}

export async function searchActiveProjects(
  jobIds: number[],
  limit = 20,
): Promise<FreelancerSearchResponse> {
  const { payload } = await freelancerGet('/projects/0.1/projects/active/', {
    limit,
    offset: 0,
    'jobs[]': jobIds,
    full_description: true,
    job_details: true,
    user_details: true,
    sort_field: 'time_updated',
  });
  return payload as FreelancerSearchResponse;
}
