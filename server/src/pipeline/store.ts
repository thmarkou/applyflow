import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Job } from '../jobs/types.js';
import type { Application, ApplicationStatus } from './types.js';

const dataDir = path.resolve(fileURLToPath(new URL('../../data', import.meta.url)));
const storePath = path.join(dataDir, 'applications.json');

async function readStore(): Promise<Application[]> {
  try {
    const raw = await readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as Application[];
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeStore(applications: Application[]): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(storePath, `${JSON.stringify(applications, null, 2)}\n`, 'utf8');
}

export async function listApplications(): Promise<Application[]> {
  const applications = await readStore();
  return [...applications].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function sentJobIds(): Promise<Set<string>> {
  const applications = await readStore();
  return new Set(applications.map(application => application.job.id));
}

export async function markSent(job: Job, bidText: string): Promise<Application> {
  const applications = await readStore();
  const existing = applications.find(application => application.job.id === job.id);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const created: Application = {
    id: job.id,
    status: 'sent',
    sentAt: now,
    updatedAt: now,
    bidText,
    job,
  };
  applications.push(created);
  await writeStore(applications);
  return created;
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
): Promise<Application | null> {
  const applications = await readStore();
  const index = applications.findIndex(application => application.id === id);
  if (index < 0) {
    return null;
  }
  const updated: Application = {
    ...applications[index],
    status,
    updatedAt: new Date().toISOString(),
  };
  applications[index] = updated;
  await writeStore(applications);
  return updated;
}
