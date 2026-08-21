export type DepositAddressRequest = { externalReference: string; network: string; asset: string };
export type DepositAddressResponse = { id: string; address: string };
export type SweepRequest = { externalReference: string; network: string; asset: string; tokenAddress: string; amountBaseUnits: string; sourceAddress: string; destination: string };
export type SweepResponse = { id: string; status: "SUBMITTED" | "CONFIRMED"; txHash?: string };

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for custody operations`);
  return value;
}

function assertHttps(url: string): void {
  if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) throw new Error("Custody provider URL must use HTTPS in production");
}

export interface CustodyProvider {
  readonly name: string;
  createDepositAddress(request: DepositAddressRequest): Promise<DepositAddressResponse>;
  submitSweep(request: SweepRequest): Promise<SweepResponse>;
  getSweep(id: string): Promise<SweepResponse>;
}

export class HttpCustodyProvider implements CustodyProvider {
  readonly name = process.env.CUSTODY_PROVIDER_NAME || "configured-mpc-provider";
  private readonly baseUrl = required("CUSTODY_PROVIDER_BASE_URL");
  private readonly apiKey = required("CUSTODY_PROVIDER_API_KEY");

  constructor() { assertHttps(this.baseUrl); }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}`, ...(init.headers || {}) },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Custody provider ${response.status}: ${await response.text()}`);
    return await response.json() as T;
  }

  createDepositAddress(request: DepositAddressRequest) {
    return this.request<DepositAddressResponse>("/v1/deposit-addresses", { method: "POST", body: JSON.stringify(request) });
  }

  submitSweep(request: SweepRequest) {
    return this.request<SweepResponse>("/v1/sweeps", { method: "POST", body: JSON.stringify(request) });
  }

  getSweep(id: string) { return this.request<SweepResponse>(`/v1/sweeps/${encodeURIComponent(id)}`, { method: "GET" }); }
}

export function custodyProvider(): CustodyProvider {
  if (process.env.CUSTODY_PROVIDER_ENABLED !== "true") throw new Error("Custody provider is disabled; set CUSTODY_PROVIDER_ENABLED=true only after provider review");
  return new HttpCustodyProvider();
}
