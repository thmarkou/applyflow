export type JobLane = 'react-native' | 'legacy-dotnet' | 'advisory';

export type JobClient = {
  name: string;
  verifiedPayment: boolean;
  hires: number;
  rating: number;
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
  source: 'mock' | 'upwork';
  jobs: Job[];
};
