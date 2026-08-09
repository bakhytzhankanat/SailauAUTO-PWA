# Web Push

## Architecture

`notificationEventService` is the single source of truth for business push events: recipients, Kazakh payloads, internal destination, tag/event key, urgency, relevance and preference category. `pushService` is only the Web Push transport and subscription lifecycle adapter.

Business endpoints queue event delivery only after their transaction succeeds. Delivery errors, absent VAPID configuration, a missing subscription, an expired subscription, or a not-yet-applied push migration cannot roll back a booking, inventory movement, payment, or day close. A 404/410 from a provider deactivates only that device subscription; transient errors leave it active.

## Event matrix

| Event | Recipients | Destination |
| --- | --- | --- |
| `BOOKING_CREATED` | owner, manager, workers (including senior) | `/booking/:id` |
| `BOOKING_UPCOMING` | manager, assigned workers, senior; all workers only if no assignment exists | `/booking/:id` |
| `WORK_STARTED` | manager, assigned workers, senior | `/booking/:id` |
| `WORK_COMPLETED` | owner, manager | `/booking/:id` |
| `PAYMENT_RECEIVED` | owner, manager | `/booking/:id` |
| `INVENTORY_LOW` | owner, manager, senior worker | `/inventory` |
| `DAY_CLOSE_REMINDER` | owner, senior worker | `/day-close` |
| `DAY_CLOSED` | owner | `/day-close?date=…&shift_index=…` |

All destinations are internal relative routes. The Service Worker rejects external and protocol-relative routes, focuses an existing Sailau Auto client first, then navigates it; otherwise it opens one app window.

## Subscription lifecycle and preferences

Subscriptions are device-specific in `push_subscription` and are always scoped by authenticated `service_id` and `user_id`; frontend input never supplies either. Disabling notifications affects only the current browser endpoint. A user can opt out server-side from the categories they can actually receive: bookings, work, payments, inventory, or day close.

## Idempotency and observability

`push_notification_event` has `UNIQUE(service_id, event_key)`. This prevents duplicate sends from retries, duplicate handlers, refreshes, completion edits and repeated scheduler invocations. Inventory event keys use the persisted inventory movement ID, so a later restock followed by a new threshold crossing is allowed. The event row stores safe aggregate delivery counters; structured logs contain counts and no subscription secrets or endpoints.

## Configuration and migrations

Backend-only environment variables:

```text
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

Generate a new pair locally from the backend root with `npm run vapid:generate`. Keep the private key out of Git and frontend environment variables. `VAPID_SUBJECT` must be either `mailto:<real technical contact>` or an `https://` URL.

Run `npm run migrate` from the backend root before serving this code. The additive migrations are:

- `045_push_subscriptions.sql` — device subscriptions.
- `046_push_notification_events.sql` — idempotent event ledger and user preferences.
- `047_push_scheduler_settings.sql` — service defaults: Kazakhstan business timezone, 30-minute booking reminder, and enabled 21:30 day-close reminder.

## iPhone and Android

Permission is requested only after the user presses `Хабарландыруларды қосу`. On iPhone, Web Push requires the installed Home Screen PWA where the platform requires it; the UI gives that instruction. Android Chromium browsers can subscribe when they support Push API; installation is encouraged but not mechanically required.

## Scheduler readiness

No in-process timer, queue, or cron is started by the web server. A reliable external scheduler can run this backend-root command:

```text
npm run push:reminders
```

It calls `processUpcomingBookingNotifications(now)` and `processDayCloseReminders(now)`. Both accept an explicit `now`, derive the local business date/time from the service setting (`Asia/Qyzylorda` by default), scope every query by service, and rely on event keys for repeat safety. Configure an external scheduler only after device UAT; use a cadence of one minute for booking reminders and at least once after the configured day-close reminder time.

## Troubleshooting

- `Хабарландырулар әзірге қолжетімсіз`: check all three VAPID variables and a valid `VAPID_SUBJECT` on the backend.
- A browser has no subscription: enable notifications from `Хабарландырулар` on that device.
- A device stopped receiving: resubscribe; 404/410 endpoints are safely deactivated.
- Push routes fail before migration: apply `045`–`047`; business operations remain independent.

## Rollback

Do not drop `push_subscription`, `push_notification_event`, or `push_notification_preference` during a code rollback. These additive tables are safe to retain. Revert the merged Web Push code according to the merge strategy (one squash commit, or every feature commit in reverse order).
