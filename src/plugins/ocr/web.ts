import { WebPlugin } from '@capacitor/core';
import type { OcrPlugin, RecognizeTextOptions, RecognizeTextResult } from './definitions';

export class OcrWeb extends WebPlugin implements OcrPlugin {
  async recognizeText(options: RecognizeTextOptions): Promise<RecognizeTextResult> {
    console.warn('OCR is not supported on web platform. This is a mock implementation.');

    // Web üzerinde test için mock veri döndür
    // Gerçek uygulamada Tesseract.js gibi bir web OCR kütüphanesi kullanılabilir
    return {
      success: false,
      text: '',
      error: 'OCR is only available on native platforms (Android/iOS)',
      metadata: {
        confidence: 0,
      }
    };
  }
}
