import { Capacitor } from '@capacitor/core';
import { gmailService as realGmailService } from './gmail.service'; // Rename import
import { calendarService as realCalendarService } from './calendar.service'; // Rename import
import { gmailServiceMock } from './gmail.service.mock'; // Keep mock name
import { calendarServiceMock } from './calendar.service.mock'; // Keep mock name

// Use typeof to get the type of the exported service instances
let gmailService: typeof realGmailService | typeof gmailServiceMock;
let calendarService: typeof realCalendarService | typeof calendarServiceMock;

const platform = Capacitor.getPlatform();
console.log(`[Services Index] Explicitly detected platform: ${platform}`);

if (platform === 'web') {
  console.log('[Services] Using MOCK services for Web platform.');
  gmailService = gmailServiceMock;
  calendarService = calendarServiceMock;
} else {
  console.log('[Services] Using REAL services for Native platform.');
  gmailService = realGmailService;
  calendarService = realCalendarService;
}

export { gmailService, calendarService }; 