import { useState } from 'react';
import { ocrService } from '../services/ocr.service';
import { screenshotProcessor } from '../services/screenshot-parsing/screenshot-processor';
import type { ParsedStatement } from '../services/sms-parsing/types';

/**
 * Screenshot Import Hook
 *
 * Ekran görüntüsünden ekstre bilgilerini çıkarır
 */
export const useScreenshotImport = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Galeriden ekran görüntüsü seç ve parse et
     */
    const importFromGallery = async (): Promise<ParsedStatement | null> => {
        setIsProcessing(true);
        setError(null);

        try {
            // 1. OCR ile metin çıkar
            const ocrResult = await ocrService.recognizeFromGallery();

            if (!ocrResult.success || !ocrResult.text) {
                setError(ocrResult.error || 'Metin okunamadı');
                setIsProcessing(false);
                return null;
            }

            console.log('OCR Extracted Text:', ocrResult.text);

            // 2. Screenshot processor ile parse et
            const parsed = await screenshotProcessor.processScreenshot(ocrResult.text);

            if (!parsed) {
                setError('Ekstre bilgileri tanınamadı. Desteklenen bankalar: ' +
                    screenshotProcessor.getSupportedBanks().join(', '));
                setIsProcessing(false);
                return null;
            }

            setIsProcessing(false);
            return parsed;

        } catch (err: any) {
            console.error('Screenshot import error:', err);
            setError(err.message || 'Beklenmeyen bir hata oluştu');
            setIsProcessing(false);
            return null;
        }
    };

    /**
     * Kameradan fotoğraf çek ve parse et
     */
    const importFromCamera = async (): Promise<ParsedStatement | null> => {
        setIsProcessing(true);
        setError(null);

        try {
            // 1. OCR ile metin çıkar
            const ocrResult = await ocrService.recognizeFromCamera();

            if (!ocrResult.success || !ocrResult.text) {
                setError(ocrResult.error || 'Metin okunamadı');
                setIsProcessing(false);
                return null;
            }

            console.log('OCR Extracted Text:', ocrResult.text);

            // 2. Screenshot processor ile parse et
            const parsed = await screenshotProcessor.processScreenshot(ocrResult.text);

            if (!parsed) {
                setError('Ekstre bilgileri tanınamadı. Desteklenen bankalar: ' +
                    screenshotProcessor.getSupportedBanks().join(', '));
                setIsProcessing(false);
                return null;
            }

            setIsProcessing(false);
            return parsed;

        } catch (err: any) {
            console.error('Screenshot import error:', err);
            setError(err.message || 'Beklenmeyen bir hata oluştu');
            setIsProcessing(false);
            return null;
        }
    };

    /**
     * Desteklenen bankaların listesini al
     */
    const getSupportedBanks = (): string[] => {
        return screenshotProcessor.getSupportedBanks();
    };

    return {
        importFromGallery,
        importFromCamera,
        isProcessing,
        error,
        getSupportedBanks,
    };
};
