import { environment } from '../environments/environment';

type RuntimeConfig = Pick<typeof environment, 'cptApiUrl' | 'icdApiUrl' | 'aiApiUrl' | 'patientsApiUrl' | 'portfolioUrl'>;

/**
 * Fetches assets/config.json (envsubst'd from the container's ALLOWED_ORIGINS-style
 * env vars at nginx startup — see docker/entrypoint.sh) and overlays it onto the
 * environment.ts fallback values. Must resolve before the app bootstraps so every
 * service's `baseUrl = environment.xApiUrl` field initializer reads the real value.
 */
export async function loadRuntimeConfig(): Promise<void> {
  try {
    const res = await fetch('assets/config.json', { cache: 'no-store' });
    if (!res.ok) return;
    Object.assign(environment, await res.json() as Partial<RuntimeConfig>);
  } catch {
    // assets/config.json missing or invalid — keep the environment.ts fallback values.
  }
}
