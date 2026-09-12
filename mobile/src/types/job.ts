export type JobLane = 'react-native' | 'legacy-dotnet' | 'advisory';

export type JobClient = {
  name: string;
  verifiedPayment: boolean;
  hires: number;
  rating: number;
  countryCode: string | null;
};

export type Job = {
  id: string;
  title: string;
  description: string;
  lane: JobLane;
  budgetLabel: string;
  hourlyMin: number | null;
  client: JobClient;
  proposals: number;
  postedAt: string;
  fitScore: number;
  qualityScore: number;
  upworkUrl: string;
};

export type JobsResponse = {
  source: 'mock' | 'upwork' | 'freelancer' | 'offline';
  jobs: Job[];
};

export type RecommendationVerdict = 'BID' | 'NO_BID';

export type Recommendation = {
  verdict: RecommendationVerdict;
  reason: string;
  reviewed: number;
  job: Job | null;
  bidText: string | null;
};

export type RecommendationResponse = Recommendation & {
  source: 'mock' | 'upwork' | 'freelancer' | 'offline';
  scannedAt?: string;
  error?: string;
};

export type ApplicationStatus = 'sent' | 'won' | 'lost';

export type Application = {
  id: string;
  status: ApplicationStatus;
  sentAt: string;
  updatedAt: string;
  bidText: string;
  job: Job;
};
