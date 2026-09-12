import type { Job, JobLane } from '../jobs/types.js';
import type { FreelancerProject, FreelancerUser } from './types.js';

const SKIP_TERMS = [
  'unpaid',
  'equity only',
  'need it yesterday',
  'logo design cheap',
];

function textBlob(project: FreelancerProject): string {
  return `${project.title ?? ''} ${project.preview_description ?? ''} ${project.description ?? ''}`.toLowerCase();
}

function budgetLabel(project: FreelancerProject): string {
  const min = project.budget?.minimum;
  const max = project.budget?.maximum;
  const kind = project.type === 'hourly' ? '/hr' : ' fixed';
  if (min != null && max != null && min !== max) {
    return `$${min}–$${max}${kind}`;
  }
  if (min != null) {
    return `$${min}+${kind}`;
  }
  if (max != null) {
    return `up to $${max}${kind}`;
  }
  return 'Budget n/a';
}

function listingUrl(project: FreelancerProject): string {
  if (project.seo_url) {
    return `https://www.freelancer.com/projects/${project.seo_url}`;
  }
  return `https://www.freelancer.com/projects/${project.id}`;
}

function fitScore(lane: JobLane, blob: string): number {
  const laneTerms: Record<JobLane, string[]> = {
    'react-native': ['react native', 'ios', 'android', 'mobile app', 'xcode'],
    'legacy-dotnet': [
      'vb.net',
      'asp.net',
      'sql server',
      'webforms',
      'etl',
      'c#',
      '.net',
    ],
    advisory: ['technical lead', 'it manager', 'fractional cto', 'solution architect'],
  };
  const hits = laneTerms[lane].filter(term => blob.includes(term)).length;
  return Math.min(96, 58 + hits * 10);
}

function qualityScore(
  project: FreelancerProject,
  owner: FreelancerUser | undefined,
): number {
  let score = 50;
  if (owner?.status?.payment_verified) {
    score += 20;
  }
  const reviews = owner?.employer_reputation?.entire_history?.reviews ?? 0;
  if (reviews >= 5) {
    score += 12;
  } else if (reviews >= 1) {
    score += 6;
  }
  const rating = owner?.employer_reputation?.entire_history?.overall ?? 0;
  if (rating >= 4.5) {
    score += 10;
  }
  const bids = project.bid_stats?.bid_count ?? 0;
  if (bids > 40) {
    score -= 25;
  } else if (bids > 20) {
    score -= 12;
  } else if (bids <= 8) {
    score += 8;
  }
  const country = owner?.location?.country?.code ?? '';
  if (country === 'IN' || country === 'PK' || country === 'BD') {
    score -= 12;
  }
  return Math.max(8, Math.min(96, score));
}

export function shouldSkipProject(project: FreelancerProject): boolean {
  if (project.type === 'contest') {
    return true;
  }
  const blob = textBlob(project);
  if (SKIP_TERMS.some(term => blob.includes(term))) {
    return true;
  }
  const max = project.budget?.maximum ?? project.budget?.minimum ?? 0;
  const min = project.budget?.minimum ?? 0;
  if (project.type === 'hourly' && min > 0 && min < 40) {
    return true;
  }
  if (project.type !== 'hourly' && max > 0 && max < 400) {
    return true;
  }
  const bids = project.bid_stats?.bid_count ?? 0;
  if (bids > 20) {
    return true;
  }
  return false;
}

export function mapFreelancerJob(
  project: FreelancerProject,
  lane: JobLane,
  owner: FreelancerUser | undefined,
): Job | null {
  if (shouldSkipProject(project)) {
    return null;
  }

  const blob = textBlob(project);
  const score = fitScore(lane, blob);
  if (score < 68) {
    return null;
  }
  const description =
    project.description?.trim() ||
    project.preview_description?.trim() ||
    'No description returned.';

  return {
    id: `fl-${project.id}`,
    title: project.title?.trim() || `Freelancer project ${project.id}`,
    description,
    lane,
    budgetLabel: budgetLabel(project),
    hourlyMin: project.type === 'hourly' ? (project.budget?.minimum ?? null) : null,
    client: {
      name:
        owner?.display_name?.trim() ||
        owner?.username?.trim() ||
        'Freelancer client',
      verifiedPayment: Boolean(owner?.status?.payment_verified),
      hires: owner?.employer_reputation?.entire_history?.reviews ?? 0,
      rating: owner?.employer_reputation?.entire_history?.overall ?? 0,
      countryCode: owner?.location?.country?.code ?? null,
    },
    proposals: project.bid_stats?.bid_count ?? 0,
    postedAt: project.time_submitted
      ? new Date(project.time_submitted * 1000).toISOString()
      : new Date().toISOString(),
    fitScore: score,
    qualityScore: qualityScore(project, owner),
    upworkUrl: listingUrl(project),
  };
}
