export const NOTIFICATION_EVENTS = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_PAID: 'ORDER_PAID',
} as const;

/**
 * Notification `tag` values. The browser collapses notifications that share a
 * tag, so each order gets its own tag namespace to avoid one order's update
 * swallowing another's.
 */
export const NOTIFICATION_TAGS = {
  NEW_ORDER: 'new-order',
  ORDER_PAID: 'order-paid',
  TEST: 'test-notification',
} as const;

/**
 * A subscription is dropped after this many consecutive delivery failures.
 * Push services also return 404/410 for permanently gone endpoints, which are
 * removed immediately regardless of this threshold.
 */
export const MAX_PUSH_FAILURES = 5;

/** Delivery batch size, to avoid opening thousands of sockets at once. */
export const PUSH_BATCH_SIZE = 50;
