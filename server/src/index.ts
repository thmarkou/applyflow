import { existsSync } from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import { mockJobs } from './jobs/mockJobs.js';

const envPath = path.resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

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
  res.json({
    source: hasUpworkKey ? 'upwork-pending' : 'mock',
    keyConfigured: hasUpworkKey,
    message: hasUpworkKey
      ? 'Key is present. Live search stays off until the key is enabled and OAuth is done.'
      : 'Running on mock jobs until the Upwork key is enabled.',
  });
});

app.get('/jobs', (_req, res) => {
  res.json({
    source: 'mock',
    jobs: mockJobs,
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`ApplyFlow server on http://0.0.0.0:${port}`);
});
