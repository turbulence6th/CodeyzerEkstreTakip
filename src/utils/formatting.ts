/**
 * Verilen tarihi 'DD Ay YYYY' formatında string'e çevirir.
 * Geçersiz veya null tarihleri '-' veya hata mesajı olarak döndürür.
 */
export const formatDate = (date: Date | undefined | null): string => {
    if (!date) return '-';
    // Gelen date string ise Date objesine çevir
    if (!(date instanceof Date)) {
        try {
            const parsed = new Date(date);
            if (isNaN(parsed.getTime())) return 'Geçersiz Tarih';
            date = parsed;
        } catch (e) {
            return 'Geçersiz Tarih';
        }
    } else if (isNaN(date.getTime())) {
        return 'Geçersiz Tarih';
    }
    
    try {
        return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
        console.error("Error formatting date:", date, e);
        return 'Tarih Hatası'; 
    }
};

/**
 * Verilen sayıyı Türkçe para formatına (₺X.XXX,XX) çevirir.
 * Null veya undefined değerleri '-' olarak döndürür.
 */
export const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '-';
    try {
        return amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });
    } catch (e) {
         console.error("Error formatting currency:", amount, e);
         return 'Tutar Hatası';
    }
};

/**
 * Verilen tarihi YYYY-MM-DD formatına çevirir.
 * Google Takvim aramaları için kullanılır.
 */
export const formatTargetDate = (date: Date): string => {
    // Gelen date string ise Date objesine çevir (güvenlik için)
     if (!(date instanceof Date)) {
        try {
            const parsed = new Date(date);
            if (isNaN(parsed.getTime())) throw new Error('Invalid date string');
            date = parsed;
        } catch (e) {
            console.error("Error parsing date in formatTargetDate:", date);
            return 'invalid-date'; 
        }
    } else if (isNaN(date.getTime())) {
         console.error("Invalid Date object in formatTargetDate:", date);
         return 'invalid-date';
    }

    try {
        const pad = (num: number) => num.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    } catch (e) {
        console.error("Error formatting target date:", date, e);
        return 'format-error';
    }
}; 