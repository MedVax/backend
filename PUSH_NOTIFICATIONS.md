# Push Notifications (Web Push / VAPID)

New orders raise a browser push notification on every admin device that has
opted in. Delivery uses the [Web Push protocol](https://web.dev/articles/push-notifications-overview)
with VAPID — no Firebase project, no third-party service, no per-message cost.

## How it flows

```
OrdersService.create()
  └─ emits ORDER_CREATED  ─┐
OrdersService.verifyPayment()
  └─ emits ORDER_PAID     ─┤
                           ▼
              OrderPushListener  (modules/notifications/listeners)
                           │  builds the title/body/deep link
                           ▼
                  WebPushService.sendToAdmins()
                           │  encrypts + signs with VAPID
                           ▼
        Push service (FCM / Mozilla / WNS)  →  admin's service worker
                                                 └─ shows the notification
                                                 └─ posts PUSH_RECEIVED to
                                                    any open admin tab
```

Events are emitted, never awaited: a push-service outage cannot fail a
checkout.

## Setup

1. Generate a key pair (once per environment — **do not reuse the dev pair in
   production**):

   ```bash
   npx web-push generate-vapid-keys
   ```

2. Set the environment variables:

   ```bash
   VAPID_PUBLIC_KEY=<publicKey>
   VAPID_PRIVATE_KEY=<privateKey>
   VAPID_SUBJECT=mailto:support@medvaxhealth.com   # a contact URL the push service can reach
   ADMIN_URL=https://admin.medvaxhealth.com
   ```

   With the keys absent the module still loads, `GET /notifications/push/public-key`
   reports `enabled: false`, and the admin UI explains that push is not
   configured. Nothing throws.

3. Run the migration that creates the `PushSubscription` table:

   ```bash
   npx prisma migrate deploy
   ```

**Rotating the keys invalidates every stored subscription.** Admins have to
re-enable notifications on each device, so rotate only when a private key
leaks.

## API

All routes require an authenticated `ADMIN` or `SUPER_ADMIN` user.

| Method   | Path                                   | Purpose                                        |
| -------- | -------------------------------------- | ---------------------------------------------- |
| `GET`    | `/notifications/push/public-key`       | VAPID public key + whether push is configured  |
| `GET`    | `/notifications/push/subscriptions`    | The caller's registered devices                |
| `GET`    | `/notifications/push/status?endpoint=` | Whether one browser endpoint is registered     |
| `POST`   | `/notifications/push/subscribe`        | Register a browser subscription                |
| `DELETE` | `/notifications/push/unsubscribe`      | Remove a subscription (body: `{ endpoint }`)   |
| `POST`   | `/notifications/push/test`             | Send a test push to the caller's own devices   |

Payload delivered to the service worker:

```jsonc
{
  "title": "New order received",
  "body": "Amina Bello - ₦42,500 (3 items)",
  "tag": "new-order:<orderId>",   // collapses repeat alerts for one order
  "url": "/orders/<orderId>",     // where a click lands
  "type": "ORDER_CREATED",
  "renotify": true,
  "requireInteraction": true,
  "data": { "orderId": "<orderId>" }
}
```

## Subscription hygiene

`WebPushService` prunes dead endpoints automatically:

- `404`/`410` from the push service — the browser dropped it: deleted at once.
- Any other failure increments `failureCount`; at `MAX_PUSH_FAILURES` (5) the
  row is deleted.
- A successful send resets `failureCount` and stamps `lastSuccessAt`.

Deleting a user cascades to their subscriptions.

## Sending a push from elsewhere

Import `WebPushService` (exported from `NotificationsModule`) and call
`sendToAdmins(payload)` or `sendToUser(userId, payload)`. Prefer emitting an
event and handling it in a listener, so the calling service stays unaware of
notification concerns.

## Troubleshooting

| Symptom                                   | Cause                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| Log says "web push is disabled"           | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` missing.                            |
| `403 VapidPkHashMismatch` from FCM        | Keys were rotated. Subscriptions must be recreated in the browser.           |
| Nothing arrives, no errors                | The admin never enabled alerts, or the browser is not running. Push is not queued indefinitely — `TTL` is 24h. |
| iPhone receives nothing                   | iOS only delivers Web Push to a PWA installed on the home screen (16.4+).    |
