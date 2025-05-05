import * as mod from 'redux-persist-transform-encrypt';
import type { Transform } from 'redux-persist';
import type { EncryptTransformConfig } from 'redux-persist-transform-encrypt';

// Named veya default export'u alacak şekilde CJS/ESM interop
const encryptTransform: (config: EncryptTransformConfig) => Transform<any, any> =
  // @ts-ignore
  (mod as any).encryptTransform || (mod as any).default || (mod as any);

export default encryptTransform; 