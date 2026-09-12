import type { Job, JobLane, Recommendation } from './types/job';

const RISKY_COUNTRY = new Set(['IN', 'PK', 'BD', 'NG', 'KE']);

const LANE_OPENER: Record<JobLane, string> = {
  'react-native':
    'I ship production React Native apps on a real Xcode / iOS device workflow (not Expo-only), including business apps that sit on existing APIs.',
  'legacy-dotnet':
    'I have spent decades in Microsoft business systems: VB.NET, ASP.NET, C#, SQL Server, ETL and staged migrations from legacy stacks (including DB2/AS400 leftovers) to maintainable .NET.',
  advisory:
    'I work as a fractional technical lead: lock requirements, set architecture, and keep delivery honest. I do not sell generic “full stack” hours.',
};

function inflatedBudget(job: Job): boolean {
  if (job.hourlyMin != null && job.hourlyMin > 250) {
    return true;
  }
  const amounts = [...job.budgetLabel.matchAll(/\$(\d[\d,]*)/g)].map(match =>
    Number(match[1].replace(/,/g, '')),
  );
  if (amounts.length < 2) {
    return false;
  }
  const [min, max] = amounts;
  return max >= 10000 && max / Math.max(min, 1) >= 20;
}

function hasOwnerSignal(job: Job): boolean {
  return (
    job.client.verifiedPayment ||
    job.client.hires > 0 ||
    job.client.countryCode != null
  );
}

function isEligible(job: Job): string | null {
  if (job.fitScore < 78) {
    return `Fit ${job.fitScore} is below 78`;
  }
  if (job.proposals > 12) {
    return `${job.proposals} bids already — too late`;
  }
  if (inflatedBudget(job)) {
    return 'Budget range looks inflated for this marketplace';
  }
  if (!hasOwnerSignal(job)) {
    return null;
  }
  if (job.qualityScore < 60) {
    return `Client quality ${job.qualityScore} is below 60`;
  }
  if (!job.client.verifiedPayment && job.client.hires < 8) {
    return 'Unverified client with thin history';
  }
  const country = job.client.countryCode ?? '';
  if (
    RISKY_COUNTRY.has(country) &&
    !(job.client.verifiedPayment && job.client.hires >= 5 && job.proposals <= 10)
  ) {
    return `Client country ${country} without verified payment and reviews`;
  }
  return null;
}

export function draftBid(job: Job): string {
  return [
    'Hello,',
    '',
    `I can take this on. ${LANE_OPENER[job.lane]}`,
    '',
    'What I would do first: read the current system, write a short plan you can approve, then implement in slices so you see working software instead of a big-bang rewrite.',
    '',
    'Relevant background: 30+ years in IT, former IT Manager and current Group Technology Officer. I deliver custom iOS/Android and Microsoft business applications for real operations — not demo apps.',
    '',
    'If this is still open, I can start with a scoped first milestone. Happy to discuss timeline and a fixed or hourly structure that matches the brief.',
    '',
    'Theofanis Markou',
  ].join('\n');
}

export function buildRecommendation(jobs: Job[]): Recommendation {
  const ranked = [...jobs].sort(
    (left, right) => right.fitScore + right.qualityScore - (left.fitScore + left.qualityScore),
  );

  for (const job of ranked) {
    if (isEligible(job) == null) {
      return {
        verdict: 'BID',
        reason: `Best match in this scan: ${job.lane}, fit ${job.fitScore}, client ${job.qualityScore}, ${job.proposals} bids.`,
        reviewed: jobs.length,
        job,
        bidText: draftBid(job),
      };
    }
  }

  const top = ranked[0];
  const why = top
    ? `Best leftover was “${top.title}” — ${isEligible(top)}.`
    : 'No projects survived the search filters.';

  return {
    verdict: 'NO_BID',
    reason: `Reviewed ${jobs.length} listings. None meet the senior bar. ${why}`,
    reviewed: jobs.length,
    job: null,
    bidText: null,
  };
}
