import type { EmailMessage, EmailTransport, Logger } from '@spacendigital/core';

/**
 * The four built-in transports (docs/AGENTS.md §8.4). SMTP is the only
 * Node-bound one; nodemailer is loaded lazily inside send() so edge bundles
 * that never construct SmtpTransport never touch it
 * (docs/EDGE_V2_HARDENING.md gap 2).
 */

/** Dev default: prints the message; keeps a buffer for tests. */
export class ConsoleTransport implements EmailTransport {
  readonly sent: EmailMessage[] = [];

  constructor(private readonly log?: Logger) {}

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    const line = `email → ${message.to} | ${message.subject}`;
    if (this.log) this.log.info(line);
    else console.log(`[spcnd-email] ${line}`);
  }
}

export interface SmtpConfig {
  url: string;
  from?: string;
}

export class SmtpTransport implements EmailTransport {
  constructor(private readonly config: SmtpConfig) {}

  async send(message: EmailMessage): Promise<void> {
    const { createTransport } = await import('nodemailer');
    const transporter = createTransport(this.config.url);
    await transporter.sendMail({
      from: message.from ?? this.config.from,
      to: message.to,
      cc: message.cc || undefined,
      bcc: message.bcc || undefined,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}

/** Fetch-based Resend transport (edge-portable). */
export class ResendTransport implements EmailTransport {
  constructor(
    private readonly apiKey: string,
    private readonly defaultFrom?: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: message.from ?? this.defaultFrom,
        to: [message.to],
        cc: message.cc ? [message.cc] : undefined,
        bcc: message.bcc ? [message.bcc] : undefined,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend send failed: ${response.status} ${await response.text()}`);
    }
  }
}

/** Fetch-based SendGrid transport (edge-portable). */
export class SendGridTransport implements EmailTransport {
  constructor(
    private readonly apiKey: string,
    private readonly defaultFrom?: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const personalization: Record<string, unknown> = { to: [{ email: message.to }] };
    if (message.cc) personalization.cc = [{ email: message.cc }];
    if (message.bcc) personalization.bcc = [{ email: message.bcc }];
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [personalization],
        from: { email: message.from ?? this.defaultFrom },
        subject: message.subject,
        content: [
          ...(message.text ? [{ type: 'text/plain', value: message.text }] : []),
          { type: 'text/html', value: message.html },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`SendGrid send failed: ${response.status} ${await response.text()}`);
    }
  }
}
