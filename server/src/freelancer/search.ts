import type { Job, JobLane } from '../jobs/types.js';
import { searchActiveProjects } from './client.js';
import { mapFreelancerJob } from './mapJob.js';

const SEARCHES: Array<{ jobIds: number[]; lane: JobLane }> = [
  { jobIds: [1314], lane: 'react-native' },
  { jobIds: [690, 1654], lane: 'legacy-dotnet' },
  { jobIds: [695], lane: 'legacy-dotnet' },
  { jobIds: [700], lane: 'legacy-dotnet' },
  { jobIds: [116], lane: 'advisory' },
];

export type FreelancerScan = {
  jobs: Job[];
  scanned: number;
};

async function searchLane(search: {
  jobIds: number[];
  lane: JobLane;
}): Promise<{ jobs: Job[]; scanned: number }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await searchActiveProjects(search.jobIds);
      if (response.status && response.status !== 'success') {
        throw new Error(response.message ?? `Freelancer search failed for ${search.lane}`);
      }
      const projects = response.result?.projects ?? [];
      const users = response.result?.users ?? {};
      const jobs = projects
        .map(project => {
          const owner =
            project.owner_id != null ? users[String(project.owner_id)] : undefined;
          return mapFreelancerJob(project, search.lane, owner);
        })
        .filter((job): job is Job => job != null);
      return { jobs, scanned: projects.length };
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Freelancer search failed');
}

export async function loadFreelancerScan(): Promise<FreelancerScan> {
  const batches: FreelancerScan[] = [];
  for (const search of SEARCHES) {
    batches.push(await searchLane(search));
  }

  const byId = new Map<string, Job>();
  for (const batch of batches) {
    for (const job of batch.jobs) {
      const existing = byId.get(job.id);
      if (
        !existing ||
        existing.fitScore + existing.qualityScore < job.fitScore + job.qualityScore
      ) {
        byId.set(job.id, job);
      }
    }
  }

  return {
    scanned: batches.reduce((total, batch) => total + batch.scanned, 0),
    jobs: [...byId.values()].sort(
      (left, right) => right.fitScore + right.qualityScore - (left.fitScore + left.qualityScore),
    ),
  };
}

export async function loadFreelancerJobs(): Promise<Job[]> {
  return (await loadFreelancerScan()).jobs;
}
