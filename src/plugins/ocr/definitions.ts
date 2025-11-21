export interface OcrPlugin {
  /**
   * Görüntüden OCR ile metin çıkarır
   * @param options OCR seçenekleri
   * @returns Çıkarılan metin
   */
  recognizeText(options: RecognizeTextOptions): Promise<RecognizeTextResult>;
}

export interface RecognizeTextOptions {
  /**
   * Görüntünün base64 formatındaki verisi
   * Kamera veya galeri plugin'inden alınan path de olabilir
   */
  imageSource: string;

  /**
   * Görüntü kaynağı tipi
   * - 'base64': Base64 encoded string
   * - 'path': Dosya yolu (file://)
   */
  sourceType?: 'base64' | 'path';
}

export interface RecognizeTextResult {
  /**
   * Çıkarılan metin
   */
  text: string;

  /**
   * İşlem başarılı mı
   */
  success: boolean;

  /**
   * Hata mesajı (varsa)
   */
  error?: string;

  /**
   * Ek metadata (opsiyonel)
   * Örn: güven skoru, algılanan dil, vs.
   */
  metadata?: {
    confidence?: number;
    language?: string;
    blocks?: TextBlock[];
  };
}

export interface TextBlock {
  /**
   * Metin bloğu
   */
  text: string;

  /**
   * Güven skoru (0-1)
   */
  confidence?: number;

  /**
   * Bounding box koordinatları
   */
  boundingBox?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}
