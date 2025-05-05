declare module 'redux-persist-transform-encrypt' {
  import type { Transform } from 'redux-persist';

  export interface EncryptTransformConfig {
    /**
     * Secret key or function returning a key (sync or async)
     */
    secretKey: string | (() => string | Promise<string>);
    /**
     * Hata durumunda çağrılacak fonksiyon
     */
    onError?(error: Error): void;
  }

  /**
   * Redux Persist için encrypt transform oluşturur
   */
  export function encryptTransform(
    config: EncryptTransformConfig
  ): Transform;
} 