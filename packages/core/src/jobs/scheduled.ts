/**
 * Runtime-agnostic scheduled-job registry (docs/EDGE_V2_HARDENING.md gap 6).
 * Jobs declare a name + cron schedule + run(); runners differ per platform:
 * Node can poll `runDue()` (or wire BullMQ repeatables), Workers dispatch
 * from a Cron Trigger `scheduled()` handler. No `setInterval` inside services.
 */

export interface ScheduledJob {
  /** Unique name, e.g. 'sessions.cleanup'. */
  name: string;
  /** 5-field cron expression (documentation + v2 Cron Trigger source). */
  schedule: string;
  run(): Promise<void>;
}

export class ScheduledJobs {
  private readonly jobs = new Map<string, ScheduledJob>();
  private readonly lastRun = new Map<string, number>();

  register(job: ScheduledJob): void {
    this.jobs.set(job.name, job);
  }

  list(): ScheduledJob[] {
    return [...this.jobs.values()];
  }

  get(name: string): ScheduledJob | undefined {
    return this.jobs.get(name);
  }

  async run(name: string): Promise<void> {
    const job = this.jobs.get(name);
    if (!job) throw new Error(`Unknown scheduled job "${name}"`);
    await job.run();
    this.lastRun.set(name, Date.now());
  }

  /**
   * Minimal dev runner: run every job whose `minIntervalMs` (coarse
   * approximation of its cron cadence) has elapsed. Platform runners with
   * real cron parsing replace this.
   */
  async runDue(minIntervalMs = 15 * 60 * 1000): Promise<string[]> {
    const ran: string[] = [];
    const now = Date.now();
    for (const job of this.jobs.values()) {
      const last = this.lastRun.get(job.name) ?? 0;
      if (now - last >= minIntervalMs) {
        await this.run(job.name);
        ran.push(job.name);
      }
    }
    return ran;
  }
}
