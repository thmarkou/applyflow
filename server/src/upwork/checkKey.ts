import { existsSync } from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

type CheckResult = {
  configured: boolean;
  httpStatus: number | null;
  error: string | null;
  errorDescription: string | null;
  clientIdLength: number;
  clientSecretLength: number;
  authMethod: 'form' | 'basic' | null;
  verdict:
    | 'missing-env'
    | 'active'
    | 'disabled'
    | 'invalid-client'
    | 'enterprise-only'
    | 'unknown';
};

function classify(status: number, error: string, description: string): CheckResult['verdict'] {
  const blob = `${error} ${description}`.toLowerCase();
  if (blob.includes('disabled')) {
    return 'disabled';
  }
  if (blob.includes('invalid_client') || blob.includes('invalid client')) {
    return 'invalid-client';
  }
  if (blob.includes('enterprise')) {
    return 'enterprise-only';
  }
  if (status === 200 || blob.includes('invalid_grant') || blob.includes('invalid grant')) {
    return 'active';
  }
  return 'unknown';
}

export async function checkUpworkKey(): Promise<CheckResult> {
  const clientId = process.env.UPWORK_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.UPWORK_CLIENT_SECRET?.trim() ?? '';

  if (!clientId || !clientSecret) {
    return {
      configured: false,
      httpStatus: null,
      error: 'missing_credentials',
      errorDescription: 'UPWORK_CLIENT_ID or UPWORK_CLIENT_SECRET is empty.',
      clientIdLength: clientId.length,
      clientSecretLength: clientSecret.length,
      authMethod: null,
      verdict: 'missing-env',
    };
  }

  const redirectUri = process.env.UPWORK_REDIRECT_URI ?? '';
  const attempts: Array<{
    authMethod: 'form' | 'basic';
    headers: Record<string, string>;
    body: URLSearchParams;
  }> = [
    {
      authMethod: 'form',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: 'applyflow-key-probe',
        redirect_uri: redirectUri,
      }),
    },
    {
      authMethod: 'basic',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'applyflow-key-probe',
        redirect_uri: redirectUri,
      }),
    },
  ];

  let last: CheckResult | null = null;
  for (const attempt of attempts) {
    const response = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
      method: 'POST',
      headers: attempt.headers,
      body: attempt.body,
    });

    const text = await response.text();
    let payload: { error?: string; error_description?: string } = {};
    try {
      payload = JSON.parse(text) as { error?: string; error_description?: string };
    } catch {
      payload = { error: 'non_json', error_description: text.slice(0, 180) };
    }

    const error = payload.error ?? `http_${response.status}`;
    const errorDescription = payload.error_description ?? '';
    const verdict = classify(response.status, error, errorDescription);
    last = {
      configured: true,
      httpStatus: response.status,
      error,
      errorDescription,
      clientIdLength: clientId.length,
      clientSecretLength: clientSecret.length,
      authMethod: attempt.authMethod,
      verdict,
    };

    if (verdict === 'active') {
      return last;
    }
  }

  return last as CheckResult;
}

if (process.argv[1]?.includes('checkKey')) {
  const result = await checkUpworkKey();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.verdict === 'missing-env' || result.verdict === 'invalid-client' ? 1 : 0);
}
