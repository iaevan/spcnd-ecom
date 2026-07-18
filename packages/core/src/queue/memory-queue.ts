import type { QueueAdapter, QueueJob } from '../services/interfaces.js';

interface PendingJob extends QueueJob {
  availableAt: number;
}

/**
 * In-process queue for dev/tests and small Node deployments. No timers of its
 * own — drain with `runPending()` from a request hook, a ScheduledJobs entry
 * or a test (docs/EDGE_V2_HARDENING.md gap 6: runners are pluggable, jobs are
 * runtime-agnostic).
 */
export class MemoryQueueAdapter implements QueueAdapter {
  private jobs: PendingJob[] = [];
  private handlers = new Map<string, (job: QueueJob) => Promise<void>>();
  private seq = 0;
  /** Attempts after which a failing job is dropped. */
  maxAttempts = 3;

  async enqueue(
    queue: string,
    payload: Record<string, unknown>,
    delaySeconds = 0,
  ): Promise<void> {
    this.jobs.push({
      id: ++this.seq,
      queue,
      payload,
      attempts: 0,
      availableAt: Date.now() + delaySeconds * 1000,
    });
  }

  process(queue: string, handler: (job: QueueJob) => Promise<void>): void {
    this.handlers.set(queue, handler);
  }

  /** Run every due job once; failing jobs are re-queued up to maxAttempts. */
  async runPending(): Promise<number> {
    const now = Date.now();
    const due = this.jobs.filter((j) => j.availableAt <= now && this.handlers.has(j.queue));
    this.jobs = this.jobs.filter((j) => !due.includes(j));
    let ran = 0;
    for (const job of due) {
      const handler = this.handlers.get(job.queue);
      if (!handler) continue;
      try {
        await handler(job);
        ran++;
      } catch {
        job.attempts += 1;
        if (job.attempts < this.maxAttempts) {
          job.availableAt = Date.now() + 2 ** job.attempts * 1000;
          this.jobs.push(job);
        }
      }
    }
    return ran;
  }

  pendingCount(queue?: string): number {
    return queue ? this.jobs.filter((j) => j.queue === queue).length : this.jobs.length;
  }
}
