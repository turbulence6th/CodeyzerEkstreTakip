import { registerPlugin } from '@capacitor/core';

import type { PdfParserPlugin } from './definitions';

const PdfParser = registerPlugin<PdfParserPlugin>('PdfParser', {
  web: () => import('./web').then(m => new m.PdfParserWeb()),
});

export * from './definitions';
export { PdfParser }; 