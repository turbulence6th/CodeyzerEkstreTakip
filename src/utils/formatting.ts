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

/**
 * Verilen tarihe belirtilen ay kadar ekler ve tarih taşmalarını (örn. 31 Ocak + 1 Ay) doğru yönetir.
 */
export const addMonths = (date: Date, months: number): Date => {
    const d = new Date(date);
    // Beklenen ay, taşma durumunu kontrol etmek için. JavaScript'te aylar 0-11 arasıdır.
    // Örneğin, 11 (Aralık) + 2 ay = 13. 13 % 12 = 1 (Şubat).
    const expectedMonth = (d.getMonth() + months) % 12;
    d.setMonth(d.getMonth() + months);
    
    // Eğer setMonth sonrası ay, beklenen aydan farklıysa, bu, ayın son gününden taşma olduğunu gösterir.
    // Örn: 31 Ocak'a 1 ay eklenince 31 Şubat (yok) yerine 2 Mart'a atlar. Bu durumda ay 2, beklenen 1 olur.
    // Bu durumda, tarihi bir önceki ayın son gününe (yani beklenen ayın son gününe) ayarlarız.
    if (d.getMonth() !== expectedMonth) {
        d.setDate(0); // setDate(0), bir önceki ayın son gününü verir.
    }
    return d;
}; 