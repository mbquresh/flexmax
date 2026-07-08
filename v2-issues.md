# v2 Hardening Checklist

Deferred medium-tier items from the v1 security/architecture audit. None are launch-blocking for a small beta, but all should be addressed before broader rollout.

## Security / cost
- [ ] **Rate limiting on AI edge functions** — onboarding-chat, extract-psychology-profile, generate-schedule-tips, missed-block-recovery have no per-user rate limits or input size caps. Financial DoS surface: abuse could run up Anthropic API costs. Priority: high (do before public launch).
- [ ] **Stack-trace / service-role audit** — one edge function returns stack traces to clients (info leak). Two functions use service-role clients where user-scoped would be safer. Audit all edge functions: generic error messages to clients, log full errors server-side only, use user-scoped clients unless service role is genuinely required.

## Data integrity
- [ ] **CHECK constraints on status columns** — `status` and `completion_rating` on daily_schedule_instances (and adhoc_tasks) are unconstrained text. Add CHECK constraints to reject invalid values at the DB level.

## Client robustness
- [ ] **Stale-request guard on loadToday** — overlapping loads can race; a slower earlier request can land after a newer one with stale data. Add a request-id / abort guard so only the latest load applies.
