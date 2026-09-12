import type { Job } from '../jobs/types.js';

export type ApplicationStatus = 'sent' | 'won' | 'lost';

export type Application = {
  id: string;
  status: ApplicationStatus;
  sentAt: string;
  updatedAt: string;
  bidText: string;
  job: Job;
};
