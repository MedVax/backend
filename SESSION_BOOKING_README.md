# Session Booking System - Documentation

## Overview

The Session Booking System is a comprehensive feature that handles consultation session scheduling between clients (patients) and consultants (consultants). It supports multiple paystack payment, subscription management, gift sessions, HMO integration, and couple therapy with participants.

Also the session should be linked to google calender or any form of carlendar possible, make provision for user calendar integration to various platform.

## Table of Contents

1. [Architecture](#architecture)
2. [Core Components](#core-components)
3. [Session Booking Flow](#session-booking-flow)
4. [API Endpoints](#api-endpoints)
5. [Session Types](#session-types)
6. [Payment & Quota System](#payment--quota-system)
7. [Event System](#event-system)
8. [Meeting Integration](#meeting-integration)
9. [Rescheduling & Cancellation](#rescheduling--cancellation)
10. [Code Examples](#code-examples)

---

## Architecture

### Module Structure

```
features/sessions/
├── controllers/
│   ├── sessions.controller.ts          # Main client/consultant endpoints
│   ├── admin.sessions.controller.ts    # Admin endpoints
│   ├── gift.sessions.controller.ts     # Gift session endpoints
│   ├── meeting.sessions.controller.ts  # Meeting-related endpoints
│   └── reschedule-request.controller.ts # Reschedule endpoints
├── services/
│   ├── sessions.service.ts             # Core session logic
│   ├── available-quota.sessions.service.ts # Quota calculation
│   ├── gift.sessions.service.ts        # Gift session handling
│   ├── meeting.sessions.service.ts     # Meeting management
│   └── reschedule-requests.sessions.service.ts # Reschedule logic
├── listeners/
│   ├── session-created.listener.ts     # Post-creation events
│   ├── session-cancellation-notification.listener.ts
│   └── session-reschedule-notification.listener.ts
├── dto/
│   ├── create-sessions.dto.ts          # Session creation DTO
│   ├── reschedule-sessions.dto.ts
│   └── cancel-sessions.dto.ts
├── events/
│   └── sessions.event.ts               # Event types
├── session.repository.ts               # Data access layer
└── constants.ts                        # Session constants
```

---

## Core Components

### 1. SessionService

Main service handling session lifecycle:

**Key Methods:**
- `initializeSessionSchedule()` - Entry point for booking flow
- `scheduleSessions()` - Creates sessions after validation
- `createSession()` - Creates a single session
- `rescheduleSession()` - Handles session rescheduling
- `cancelSession()` - Handles session cancellation
- `updateSessionStatus()` - Updates session status (APPROVED/DECLINED)
- `getSessions()` - Retrieves sessions with filters
- `validateUsersAndSession()` - Validates client/consultant compatibility

### 2. AvailableQuotaSessionsService

Calculates available session quota based on multiple sources:

**Quota Sources:**
- **Subscription Quota** - From active subscription packages
- **HMO Quota** - Health Maintenance Organization limits
- **Gift Quota** - Gifted session credits

**Key Methods:**
- `getAvailableSessionsQuota()` - Main method returning combined quota
- `getSubscriptionQuota()` - Subscription-based quota
- `getHMOAvailableSessionsQuota()` - HMO quota (monthly/yearly/unlimited)
- `getSessionGiftQuota()` - Gift session quota

### 3. SessionRepository

Generic Prisma repository for session data access with query filtering, pagination, and search capabilities.

---

## Session Booking Flow

### High-Level Flow

```
1. Client initiates booking → POST /api/v2/sessions/schedule
2. Validate users (client & consultant)
3. Check available quota (subscription/HMO/organization/gift)
4. Calculate payment requirements
5. If payment needed → Initialize payment → Return payment link
6. If no payment → Create sessions directly
7. Create meeting (Dyte video SDK)
8. Emit SESSION_CREATED event
9. Event listeners handle:
   - Email notifications
   - WhatsApp notifications (if enabled)
   - Analytics tracking
   - Coupon application
   - Client flag updates
```

### Detailed Flow

#### Step 1: Initialize Session Schedule

```typescript
initializeSessionSchedule(user: UserData, dto: CreateSessionsDTO)
```

**What happens:**
1. Validates client and consultant exist and are active
2. Fetches session price for the session type
3. Gets user HMO data (if applicable)
4. Calculates available quota from all sources
5. Determines if user is B2C (client-paid) or B2B (organization/HMO-paid)

#### Step 2: Quota & Payment Logic

**B2C Users (Client-Paid):**
- If no available sessions → Initialize payment
- If subscription exists but insufficient quota → Initialize payment for excess
- If sufficient quota → Create sessions directly

**B2B Users (Organization/HMO-Paid):**
- If unlimited quota → Create sessions directly
- If quota available → Create sessions directly
- If quota exceeded but verifiable → Create with `PENDING_APPROVAL` status
- If quota exceeded and not verifiable → Initialize payment (fallback to client-paid)

#### Step 3: Session Creation

```typescript
scheduleSessions(dto: CreateSessionsDTO, buffer?: number)
```

**Process:**
1. Validates client and consultant are compatible
2. Checks if session type is supported by consultant
3. Creates sessions in transaction (for multiple dates)
4. For each date:
   - Validates slot availability
   - Checks HMO quota
   - Creates meeting (Dyte)
   - Determines session status:
     - `PENDING` - Normal booking
     - `PENDING_APPROVAL` - Requires admin/org approval
   - Determines payment sponsor:
     - `CLIENT` - Client pays
     - `HMO` - HMO covers
   - Applies gift session if requested
   - Links to subscription if applicable
   - Creates session activity record

#### Step 4: Post-Creation Events

After sessions are created, `SESSION_CREATED` event is emitted:

```typescript
eventEmitter.emit(sessionEventType.SESSION_CREATED, new SessionCreationEvent(...))
```

**Event Listeners Handle:**
- Email notifications (client, consultant)
- WhatsApp notifications (if enabled)
- Analytics tracking (first session, session booked events)
- Coupon application
- Setting `hasBookedSession` flag on client

---

## API Endpoints

### Client Endpoints

#### Create/Schedule Sessions
```http
POST /api/v2/sessions/schedule
Authorization: Bearer {token}
Content-Type: application/json

{
  "consultantId": "uuid",
  "dates": ["2024-01-15T10:00:00Z"],
  "sessionType": "INDIVIDUAL" | "CONSULTATION",
  "clientTimezone": "Africa/Lagos",
  "currencyId": 1,
  "redirectUrl": "https://app.example.com/success",
  "applyGift": false,
  "paidBy": "CLIENT" | "ORG" | "HMO" | "ORG_CLIENT",
  "hmoId": "uuid" (optional),
  "hmoNumber": "string" (optional),
  "couponId": "uuid" (optional),
  "subscriptionId": "uuid" (optional),
}
```

**Response:**
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Process successful",
  "data": {
    "sessions": [/* session objects */] | null,
    "paymentLink": "https://pay.example.com/..." | null
  }
}
```

#### Get User Sessions
```http
GET /api/v2/sessions?page=1&limit=20&state=past|upcoming|canceled|completed|pending_approval
Authorization: Bearer {token}
```

#### Get Available Quota
```http
GET /api/v2/sessions/quota?hmoId=uuid&hmoNumber=string
Authorization: Bearer {token}
```

**Response:**
```json
{
  "availableSessionsCount": 10,
  "giftAvailableSessionsCount": 2,
  "isUnlimited": false,
  "sessionFrequency": "MONTHLY",
  "sessionQuote": 12,
  "discount": 10,
  "sponsor": "ORG",
  "subscription": {
    "individual": {
      "availableSessionsCount": 8,
      "active": true,
      "id": "uuid",
      "usedSessionsCount": 2
    },
    "couple": {
      "availableSessionsCount": 0,
      "active": false,
      "id": null,
      "usedSessionsCount": 0
    }
  },
  "referral": {
    "percentage": 5
  }
}
```

#### Get Booked Count
```http
GET /api/v2/sessions/booked-count
Authorization: Bearer {token}
```

#### Reschedule Session
```http
POST /api/v2/sessions/reschedule
Authorization: Bearer {token}

{
  "sessionId": "uuid",
  "date": "2024-01-20T10:00:00Z",
  "consultantId": "uuid"
}
```

#### Cancel Session
```http
POST /api/v2/sessions/cancel
Authorization: Bearer {token}

{
  "sessionId": "uuid",
  "date": "2024-01-15T10:00:00Z",
  "consultantId": "uuid",
  "note": "Cancellation reason" (optional)
}
```

### consultant Endpoints

#### Get consultant Sessions
```http
GET /api/v2/sessions/consultant?page=1&limit=20&state=past|upcoming&clientId=uuid
Authorization: Bearer {token}
```

#### Get consultant Stats
```http
GET /api/v2/sessions/consultant/{consultantId}/stats
Authorization: Bearer {token}
```

#### Send Booking Reminder
```http
GET /api/v2/sessions/booking-reminder?clientId=uuid
Authorization: Bearer {token}
```

### Public Endpoints

#### Get Session Price
```http
GET /api/v2/sessions/price/{sessionType}
```

---

## Session Types

### INDIVIDUAL
One-on-one session between client and consultant.

### COUPLE
Session for couples with one or more participants:
- Primary client books the session
- Additional participants can be invited via email
- Each participant receives invitation emails
- Participants can be existing users or new invitees

**Participant Flow:**
1. Client adds participants with name and email
2. System creates `SessionInvitee` records
3. If participant is existing user → Creates `SessionParticipant`
4. Invitation emails sent to all participants
5. Participants accept/join the session

### CONSULTATION
Consultation session (typically for psychiatrists).

---

## Payment & Quota System

### Quota Priority

The system checks quotas in this order:
1. **Subscription Quota** - Highest priority for B2C users
3. **HMO Quota** - For HMO-covered users
4. **Gift Quota** - Can be combined with other quotas

### Payment Flow

**When Payment is Required:**
1. B2C user with no available quota
2. B2C user booking more sessions than quota allows
3. B2B user with exhausted quota (fallback to client-paid)

**Payment Initialization:**
```typescript
paymentService.initializeSessionPayment(user, dto)
```

**Process:**
1. Gets session price for type
2. Applies coupon discount (if provided)
3. Applies organization discount (if applicable)
4. Applies referral discount (if applicable)
5. Creates payment link via gateway (Stripe/Paystack/Flutterwave)
6. Returns payment link for redirect

**After Payment:**
- Webhook processes payment
- Sessions are created automatically
- Transaction record created

### Gift Sessions

**Applying Gift:**
- Set `applyGift: true` in booking request
- System finds available gift credits
- Deducts from gift quota
- Updates `sessionLeft` on `SessionGift` record
- Links session to gift via `giftId`

### Subscription Integration

**Active Subscription:**
- Sessions linked to subscription via `subscriptionId`
- Quota tracked per subscription
- Separate quota for INDIVIDUAL and COUPLE types
- Auto-deducts from subscription quota

---

## Event System

### Events Emitted

#### SESSION_CREATED
Emitted after sessions are successfully created.

**Event Data:**
```typescript
{
  dto: CreateSessionsDTO,
  sessions: Session[],
  sessionCount: number,  // Total individual sessions before
  coupleSessionCount: number  // Total couple sessions before
}
```

**Handled By:**
- `SessionCreatedListener`

**Actions:**
- Send email notifications (client, consultant, participants)
- Send WhatsApp notifications (if enabled)
- Track analytics events (first session, session booked)
- Apply coupons
- Update client `hasBookedSession` flag

#### SESSION_CANCELLATION_NOTIFICATION
Emitted when session is canceled.

**Handled By:**
- `SessionCancellationNotificationListener`

#### SESSION_RESCHEDULE_NOTIFICATION
Emitted when session is rescheduled.

**Handled By:**
- `SessionRescheduleNotificationListener`

---

## Meeting Integration

### Dyte Video SDK

**Meeting Creation:**
- Automatically created when session is booked
- Meeting ID stored in `Session.meetingId`
- Meeting details included in confirmation emails

**Meeting Management:**
- Meeting link sent via email/WhatsApp
- Meeting status tracked in `SessionActivity`
- Join/leave events tracked
- Meeting end time recorded

**Meeting Service:**
```typescript
meetingService.createMeeting(title: string)
```

---

## Rescheduling & Cancellation

### Rescheduling Flow

```typescript
rescheduleSession(rescheduleRequest, buffer?: number)
```

**Process:**
1. Validates session exists and is in PENDING status
2. Checks consultant slot availability
3. Validates no conflicting session at new time
4. Updates session date and dateString
5. Sets `rescheduled: true`
6. Updates `changeLog` with reschedule history
7. Emits `SESSION_RESCHEDULE_NOTIFICATION` event

**Status Check:**
- Session must be `PENDING` status
- Cannot reschedule `DECLINED` or `CANCELED` sessions
- Cannot reschedule past sessions

### Cancellation Flow

```typescript
cancelSession(body: CancelSessionsDTO)
```

**Process:**
1. Validates user has permission (must be client)
2. Validates session exists
3. Updates session status to `CANCELED`
4. Sets `deleted: true` (soft delete)
5. Updates `changeLog`
6. Cancels meeting (if applicable)
7. Emits `SESSION_CANCELLATION_NOTIFICATION` event

**Cancellation Policies:**
- Only clients can cancel their own sessions
- consultants cannot cancel (can decline during approval)
- Admin can delete sessions

---

## Session Status Flow

```
PENDING → (Auto-approved or Admin approval) → PENDING
PENDING → Admin declines → DECLINED
PENDING → Client cancels → CANCELED
PENDING → Session occurs → COMPLETED
PENDING_APPROVAL → Admin approves → PENDING
PENDING_APPROVAL → Admin declines → DECLINED
```

### Status Meanings

- **PENDING** - Normal booking, awaiting session
- **PENDING_APPROVAL** - Requires admin/organization approval (HMO/Org quota exceeded)
- **APPROVED** - Manually approved (legacy)
- **DECLINED** - Declined by admin or consultant
- **CANCELED** - Canceled by client
- **COMPLETED** - Session has occurred
- **UPCOMING** - Query filter state (not actual status)

---

## Code Examples

### Basic Session Booking

```typescript
// Client books an individual session
const bookingDto: CreateSessionsDTO = {
  consultantId: "consultant-uuid",
  dates: ["2024-01-15T10:00:00Z"],
  sessionType: SessionType.INDIVIDUAL,
  clientTimezone: "Africa/Lagos",
  currencyId: 1,
  redirectUrl: "https://app.example.com/success",
  paidBy: OrganizationSponsor.CLIENT
};

const result = await sessionService.initializeSessionSchedule(user, bookingDto);

if (result.paymentLink) {
  // Redirect to payment
  window.location.href = result.paymentLink;
} else {
  // Sessions created successfully
  console.log("Sessions created:", result.sessions);
}
```

### Couple Session Booking

```typescript
const coupleBookingDto: CreateSessionsDTO = {
  consultantId: "consultant-uuid",
  dates: ["2024-01-15T10:00:00Z"],
  sessionType: SessionType.COUPLE,
  clientTimezone: "Africa/Lagos",
  currencyId: 1,
  redirectUrl: "https://app.example.com/success",
  paidBy: OrganizationSponsor.CLIENT,
  participants: [
    {
      name: "Jane Doe",
      email: "jane@example.com"
    }
  ]
};

const result = await sessionService.initializeSessionSchedule(user, coupleBookingDto);
```

### Check Available Quota

```typescript
const quota = await availableQuotaService.getAvailableSessionsQuota({
  clientUserId: user.id,
  hmoId: "hmo-uuid",  // optional
  hmoNumber: "123456"  // optional
});

console.log("Available sessions:", quota.availableSessionsCount);
console.log("Gift sessions:", quota.giftAvailableSessionsCount);
console.log("Subscription active:", quota.subscription.individual.active);
```

### Reschedule Session

```typescript
const rescheduleDto: RescheduleSessionsDTO = {
  sessionId: "session-uuid",
  date: "2024-01-20T10:00:00Z",
  consultantId: "consultant-uuid"
};

const result = await sessionService.rescheduleSession({
  ...rescheduleDto,
  clientId: user.id
});
```

### Get User Sessions

```typescript
const sessions = await sessionService.getMany({
  userId: user.id,
  state: "upcoming",  // past | upcoming | canceled | completed | pending_approval
  page: 1,
  limit: 20
});
```

---

## Key Considerations

### Timezone Handling
- All sessions store `clientTimezone`
- Dates converted to UTC for storage
- Local times calculated for display using `formatInTimeZone`
- consultant and client see times in their respective timezones

### Slot Availability
- consultant availability checked via `consultantAvailabilityService`
- Buffer time can be specified (default: consultant availability check)
- Conflicting sessions prevented at same dateString

### Quota Calculation
- HMO quota: Monthly or Yearly limits
- Organization quota: Monthly, Yearly, or One-off
- Subscription quota: Per subscription package
- Gift quota: Can combine with other quotas
- Referral discount: Percentage off, not quota

### Error Handling
- `TIME_SLOT_UNAVAILABLE` - Slot already booked
- `SESSION_UNAVAILABLE` - Session doesn't exist
- `ACCOUNT_RESTRICTED_FROM_BOOKING` - Client account restricted
- `THERAPIST_RESTRICTED_FROM_BEING_BOOKED` - consultant restricted
- `INVALID_SLOT` - Invalid slot selected
- `Booked sessions exceeded quota` - Too many sessions requested

### Performance Considerations
- Multiple sessions created in transaction
- Parallel promise execution for quota checks
- Caching of quota calculations (Redis)
- Efficient querying with Prisma includes

---

## Database Schema

Key session-related tables:

- **Session** - Main session entity
- **SessionParticipant** - Couple session participants
- **SessionInvitee** - Invited participants (pending)
- **SessionActivity** - Meeting activity tracking
- **SessionRescheduleRequest** - Reschedule requests
- **SessionReview** - Post-session reviews
- **SessionGift** - Gift session credits
- **UserSubscription** - Active subscriptions
- **Transaction** - Payment transactions

---

## Testing

### Unit Tests
Located in `__test__/` directory:
- `session-service.spec.ts` - Service unit tests

### Test Scenarios
- Session creation with various quota scenarios
- Payment flow when quota exhausted
- Gift session application
- Couple session with participants
- Rescheduling validation
- Cancellation flow
- Status update flow

---

## Future Enhancements

- [ ] Session reminders (email/SMS/WhatsApp)
- [ ] Automatic rescheduling based on consultant availability
- [ ] Bulk session booking
- [ ] Session waitlist
- [ ] Advanced availability management
- [ ] Session templates
- [ ] Recurring session booking
- [ ] Session notes and documentation

---

## Related Modules

- **Payment Module** - Payment processing
- **Subscription Module** - Subscription management
- **Coupon Module** - Coupon system
- **Mail Module** - Email notifications
- **WhatsApp Module** - WhatsApp notifications
- **Events Module** - Analytics tracking
- **Users Module** - Client/consultant management
- **Scheduler Module** - Scheduled tasks (reminders, cleanup)

---

---

## Provider Availability Management

### Overview

Providers must set their availability before clients can book sessions. The system supports two types of availability: **WEEKLY** (recurring) and **CUSTOM** (specific dates).

### Availability Types

#### 1. Weekly Availability (Recurring)

Weekly availability allows providers to set recurring time slots for specific days of the week. This is ideal for providers with consistent schedules.

**Structure:**
- Each day of the week (Monday-Sunday) can have multiple time intervals
- Intervals are stored as hour slots (0-23)
- Example: Monday 9 AM - 12 PM, 2 PM - 5 PM

#### 2. Custom Availability (Specific Dates)

Custom availability allows providers to set specific time slots for particular dates. This overrides weekly availability for those dates.

**Use Cases:**
- One-time availability changes
- Holidays or special dates
- Temporary schedule adjustments

### Setting Availability

#### Endpoint: Update Availability

```http
POST /api/v2/providers/availability
Authorization: Bearer {provider_token}
Content-Type: application/json

{
  "timezone": "Africa/Lagos",
  "weekly": {
    "monday": [
      { "start": 9, "end": 12 },
      { "start": 14, "end": 17 }
    ],
    "tuesday": [
      { "start": 9, "end": 12 },
      { "start": 14, "end": 17 }
    ],
    "wednesday": [
      { "start": 9, "end": 12 }
    ],
    "thursday": [],
    "friday": [],
    "saturday": [],
    "sunday": []
  },
  "custom": [
    {
      "date": "2024-01-25",
      "intervals": [
        { "start": 10, "end": 14 }
      ]
    }
  ]
}
```

**Validation Rules:**
- Time intervals must be numeric (0-23 for hours)
- Intervals cannot overlap on the same day
- Start time must be less than end time
- Custom dates must be valid date strings

**What Happens:**
1. Updates provider timezone
2. Creates/updates weekly availability records (one per day)
3. Creates/updates custom availability records
4. Calculates availability period (WEEKDAYS/WEEKENDS/MIXED)
5. Sets `hasSetAvailability: true` on provider

### Getting Availability

#### For Providers (My Availability)

```http
GET /api/v2/providers/availability?date=2024-01-01
Authorization: Bearer {provider_token}
```

**Response:**
```json
{
  "timezone": "Africa/Lagos",
  "weekly": {
    "monday": [{ "start": 9, "end": 12 }],
    "tuesday": [{ "start": 9, "end": 12 }],
    "wednesday": [],
    "thursday": [],
    "friday": [],
    "saturday": [],
    "sunday": []
  },
  "custom": [
    {
      "id": "uuid",
      "date": "2024-01-25",
      "intervals": [{ "start": 10, "end": 14 }]
    }
  ]
}
```

#### For Clients (Get Provider Availability)

```http
GET /api/v2/providers/{providerId}/availability?date=2024-01-01&buffer=12
Authorization: Bearer {client_token}
```

**Query Parameters:**
- `date` - Reference date (defaults to current date)
- `buffer` - Buffer time in hours before a slot can be booked (default: 12)

**Response:**
```json
[
  {
    "date": "2024-01-15",
    "dayOfWeek": "Monday",
    "timezone": "Africa/Lagos",
    "slots": [
      {
        "time": "2024-01-15T09:00:00.000Z",
        "isAvailable": true
      },
      {
        "time": "2024-01-15T10:00:00.000Z",
        "isAvailable": true
      },
      {
        "time": "2024-01-15T11:00:00.000Z",
        "isAvailable": true
      }
    ],
    "intervals": [
      { "start": 9, "end": 12 }
    ]
  }
]
```

**Note:** Only returns dates with available slots. Booked slots are automatically excluded.

### Slot Availability Check

When a client attempts to book a session, the system checks:

1. **Provider has availability** - Provider must have set availability
2. **Slot exists in availability** - Requested time must be in provider's available slots
3. **Slot not booked** - No existing session at that time
4. **Buffer time** - Slot must be at least N hours in the future (default: 12 hours)
5. **Custom overrides weekly** - Custom availability takes precedence

**Implementation:**
```typescript
isSlotAvailable(providerId: string, timeslotAsIsoString: string, buffer?: number)
```

### Availability Period Detection

The system automatically determines provider availability period:

- **WEEKDAYS** - Only weekdays (Monday-Friday) have availability
- **WEEKENDS** - Only weekends (Saturday-Sunday) have availability
- **MIXED** - Both weekdays and weekends have availability

This is stored in `Provider.availabilityPeriod` and used for provider search/filtering.

### Managing Custom Availability

#### Delete Custom Record

```http
DELETE /api/v2/providers/availability/{recordId}
Authorization: Bearer {provider_token}
```

This soft-deletes the custom availability record, reverting to weekly availability for that date.

### How Availability Works with Sessions

**Booking Flow Integration:**
1. Client selects provider
2. System fetches provider availability via `getForProvider()`
3. System excludes already booked slots
4. Client sees only available slots
5. On booking, `isSlotAvailable()` validates the slot
6. Session created only if slot is available

**Session Booking Validation:**
```typescript
// In createSession()
const slotIsAvailable = await this.providerAvailabilityService.isSlotAvailable(
  providerId, 
  scheduledDateString, 
  buffer
);

if (!slotIsAvailable) {
  throw new BadRequestException(ERROR_MESSAGES.TIME_SLOT_UNAVAILABLE);
}
```

### Buffer Time

**Purpose:**
- Prevents last-minute bookings
- Gives provider time to prepare
- Default: 12 hours

**How it Works:**
- Slot must be at least N hours in the future
- Buffer time is configurable per request
- Applies to both availability display and booking validation

**Example:**
- Current time: 10:00 AM
- Buffer: 12 hours
- Available slots start from: 10:00 PM (same day) or later

### Timezone Handling in Availability

**Important Points:**
- Provider sets availability in their timezone
- Slots are stored as hour numbers (0-23) in provider's timezone
- When displayed to clients, slots are converted to ISO timestamps
- Client sees slots in their own timezone
- Booking validation uses provider's timezone

**Conversion Flow:**
```
Provider Timezone (UTC+1) → Hour Slots [9, 10, 11] 
→ ISO Timestamps (UTC)
→ Client Timezone (UTC+5) → Display Times
```

### Code Examples

#### Set Weekly Availability

```typescript
const availabilityDto: UpdateAvailabilityDTO = {
  timezone: "Africa/Lagos",
  weekly: {
    monday: [
      { start: 9, end: 12 },
      { start: 14, end: 17 }
    ],
    tuesday: [
      { start: 9, end: 12 }
    ],
    // ... other days
  },
  custom: []
};

await providerAvailabilityService.updateAvailability(providerId, availabilityDto);
```

#### Add Custom Availability

```typescript
const availabilityDto: UpdateAvailabilityDTO = {
  timezone: "Africa/Lagos",
  weekly: { /* existing weekly */ },
  custom: [
    {
      date: "2024-12-25", // Christmas
      intervals: [
        { start: 10, end: 14 } // Only available 10 AM - 2 PM
      ]
    }
  ]
};
```

#### Check Slot Availability

```typescript
const isAvailable = await providerAvailabilityService.isSlotAvailable(
  providerId,
  "2024-01-15T10:00:00.000Z",
  12 // 12 hour buffer
);
```

#### Get Available Slots for Client

```typescript
const availableSlots = await providerAvailabilityService.getForProvider(
  providerId,
  "2024-01-01", // reference date
  12 // buffer hours
);
```

### Availability Priority

When both weekly and custom availability exist for the same date:

1. **Custom availability** takes precedence
2. Weekly availability is ignored for that date
3. Custom records can be deleted to revert to weekly

### Common Scenarios

**Scenario 1: Provider sets regular schedule**
- Use weekly availability for consistent schedule
- Set same intervals for each working day

**Scenario 2: Provider takes a day off**
- Set that day to empty array `[]` in weekly
- Or don't include it (defaults to unavailable)

**Scenario 3: Provider changes schedule temporarily**
- Keep weekly availability as normal
- Add custom availability for specific dates with different hours

**Scenario 4: Provider works different hours on weekends**
- Set weekday hours in weekly (Monday-Friday)
- Set weekend hours in weekly (Saturday-Sunday)
- System detects as MIXED period

---

## Key Considerations

### Timezone Handling
- All sessions store `clientTimezone`
- Dates converted to UTC for storage
- Local times calculated for display using `formatInTimeZone`
- Provider and client see times in their respective timezones
- Provider availability stored in provider's timezone but converted to ISO timestamps for clients

### Slot Availability
- Provider availability checked via `ProviderAvailabilityService`
- Buffer time can be specified (default: 12 hours)
- Conflicting sessions prevented at same dateString
- Custom availability overrides weekly for specific dates
- Only available slots (after excluding booked sessions) are returned

### Quota Calculation
- HMO quota: Monthly or Yearly limits
- Organization quota: Monthly, Yearly, or One-off
- Subscription quota: Per subscription package
- Gift quota: Can combine with other quotas
- Referral discount: Percentage off, not quota

### Error Handling
- `TIME_SLOT_UNAVAILABLE` - Slot already booked
- `SESSION_UNAVAILABLE` - Session doesn't exist
- `ACCOUNT_RESTRICTED_FROM_BOOKING` - Client account restricted
- `THERAPIST_RESTRICTED_FROM_BEING_BOOKED` - Provider restricted
- `INVALID_SLOT` - Invalid slot selected
- `Booked sessions exceeded quota` - Too many sessions requested

### Performance Considerations
- Multiple sessions created in transaction
- Parallel promise execution for quota checks
- Caching of quota calculations (Redis)
- Efficient querying with Prisma includes

---

## Database Schema

Key session-related tables:

- **Session** - Main session entity
- **SessionParticipant** - Couple session participants
- **SessionInvitee** - Invited participants (pending)
- **SessionActivity** - Meeting activity tracking
- **SessionRescheduleRequest** - Reschedule requests
- **SessionReview** - Post-session reviews
- **SessionGift** - Gift session credits
- **UserSubscription** - Active subscriptions
- **Transaction** - Payment transactions
- **ProviderAvailability** - Provider availability slots (WEEKLY/CUSTOM)
- **Provider** - Provider entity with `hasSetAvailability` flag and `availabilityPeriod`


## Support & Documentation

For questions or issues:
1. Check this README
2. Review API documentation at `/api/v2/docs`
3. Check event listeners for notification flows
4. Review service method JSDoc comments

---

**Last Updated:** 2024
**Maintained By:** Medvax Health Engineering Team

