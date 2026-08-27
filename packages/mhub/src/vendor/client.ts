import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { filterAttrs } from './pii';

/**
 * @plaidware/mhub-sdk — events client (DESIGN §4.3).
 * Typed emit(), batching, bounded retry queue with optional local
 * persistence, PII pre-filter mirroring server rules.
 */

export interface MhubClientOptions {
  /** Tenant events key (mhk_…). */
  apiKey: string;
  /** e.g. https://marketing.plaidware.com/api/v1 */
  baseUrl: string;
  /** Auto-flush interval; 0 disables the timer (manual flush()). Default 5000. */
  flushIntervalMs?: number;
  /** Max events per batch request (server cap 500). Default 100. */
  maxBatch?: number;
  /** JSON file for queue persistence across restarts (optional). */
  persistPath?: string;
  /** attrs keys the tenant's pack allowlists beyond the baseline (e.g. ['technician']). */
  piiAllowlist?: string[];
  /** Called for delivery problems and locally-stripped PII keys. */
  onWarning?: (message: string, detail?: unknown) => void;
  fetchImpl?: typeof fetch;
}

export interface EmitInput {
  externalLeadId: string;
  occurredAt?: Date | string;
  idempotencyKey?: string;
  attrs?: Record<string, unknown>;
}

interface QueuedEvent {
  idempotency_key: string;
  stage_key: string;
  external_lead_id: string;
  occurred_at: string;
  attrs: Record<string, unknown>;
  attempts: number;
}

export interface FlushResult {
  sent: number;
  accepted: number;
  deduped: number;
  rejected: number; // permanent per-item errors (e.g. unknown_stage) — dropped with warning
  retained: number; // still queued (network/server failure)
}

const MAX_ATTEMPTS = 10;

export class MhubClient {
  private queue: QueuedEvent[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private flushing = false;
  private readonly opts: Required<Pick<MhubClientOptions, 'baseUrl' | 'apiKey' | 'flushIntervalMs' | 'maxBatch'>> &
    MhubClientOptions;

  constructor(options: MhubClientOptions) {
    this.opts = { flushIntervalMs: 5000, maxBatch: 100, ...options };
    if (this.opts.persistPath) this.loadPersisted();
    if (this.opts.flushIntervalMs > 0) {
      this.timer = setInterval(() => void this.flush().catch(() => {}), this.opts.flushIntervalMs);
      this.timer.unref?.();
    }
  }

  /** Queue an attribution event (fire-and-forget; delivery via flush cycle). */
  emit(stageKey: string, input: EmitInput): void {
    const { clean, stripped } = filterAttrs(input.attrs ?? {}, this.opts.piiAllowlist ?? []);
    if (stripped.length > 0) {
      this.opts.onWarning?.(`mhub-sdk: stripped PII attrs before send: ${stripped.join(', ')}`);
    }
    this.queue.push({
      idempotency_key: input.idempotencyKey ?? `sdk-${randomUUID()}`,
      stage_key: stageKey,
      external_lead_id: input.externalLeadId,
      occurred_at: new Date(input.occurredAt ?? Date.now()).toISOString(),
      attrs: clean,
      attempts: 0,
    });
    this.persist();
  }

  get pending(): number {
    return this.queue.length;
  }

  /** Send everything queued. Failed batches stay queued (bounded attempts). */
  async flush(): Promise<FlushResult> {
    if (this.flushing) return { sent: 0, accepted: 0, deduped: 0, rejected: 0, retained: this.queue.length };
    this.flushing = true;
    const result: FlushResult = { sent: 0, accepted: 0, deduped: 0, rejected: 0, retained: 0 };
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.slice(0, this.opts.maxBatch);
        let res: Response;
        try {
          res = await this.request('POST', '/events/batch', {
            events: batch.map(({ attempts: _a, ...event }) => event),
          });
        } catch (err) {
          this.retryLater(batch, `network error: ${err instanceof Error ? err.message : err}`);
          break;
        }
        if (!res.ok) {
          // 401/400 whole-batch problems are permanent for these payloads
          if (res.status === 401 || res.status === 400) {
            this.opts.onWarning?.(`mhub-sdk: batch rejected (${res.status}) — dropping ${batch.length} events`);
            this.queue.splice(0, batch.length);
            result.rejected += batch.length;
            continue;
          }
          this.retryLater(batch, `server ${res.status}`);
          break;
        }
        const body = (await res.json()) as {
          results: Array<{ status: string; error?: string }>;
        };
        this.queue.splice(0, batch.length);
        result.sent += batch.length;
        body.results.forEach((r, i) => {
          if (r.status === 'accepted') result.accepted++;
          else if (r.status === 'deduped') result.deduped++;
          else {
            result.rejected++;
            this.opts.onWarning?.(
              `mhub-sdk: event rejected (${r.error ?? 'unknown'})`,
              batch[i] && { idempotency_key: batch[i]!.idempotency_key, stage_key: batch[i]!.stage_key }
            );
          }
        });
      }
    } finally {
      this.flushing = false;
      this.persist();
    }
    result.retained = this.queue.length;
    return result;
  }

  async getFunnelStages(): Promise<Array<{ key: string; label: string; position: number }>> {
    const res = await this.request('GET', '/funnel-stages');
    if (!res.ok) throw new Error(`mhub-sdk: funnel-stages failed (${res.status})`);
    return (await res.json()) as Array<{ key: string; label: string; position: number }>;
  }

  async sendCapacitySnapshot(snapshotOn: string, data: Record<string, unknown>): Promise<void> {
    const res = await this.request('POST', '/capacity-snapshots', { snapshot_on: snapshotOn, data });
    if (!res.ok) throw new Error(`mhub-sdk: capacity snapshot failed (${res.status})`);
  }

  /** Flush once more and stop the timer (call on app shutdown). */
  async close(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush().catch(() => {});
  }

  private retryLater(batch: QueuedEvent[], reason: string): void {
    for (const event of batch) event.attempts++;
    const dropped = this.queue.filter((e) => e.attempts >= MAX_ATTEMPTS);
    if (dropped.length > 0) {
      this.queue = this.queue.filter((e) => e.attempts < MAX_ATTEMPTS);
      this.opts.onWarning?.(`mhub-sdk: dropped ${dropped.length} events after ${MAX_ATTEMPTS} attempts`);
    }
    this.opts.onWarning?.(`mhub-sdk: delivery failed (${reason}); ${this.queue.length} events retained`);
  }

  private request(method: string, pathname: string, body?: unknown): Promise<Response> {
    const doFetch = this.opts.fetchImpl ?? fetch;
    return doFetch(`${this.opts.baseUrl}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  private persist(): void {
    if (!this.opts.persistPath) return;
    try {
      const tmp = `${this.opts.persistPath}.tmp`;
      fs.mkdirSync(path.dirname(this.opts.persistPath), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(this.queue));
      fs.renameSync(tmp, this.opts.persistPath);
    } catch (err) {
      this.opts.onWarning?.('mhub-sdk: queue persistence failed', err);
    }
  }

  private loadPersisted(): void {
    try {
      if (fs.existsSync(this.opts.persistPath!)) {
        const raw = JSON.parse(fs.readFileSync(this.opts.persistPath!, 'utf8'));
        if (Array.isArray(raw)) this.queue = raw;
      }
    } catch (err) {
      this.opts.onWarning?.('mhub-sdk: failed to load persisted queue', err);
    }
  }
}
