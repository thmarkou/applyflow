import { freelancerConfigured } from '../freelancer/client.js';
import { loadFreelancerScan } from '../freelancer/search.js';
import { mockJobs } from '../jobs/mockJobs.js';
import { buildRecommendation } from '../jobs/recommend.js';
import type { Recommendation } from '../jobs/recommend.js';
import { sentJobIds } from '../pipeline/store.js';

export type DeskSource = 'mock' | 'freelancer';

export type DeskSnapshot = Recommendation & {
  source: DeskSource;
  scannedAt: string;
  error?: string;
};

export type WatchPayload = {
  verdict: Recommendation['verdict'];
  jobId: string | null;
  title: string | null;
  scannedAt: string | null;
};

const SCAN_MS = Number(process.env.DESK_SCAN_MS ?? 5 * 60 * 1000);

let cache: DeskSnapshot | null = null;
let inflight: Promise<DeskSnapshot> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const alertedJobIds = new Set<string>();

export function getCachedDesk(): DeskSnapshot | null {
  return cache;
}

export function getWatchPayload(): WatchPayload {
  return {
    verdict: cache?.verdict ?? 'NO_BID',
    jobId: cache?.job?.id ?? null,
    title: cache?.job?.title ?? null,
    scannedAt: cache?.scannedAt ?? null,
  };
}

async function buildLiveSnapshot(): Promise<DeskSnapshot> {
  if (!freelancerConfigured()) {
    const alreadySent = await sentJobIds();
    const openJobs = mockJobs.filter(job => !alreadySent.has(job.id));
    return {
      source: 'mock',
      scannedAt: new Date().toISOString(),
      ...buildRecommendation(openJobs, mockJobs.length),
    };
  }

  const scan = await loadFreelancerScan();
  const alreadySent = await sentJobIds();
  const openJobs = scan.jobs.filter(job => !alreadySent.has(job.id));
  return {
    source: 'freelancer',
    scannedAt: new Date().toISOString(),
    ...buildRecommendation(openJobs, scan.scanned),
  };
}

function noteNewBid(snapshot: DeskSnapshot): void {
  const jobId = snapshot.job?.id;
  if (snapshot.verdict !== 'BID' || jobId == null) {
    return;
  }
  if (alertedJobIds.has(jobId)) {
    return;
  }
  alertedJobIds.add(jobId);
  console.log(`ApplyFlow desk: BID — ${snapshot.job?.title ?? jobId}`);
}

export async function refreshDesk(): Promise<DeskSnapshot> {
  if (inflight != null) {
    return inflight;
  }
  inflight = (async () => {
    try {
      cache = await buildLiveSnapshot();
      noteNewBid(cache);
      return cache;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Desk scan failed';
      if (cache != null) {
        return cache;
      }
      const fallback: DeskSnapshot = {
        source: 'mock',
        scannedAt: new Date().toISOString(),
        error: message,
        ...buildRecommendation(mockJobs),
      };
      cache = fallback;
      return fallback;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function startDeskWatcher(): void {
  if (timer != null) {
    return;
  }
  void refreshDesk();
  timer = setInterval(() => {
    void refreshDesk();
  }, SCAN_MS);
  console.log(`ApplyFlow desk watcher every ${Math.round(SCAN_MS / 60000)} min`);
}
