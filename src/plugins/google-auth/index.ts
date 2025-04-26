import { registerPlugin } from '@capacitor/core';

import type { GoogleAuthPlugin, GoogleUser } from './definitions';

const GoogleAuth = registerPlugin<GoogleAuthPlugin>('GoogleAuth', {
  web: () => import('./web').then(m => new m.GoogleAuthWeb()),
});

export * from './definitions';
export { GoogleAuth };
export type { GoogleUser }; 