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

  // --- GMAIL METODLARI ---
  /**
   * Searches messages matching the query.
   * Requires GMAIL_READONLY_SCOPE.
   * Returns a ListMessagesResponse object (containing message IDs).
   */
  searchGmailMessages(options: GmailSearchOptions): Promise<GmailSearchResponse>;

  /**
   * Gets the full details of a specific message.
   * Requires GMAIL_READONLY_SCOPE.
   * Returns a Message object.
   */
  getGmailMessageDetails(options: GmailDetailsOptions): Promise<GmailMessage>;

  /**
   * Gets the content of a specific attachment.
   * Requires GMAIL_READONLY_SCOPE.
   * Returns a MessagePartBody object (data is base64url encoded).
   */
  getGmailAttachment(options: GmailAttachmentOptions): Promise<GmailAttachmentResponse>;

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

// --- GMAIL ARAYÜZLERİ ---

// searchGmailMessages için Opsiyonlar
export interface GmailSearchOptions {
  accessToken: string;
  query: string;
  // maxResults?: number; // Opsiyonel, native tarafta implemente edilirse eklenebilir
  // pageToken?: string; // Opsiyonel
}

// searchGmailMessages için Yanıt (Gmail API ListMessagesResponse yapısına benzer)
export interface GmailSearchResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

// getGmailMessageDetails için Opsiyonlar
export interface GmailDetailsOptions {
  accessToken: string;
  messageId: string;
}

// getGmailMessageDetails için Yanıt (Gmail API Message yapısına benzer)
// Not: Bu arayüzü ihtiyaca göre detaylandırabilirsiniz.
// Tam Gmail API Message tipi oldukça karmaşıktır.
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string; // epoch ms string
  payload?: GmailMessagePayload;
  sizeEstimate?: number;
  raw?: string; // base64url
}

export interface GmailMessagePayload {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: GmailMessagePartBody;
  parts?: GmailMessagePayload[];
}

// getGmailAttachment için Yanıt (ve Message Payload Body) (Gmail API MessagePartBody)
export interface GmailMessagePartBody {
  attachmentId?: string;
  size?: number;
  data?: string; // base64url encoded
}
export type GmailAttachmentResponse = GmailMessagePartBody;

// getGmailAttachment için Opsiyonlar
export interface GmailAttachmentOptions {
  accessToken: string;
  messageId: string;
  attachmentId: string;
} 