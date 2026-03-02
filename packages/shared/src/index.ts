export enum Role { OWNER = 'OWNER', STAFF = 'STAFF' }
export enum JobStatus { LEAD='LEAD', QUOTED='QUOTED', SCHEDULED='SCHEDULED', IN_PROGRESS='IN_PROGRESS', COMPLETED='COMPLETED', INVOICED='INVOICED', PAID='PAID', CANCELLED='CANCELLED' }
export enum QuoteStatus { DRAFT='DRAFT', SENT='SENT', ACCEPTED='ACCEPTED', DECLINED='DECLINED' }
export enum InvoiceStatus { DRAFT='DRAFT', SENT='SENT', OVERDUE='OVERDUE', PAID='PAID', VOID='VOID' }

export type Tokens = { accessToken: string; refreshToken: string };

let tokenStore: { getTokens:()=>Promise<Tokens|null>; setTokens:(tokens:Tokens|null)=>Promise<void> } | null = null;
export const configureTokenStore = (store: typeof tokenStore) => { tokenStore = store; };

type ClientOptions = { baseUrl: string };

export class ApiClient {
  constructor(private opts: ClientOptions) {}

  private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const tokens = tokenStore ? await tokenStore.getTokens() : null;
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...(init.headers || {}) };
    if (tokens?.accessToken) (headers as any).Authorization = `Bearer ${tokens.accessToken}`;

    const res = await fetch(`${this.opts.baseUrl}${path}`, { ...init, headers });
    if (res.status === 401 && retry && tokens?.refreshToken) {
      const refreshRes = await fetch(`${this.opts.baseUrl}/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: tokens.refreshToken })
      });
      if (refreshRes.ok) {
        const payload = await refreshRes.json();
        await tokenStore?.setTokens(payload.tokens);
        return this.request<T>(path, init, false);
      }
      await tokenStore?.setTokens(null);
    }
    if (!res.ok) throw await res.json();
    return res.json();
  }

  get<T>(path: string) { return this.request<T>(path); }
  post<T>(path: string, body?: unknown) { return this.request<T>(path, { method: 'POST', body: JSON.stringify(body || {}) }); }
  patch<T>(path: string, body: unknown) { return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }); }
  delete<T>(path: string) { return this.request<T>(path, { method: 'DELETE' }); }
}
