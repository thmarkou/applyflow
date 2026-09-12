import { freelancerConfigured, freelancerGet } from './client.js';

export type FreelancerCheck = {
  configured: boolean;
  httpStatus: number | null;
  verdict: 'missing-env' | 'active' | 'unauthorized' | 'unknown';
  message: string;
};

export async function checkFreelancerToken(): Promise<FreelancerCheck> {
  if (!freelancerConfigured()) {
    return {
      configured: false,
      httpStatus: null,
      verdict: 'missing-env',
      message: 'FREELANCER_TOKEN is empty. Generate a PAT and put it in server/.env.',
    };
  }

  const self = await freelancerGet('/users/0.1/self/');
  const selfPayload = self.payload as { status?: string; message?: string };

  if (self.httpStatus === 401 || self.httpStatus === 403) {
    return {
      configured: true,
      httpStatus: self.httpStatus,
      verdict: 'unauthorized',
      message: selfPayload.message ?? 'Token rejected. Generate a new production PAT.',
    };
  }

  if (self.httpStatus === 200 && selfPayload.status === 'success') {
    return {
      configured: true,
      httpStatus: self.httpStatus,
      verdict: 'active',
      message: 'Freelancer personal token is accepted.',
    };
  }

  const probe = await freelancerGet('/projects/0.1/projects/active/', {
    query: 'react',
    limit: 1,
  });
  const probePayload = probe.payload as { status?: string; message?: string };

  if (probe.httpStatus === 200 && probePayload.status === 'success') {
    return {
      configured: true,
      httpStatus: probe.httpStatus,
      verdict: 'active',
      message: 'Freelancer personal token is accepted.',
    };
  }

  if (probe.httpStatus === 401 || probe.httpStatus === 403) {
    return {
      configured: true,
      httpStatus: probe.httpStatus,
      verdict: 'unauthorized',
      message: probePayload.message ?? 'Token rejected. Generate a new production PAT.',
    };
  }

  return {
    configured: true,
    httpStatus: probe.httpStatus,
    verdict: 'unknown',
    message:
      probePayload.message ??
      selfPayload.message ??
      `Unexpected Freelancer response (${probe.httpStatus}).`,
  };
}

if (process.argv[1]?.includes('checkToken')) {
  const result = await checkFreelancerToken();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.verdict === 'active' ? 0 : 1);
}
