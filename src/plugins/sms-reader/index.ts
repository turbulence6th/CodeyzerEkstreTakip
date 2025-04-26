import { registerPlugin } from '@capacitor/core';

import type { SmsReaderPlugin } from './definitions';

const SmsReader = registerPlugin<SmsReaderPlugin>(
  'SmsReader', // Bu isim Java tarafındaki @CapacitorPlugin name ile eşleşmeli
  {
    web: () => import('./web').then(m => new m.SmsReaderWeb()),
  }
);

export * from './definitions';
export { SmsReader }; 