import type { ParsedStatement } from '../services/sms-parsing/types';
import type { ManualEntry } from '../types/manual-entry.types';
import { formatTargetDate } from './formatting'; // Tarih formatlama fonksiyonunu import edelim
import { isStatement, isManualEntry } from './typeGuards';

type InputItem = ParsedStatement | ManualEntry;

// Ortak Yardımcı Fonksiyon: Metni normalize eder ve temizler
function normalizeAndSanitizeText(text: string, spaceReplacement: string = ''): string {
    if (!text) return 'unknown'; // Veya spaceReplacement'a göre 'unknown' veya 'unknown_bank'?
                                // Şimdilik çağıran fonksiyonlar boş kontrolü yapıyor.
    const lowerCaseText = text.toLowerCase();
    const turkishReplaced = lowerCaseText
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c');

    const spaceRegex = /\s+/g;
    const spacesProcessed = turkishReplaced.replace(spaceRegex, spaceReplacement);

    // spaceReplacement'ın kendisi de geçerli karakterler arasında olmalı
    const allowedCharsRegex = new RegExp(`[^a-z0-9${spaceReplacement === '_' ? '_' : ''}]`, 'g');
    const sanitized = spacesProcessed.replace(allowedCharsRegex, '');

    // Eğer spaceReplacement '', ve sonuç boş string ise 'unknown' dönelim?
    if (spaceReplacement === '' && sanitized === '') {
        return 'unknown';
    }
    // Eğer spaceReplacement '_', ve sonuç sadece '_' ise veya boşsa 'unknown_bank' dönelim?
    if (spaceReplacement === '_' && (sanitized === '_' || sanitized === '')) {
         return 'unknown_bank';
    }

    return sanitized;
}

// Metni AppID için uygun formata getirir (küçük harf, TR->EN, boşluksuz, sadece alfanumerik)
function sanitizeForAppId(text: string): string {
    // Boşluk yerine boş string ('') göndererek boşlukların kaldırılmasını sağla
    return normalizeAndSanitizeText(text, '');
}

// Banka adını AppID için uygun formata getirir (küçük harf, TR->EN, boşluk yerine _, sadece alfanumerik ve _)
function sanitizeBankName(text: string): string {
    // Boşluk yerine alt çizgi ('_') gönder
    return normalizeAndSanitizeText(text, '_');
}

/**
 * Verilen öğe için belirtilen formatta benzersiz bir AppID oluşturur.
 * @param item Ekstre, Kredi veya Manuel Kayıt öğesi.
 * @param installmentNumber Kredi taksidi ise taksit numarası (isteğe bağlı).
 * @returns Oluşturulan AppID string'i (örn: "[AppID: ekstre_yapikredi_2024-07-15]") veya null (gerekli bilgi eksikse).
 */
export function generateAppId(item: InputItem, installmentNumber?: number): string | null {
    let type: string;
    let namePart: string;
    let date: Date | null = null;

    if (isManualEntry(item)) {
        type = 'manuel';
        namePart = sanitizeForAppId(item.description);
        date = item.dueDate instanceof Date ? item.dueDate : null;
    } else if (isStatement(item)) {
        type = 'ekstre'; // Kredi taksitleri de bu yola girecek
        namePart = sanitizeBankName(item.bankName);
        date = item.dueDate instanceof Date ? item.dueDate : null;
    } else {
        console.warn('generateAppId: Unknown item type after all guards', item);
        return null;
    }

    if (!date) {
        console.warn(`generateAppId: Date is missing for ${type} item`, item);
        return null; // Tarih olmadan ID üretemeyiz
    }

    const dateString = formatTargetDate(date); // YYYY-MM-DD formatı

    // Krediler artık statement olduğu için, taksit numarası ayıklamaya gerek yok, bankName'de var.
    return `[AppID: ${type}_${namePart}_${dateString}]`;
} 