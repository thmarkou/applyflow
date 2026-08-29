export type JobLane = 'react-native' | 'legacy-dotnet' | 'advisory';

export type Job = {
  id: string;
  title: string;
  description: string;
  lane: JobLane;
  budgetLabel: string;
  hourlyMin: number | null;
  client: {
    name: string;
    verifiedPayment: boolean;
    hires: number;
    rating: number;
  };
  proposals: number;
  postedAt: string;
  fitScore: number;
  qualityScore: number;
  upworkUrl: string;
};
