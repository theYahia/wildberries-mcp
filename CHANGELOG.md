# Changelog

## 1.0.0

First release that actually works against the production Wildberries API. Two
critical, server-breaking bugs fixed, plus hardening and 2× tool coverage.

### Fixed (critical)

- **Server now starts.** Tool registration passed raw JSON Schema to the MCP
  SDK's `server.tool()`, which `@modelcontextprotocol/sdk` ≥ 1.29 rejects
  (`expected a Zod schema or ToolAnnotations`) — the binary crashed on startup
  before connecting any transport. Tool schemas are now converted JSON Schema →
  Zod at registration (`src/schema.ts`), which also gives automatic input
  validation.
- **Requests now reach the API.** Every call was sent to a single base URL
  `https://seller.wildberries.ru` — the seller *web cabinet*, not an API host —
  so all 15 tools hit the wrong server. Calls are now routed per category to the
  correct hosts (`content-api`, `discounts-prices-api`, `marketplace-api`,
  `statistics-api`, `seller-analytics-api`, `common-api`, `feedbacks-api`,
  `returns-api`, `advert-api`).
- **`get_abc_analysis`** read `response.data`, but `reportDetailByPeriod`
  returns a top-level array — ABC was always empty against the real API. Now
  tolerates both shapes.
- **`get_statistics` / `get_abc_analysis`** moved off the deprecated v1
  `reportDetailByPeriod` to v5.

### Added

- **15 new tools:** `get_incomes`, `get_fbw_stocks`, `add_orders_to_supply`,
  `deliver_supply`, `get_supply_barcode`, `get_funnel`, `get_paid_storage`
  (async report), `get_commission`, `get_tariffs`, `get_questions`,
  `reply_question`, `get_returns`, `get_balance`, `list_campaigns`,
  `get_campaign_stats` (15 → 30 total).
- **Per-category rate limiting** (`RateLimiterPool`): one token bucket per host,
  with stricter per-endpoint buckets (paid-storage 1/min create+download, 1/5s
  status; prices ~10/6s). 409 penalties stay isolated to a category.
- **Per-request timeouts** via `AbortController` (`WB_TIMEOUT_MS`, default 30s).
- **Structured WB error messages** — parses `errorText`/`detail`/`requestId`
  from the body and includes the target host, so wrong-host / missing-scope
  failures are self-diagnosing.
- **Input validation** — schema constraints (enum, min/max, min/maxItems) are
  enforced by the SDK before handlers run.
- `createServer()` factory (`src/server.ts`) extracted for testability; new
  `tests/server.test.ts` exercises registration + a real `tools/list` /
  `tools/call` round-trip over an in-memory transport.

### Notes

- A few newer endpoints (`get_funnel`, `get_paid_storage` status strings,
  `reply_question` state, `list_campaigns`/`get_campaign_stats` bodies,
  `get_returns` query params) are implemented to the current public docs but
  marked `VERIFY` in source — confirm against your account with a live token.
- The token must have each used category's scope enabled (see README).

## 0.3.3 and earlier

Initial tool coverage (15 tools), rate limiter, stdio + HTTP transports.
(Did not start on `@modelcontextprotocol/sdk` ≥ 1.29 and routed to the wrong host.)
