import cors from 'cors';
import express from 'express';
import './env.js';
import { checkFreelancerToken } from './freelancer/checkToken.js';
import { freelancerConfigured } from './freelancer/client.js';
import { loadFreelancerJobs } from './freelancer/search.js';
import { mockJobs } from './jobs/mockJobs.js';
import type { Job } from './jobs/types.js';
import { getCachedDesk, getWatchPayload, refreshDesk, startDeskWatcher } from './watch/desk.js';
import { listApplications, markSent, updateApplicationStatus } from './pipeline/store.js';
import type { ApplicationStatus } from './pipeline/types.js';
import { checkUpworkKey } from './upwork/checkKey.js';

function isJob(value: unknown): value is Job {
  if (typeof value !== 'object' || value == null) {
    return false;
  }
  const job = value as Partial<Job>;
  return typeof job.id === 'string' && typeof job.title === 'string';
}

const STATUSES = new Set<ApplicationStatus>(['sent', 'won', 'lost']);

const port = Number(process.env.PORT ?? 8787);
const hasUpworkKey = Boolean(
  process.env.UPWORK_CLIENT_ID && process.env.UPWORK_CLIENT_SECRET,
);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'applyflow-server' });
});

app.get('/status', (_req, res) => {
  const freelancer = freelancerConfigured();
  res.json({
    source: freelancer ? 'freelancer' : hasUpworkKey ? 'upwork-pending' : 'mock',
    freelancerConfigured: freelancer,
    upworkKeyConfigured: hasUpworkKey,
    message: freelancer
      ? 'Freelancer token is configured. /jobs searches live projects.'
      : 'Add FREELANCER_TOKEN to server/.env to load live Freelancer projects.',
  });
});

app.get('/jobs', async (_req, res) => {
  if (!freelancerConfigured()) {
    res.json({ source: 'mock', jobs: mockJobs });
    return;
  }

  try {
    const jobs = await loadFreelancerJobs();
    res.json({ source: 'freelancer', jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Freelancer search failed';
    const cause =
      error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
    res.status(502).json({
      source: 'mock',
      jobs: mockJobs,
      error: cause ? `${message}: ${cause}` : message,
    });
  }
});

app.get('/upwork/check', async (_req, res) => {
  const result = await checkUpworkKey();
  res.status(result.configured ? 200 : 400).json(result);
});

app.get('/freelancer/check', async (_req, res) => {
  const result = await checkFreelancerToken();
  res.status(result.verdict === 'active' ? 200 : 400).json(result);
});

app.get('/recommendation', async (req, res) => {
  const forceFresh = req.query.fresh === '1';
  try {
    const cached = getCachedDesk();
    const snapshot = !forceFresh && cached != null ? cached : await refreshDesk();
    res.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Recommendation failed';
    res.status(502).json({
      source: 'offline',
      verdict: 'NO_BID',
      reason: message,
      reviewed: 0,
      job: null,
      bidText: null,
      error: message,
    });
  }
});

app.get('/watch', (_req, res) => {
  res.json(getWatchPayload());
});

app.get('/applications', async (_req, res) => {
  res.json({ applications: await listApplications() });
});

app.post('/applications', async (req, res) => {
  const job = req.body?.job;
  const bidText = typeof req.body?.bidText === 'string' ? req.body.bidText : '';
  if (!isJob(job)) {
    res.status(400).json({ error: 'job is required' });
    return;
  }
  const application = await markSent(job, bidText);
  res.status(201).json({ application });
});

app.patch('/applications/:id', async (req, res) => {
  const status = req.body?.status;
  if (typeof status !== 'string' || !STATUSES.has(status as ApplicationStatus)) {
    res.status(400).json({ error: 'status must be sent, won, or lost' });
    return;
  }
  const id = String(req.params.id ?? '');
  const application = await updateApplicationStatus(id, status as ApplicationStatus);
  if (!application) {
    res.status(404).json({ error: 'application not found' });
    return;
  }
  res.json({ application });
});

app.listen(port, '0.0.0.0', () => {
  startDeskWatcher();
  console.log(`ApplyFlow server on http://0.0.0.0:${port}`);
});
