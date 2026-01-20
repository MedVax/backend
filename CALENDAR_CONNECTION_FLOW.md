# Calendar Connection Flow - Quick Reference

## How to Connect Google Calendar

### Step-by-Step Process:

### 1. **Environment Setup** (One-time, Backend)

Add to `.env`:
```env
GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/auth/google-calendar/callback
```

### 2. **Get Google OAuth Credentials**

1. Go to https://console.cloud.google.com/
2. Create/select a project
3. Enable "Google Calendar API"
4. Create OAuth 2.0 credentials (Web application)
5. Add redirect URI: `http://localhost:3000/api/auth/google-calendar/callback`
6. Copy Client ID and Client Secret to `.env`

### 3. **Frontend: Initiate Connection**

```javascript
// 1. Get authorization URL
const redirectUri = `${window.location.origin}/api/auth/google-calendar/callback`;

const response = await fetch(
  `/api/sessions/calendar/google/auth-url?redirectUri=${encodeURIComponent(redirectUri)}`
);
const { authUrl } = await response.json();

// 2. Redirect user to Google
window.location.href = authUrl;
```

### 4. **Backend: Handle Callback**

When Google redirects back with `code`:

```javascript
// Exchange code for tokens
const response = await fetch('/api/sessions/calendar/google/tokens', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: 'authorization-code-from-query-string',
    redirectUri: 'same-redirect-uri'
  })
});

const { credentials } = await response.json();
// credentials: { accessToken, refreshToken, expiryDate }
```

### 5. **Save Credentials to Database**

```typescript
// Update consultant profile with calendar credentials
await prisma.userProfileConsultant.update({
  where: { id: consultantId },
  data: {
    calendarProvider: 'google',
    calendarAccessToken: encrypt(credentials.accessToken), // Encrypt!
    calendarRefreshToken: encrypt(credentials.refreshToken), // Encrypt!
    calendarTokenExpiry: new Date(credentials.expiryDate),
    calendarConnected: true,
  }
});
```

### 6. **Automatic Event Creation**

Once credentials are saved, the `CalendarService` can automatically:

- **Create events** when sessions are booked
- **Update events** when sessions are rescheduled  
- **Delete events** when sessions are cancelled

Example usage in session creation:
```typescript
// In SessionsService when creating a session
const consultant = await getConsultant(consultantId);

if (consultant.calendarConnected && consultant.calendarAccessToken) {
  const credentials = {
    accessToken: decrypt(consultant.calendarAccessToken),
    refreshToken: decrypt(consultant.calendarRefreshToken),
    expiryDate: consultant.calendarTokenExpiry?.getTime(),
  };

  const eventId = await calendarService.createEvent(
    credentials,
    {
      summary: `Therapy Session with ${clientName}`,
      description: `Session details...`,
      start: { dateTime: sessionDate.toISOString(), timeZone: 'Africa/Lagos' },
      end: { dateTime: endDate.toISOString(), timeZone: 'Africa/Lagos' },
      attendees: [
        { email: clientEmail, displayName: clientName },
        { email: consultantEmail, displayName: consultantName },
      ],
    },
    'google'
  );

  // Save event ID to session
  await updateSession(sessionId, { calendarEventId: eventId });
}
```

## API Endpoints Available

The `CalendarService` provides these methods (you may need to expose them via controller):

- `getGoogleCalendarAuthUrl(redirectUri)` - Get OAuth URL
- `getGoogleCalendarTokens(code, redirectUri)` - Exchange code for tokens
- `createEvent(credentials, event, provider)` - Create calendar event
- `updateEvent(credentials, eventId, event, provider)` - Update event
- `deleteEvent(credentials, eventId, provider)` - Delete event
- `generateICalFile(event)` - Generate iCal file (no auth needed)

## Security Notes

1. **Encrypt tokens** before storing in database
2. **Refresh tokens** before they expire (access tokens expire in ~1 hour)
3. **Handle token refresh** automatically in CalendarService
4. **Use HTTPS** in production for OAuth callbacks

## Disconnect Calendar

To disconnect:
```typescript
await prisma.userProfileConsultant.update({
  where: { id: consultantId },
  data: {
    calendarConnected: false,
    calendarAccessToken: null,
    calendarRefreshToken: null,
    calendarTokenExpiry: null,
  }
});
```

## Next Steps

After running the migration to add calendar fields:

1. Create API endpoints to save/retrieve calendar credentials
2. Add UI for consultants to connect/disconnect calendars
3. Integrate calendar event creation into session booking/rescheduling/cancellation flows
4. Implement token refresh logic

