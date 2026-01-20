# Calendar Integration Guide

This guide explains how to connect and use Google Calendar (and other calendar providers) with the Medvax session booking system.

## Overview

The calendar integration allows consultants to:
- Automatically create calendar events when sessions are booked
- Sync session schedules with their Google Calendar
- Send calendar invitations to clients
- Manage calendar events when sessions are rescheduled or cancelled

## Setup Instructions

### 1. Google Calendar OAuth Setup

#### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

#### Step 2: Configure OAuth Consent Screen
1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" (unless you have Google Workspace)
3. Fill in the required information:
   - App name: "Medvax"
   - User support email: Your support email
   - Developer contact: Your email
4. Add scopes:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
5. Add test users (if in testing mode) or publish the app

#### Step 3: Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application"
4. Configure:
   - **Name**: Medvax Calendar Integration
   - **Authorized JavaScript origins**: 
     - `http://localhost:3000` (development)
     - `https://yourdomain.com` (production)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/auth/google-calendar/callback` (development)
     - `https://yourdomain.com/api/auth/google-calendar/callback` (production)
5. Save and copy the **Client ID** and **Client Secret**

#### Step 4: Configure Environment Variables
Add these to your `.env` file:

```env
GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=your-client-secret
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/auth/google-calendar/callback
```

## OAuth Flow (How to Connect)

### For Consultants:

1. **Get Authorization URL**
   ```
   GET /sessions/calendar/google/auth-url?redirectUri={your-callback-url}
   ```
   Returns: `{ authUrl: "https://accounts.google.com/o/oauth2/v2/auth?..." }`

2. **Redirect User to Authorization URL**
   - User clicks "Connect Google Calendar" button
   - Redirects to Google OAuth consent screen
   - User grants permissions
   - Google redirects to your `redirectUri` with an authorization `code`

3. **Exchange Code for Tokens**
   ```
   POST /sessions/calendar/google/tokens
   Body: {
     code: "authorization-code-from-google",
     redirectUri: "same-redirect-uri-used-above"
   }
   ```
   Returns: 
   ```json
   {
     credentials: {
       accessToken: "...",
       refreshToken: "...",
       expiryDate: 1234567890
     }
   }
   ```

4. **Store Credentials**
   - Save the credentials to the consultant's profile in the database
   - Store them securely (encrypted if possible)

5. **Use Credentials**
   - When creating sessions, automatically create calendar events
   - Use the stored credentials for future calendar operations

## Implementation Example

### Frontend Flow (React/Next.js example):

```typescript
// 1. Initiate connection
const connectGoogleCalendar = async () => {
  const redirectUri = `${window.location.origin}/api/auth/google-calendar/callback`;
  
  const response = await fetch(
    `/api/sessions/calendar/google/auth-url?redirectUri=${encodeURIComponent(redirectUri)}`
  );
  const { authUrl } = await response.json();
  
  // Redirect to Google
  window.location.href = authUrl;
};

// 2. Handle callback (in your callback page/API route)
const handleCallback = async (code: string) => {
  const redirectUri = `${window.location.origin}/api/auth/google-calendar/callback`;
  
  const response = await fetch('/api/sessions/calendar/google/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  });
  
  const { credentials } = await response.json();
  
  // Save credentials to your backend (associate with consultant)
  await saveCalendarCredentials(credentials);
};
```

### Backend: Storing Credentials

You'll need to:
1. Add fields to store calendar credentials in `UserProfileConsultant` model
2. Create an endpoint/service to save credentials
3. Use stored credentials when creating session calendar events

## Automatic Calendar Event Creation

Once credentials are stored, the system can automatically create calendar events when:

1. **Session is Booked**: Creates event with client and consultant as attendees
2. **Session is Rescheduled**: Updates the existing calendar event
3. **Session is Cancelled**: Deletes the calendar event

## Security Best Practices

1. **Encrypt Credentials**: Store refresh tokens encrypted in the database
2. **Token Refresh**: Implement automatic token refresh before expiry
3. **Scope Limitation**: Request only necessary scopes
4. **HTTPS Only**: Always use HTTPS in production for OAuth callbacks
5. **Token Revocation**: Provide a way for users to revoke access

## Troubleshooting

### Common Issues:

1. **"redirect_uri_mismatch"**
   - Ensure the redirect URI in your code matches exactly with the one configured in Google Cloud Console
   - Check for trailing slashes, http vs https, etc.

2. **"invalid_grant"**
   - Authorization code can only be used once
   - Codes expire after 10 minutes
   - Refresh token might be expired (user needs to reconnect)

3. **"access_denied"**
   - User didn't grant permissions
   - OAuth consent screen not properly configured

4. **Calendar events not creating**
   - Check if credentials are stored correctly
   - Verify access token hasn't expired
   - Check Google Calendar API is enabled in Google Cloud Console

## Next Steps

1. Add database fields for storing calendar credentials (see schema update below)
2. Create endpoints to save/retrieve calendar credentials
3. Integrate calendar event creation into session booking flow
4. Add UI for consultants to connect/disconnect their calendars

