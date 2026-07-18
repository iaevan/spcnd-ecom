/* TODO:security-blocked — see docs/SECURITY_WORK.md item S3 */
// WebhookService (topic matching over the webhooks table, QueueAdapter-mediated
// delivery with the X-WC-Webhook-Signature header, 5-failure auto-disable,
// ping) is deferred to S3. Per docs/EDGE_V2_HARDENING.md gap 5, the S3
// implementation must enqueue deliveries via QueueAdapter — never fetch()
// inline in the topic handler.
export {};
