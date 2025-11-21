import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Ocr } from '../plugins/ocr';
import type { RecognizeTextResult } from '../plugins/ocr';

/**
 * OCR Service
 *
 * Kamera veya galeriden görüntü alır ve OCR ile metin çıkarır
 */
export class OcrService {
    /**
     * Galeriden resim seç ve OCR uygula
     */
    async recognizeFromGallery(): Promise<RecognizeTextResult> {
        try {
            // 1. Galeriden resim seç
            const photo = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Uri,
                source: CameraSource.Photos,
                promptLabelHeader: 'Ekstre Ekran Görüntüsü Seçin',
                promptLabelPhoto: 'Galeriden Seç',
            });

            if (!photo.path) {
                throw new Error('Görüntü seçilemedi');
            }

            // 2. OCR uygula
            const result = await Ocr.recognizeText({
                imageSource: photo.path,
                sourceType: 'path',
            });

            return result;
        } catch (error: any) {
            console.error('OCR Gallery Error:', error);
            return {
                success: false,
                text: '',
                error: error.message || 'Galeri erişim hatası',
            };
        }
    }

    /**
     * Kameradan fotoğraf çek ve OCR uygula
     */
    async recognizeFromCamera(): Promise<RecognizeTextResult> {
        try {
            // 1. Fotoğraf çek
            const photo = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Uri,
                source: CameraSource.Camera,
                promptLabelHeader: 'Ekstre Fotoğrafı Çek',
            });

            if (!photo.path) {
                throw new Error('Fotoğraf çekilemedi');
            }

            // 2. OCR uygula
            const result = await Ocr.recognizeText({
                imageSource: photo.path,
                sourceType: 'path',
            });

            return result;
        } catch (error: any) {
            console.error('OCR Camera Error:', error);
            return {
                success: false,
                text: '',
                error: error.message || 'Kamera erişim hatası',
            };
        }
    }

    /**
     * Base64 görüntüden OCR uygula
     */
    async recognizeFromBase64(base64Image: string): Promise<RecognizeTextResult> {
        try {
            const result = await Ocr.recognizeText({
                imageSource: base64Image,
                sourceType: 'base64',
            });

            return result;
        } catch (error: any) {
            console.error('OCR Base64 Error:', error);
            return {
                success: false,
                text: '',
                error: error.message || 'OCR işlemi başarısız',
            };
        }
    }
}

// Singleton instance export et
export const ocrService = new OcrService();
