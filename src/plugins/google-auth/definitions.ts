// google-auth/definitions.ts
export interface GoogleUser {
  id: string;
  name: string | null;
  email: string;
  imageUrl: string | null;
  /**
   * The user's ID token. Useful for server-side verification.
   */
  idToken: string;
  /**
   * The OAuth 2.0 Access Token for accessing Google APIs (e.g., Gmail).
   * Might be null if fetching failed or wasn't requested/granted.
   */
  accessToken?: string; // Access Token (opsiyonel, alınamazsa null/undefined olabilir)
  /**
   * The server auth code. Useful for requesting offline access tokens.
   */
  // serverAuthCode?: string; // Gerekirse etkinleştirilebilir
}

export interface GoogleAuthPlugin {
  /**
   * Initiate the Google Sign-In flow.
   */
  signIn(): Promise<GoogleUser>;

  /**
   * Tries to sign in silently without user interaction.
   * Resolves with user data if successful.
   * Rejects if silent sign-in fails (e.g., user needs to sign in manually).
   * Common rejection codes: 'SIGN_IN_REQUIRED'
   */
  trySilentSignIn(): Promise<GoogleUser>;

  /**
   * Sign the user out.
   */
  signOut(): Promise<void>;

  /**
   * Creates a new event in the user's primary Google Calendar.
   * Requires CALENDAR_EVENTS_SCOPE.
   */
  createCalendarEvent(options: CalendarEventOptions): Promise<CalendarEventResponse>;

  /**
   * Searches for events in the user's primary Google Calendar matching the provided AppID.
   * Requires CALENDAR_EVENTS_SCOPE.
   */
  searchCalendarEvents(options: CalendarSearchOptions): Promise<CalendarSearchResponse>;

  /**
   * Attempt to sign in silently without user interaction.
   * Returns the user if already signed in, otherwise null.
   */
  // trySilentSignIn(): Promise<GoogleUser | null>; // Gerekirse eklenebilir
}

export interface CalendarEventOptions {
  accessToken: string;
  summary: string;
  description: string;
  startTimeIso: string;
  endTimeIso: string;
  timeZone: string;
}

export interface CalendarSearchOptions {
  accessToken: string;
  appId: string;
}

export interface CalendarEventResponse {
  id: string;
  htmlLink?: string;
  summary?: string;
  // Native plugin'den dönebilecek diğer alanlar...
}

export interface CalendarSearchResponse {
  eventFound: boolean;
  // Native plugin'den dönebilecek diğer alanlar...
} 