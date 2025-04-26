/**
 * Standart sayı formatını (örn: 1,800.50) parse eder.
 * Virgül binlik ayıracı, nokta ondalık ayıracıdır.
 */
export function parseStandardNumber(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const commaRemoved = text.replace(/,/g, '');
    const number = parseFloat(commaRemoved);
    return isNaN(number) ? null : number;
  } catch (error) {
    console.error("Error parsing standard number:", text, error);
    return null;
  }
}

/**
 * Türkçe sayı formatını (örn: 15.000,00) parse eder.
 * Nokta binlik ayıracı, virgül ondalık ayıracıdır.
 */
export function parseTurkishNumber(text: string | null | undefined): number | null {
  if (!text) return null;
  try {
    const dotRemoved = text.replace(/\./g, ''); 
    const commaToDot = dotRemoved.replace(/,/g, '.'); 
    const number = parseFloat(commaToDot);
    return isNaN(number) ? null : number;
  } catch (error) {
    console.error("Error parsing Turkish number:", text, error);
    return null;
  }
}

/**
 * DD/MM/YYYY formatındaki tarihi Date objesine çevirir.
 */
export function parseDMYDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const parts = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!parts) return null;
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1; // Ay 0'dan başlar
    const year = parseInt(parts[3], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year) || month < 0 || month > 11 || day < 1 || day > 31) return null;
    const date = new Date(year, month, day, 12, 0, 0, 0); 
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
    return date;
  } catch (error) {
    console.error("Error parsing DD/MM/YYYY date:", dateStr, error);
    return null;
  }
}

/**
 * Türkçe tarih formatını (DD Ay YYYY) Date objesine çevirir.
 */
const turkishMonths: { [key: string]: number } = {
    'ocak': 0, 'şubat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'haziran': 5,
    'temmuz': 6, 'ağustos': 7, 'eylül': 8, 'ekim': 9, 'kasım': 10, 'aralık': 11
};
export function parseTurkishDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    try {
        const parts = dateStr.trim().toLowerCase().split(' ');
        if (parts.length !== 3) return null;
        const day = parseInt(parts[0], 10);
        const monthName = parts[1];
        const year = parseInt(parts[2], 10);
        const month = turkishMonths[monthName];

        if (isNaN(day) || isNaN(year) || month === undefined || month < 0 || month > 11 || day < 1 || day > 31) return null;
        const date = new Date(year, month, day, 12, 0, 0, 0);
        if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
        return date;
    } catch (error) {
        console.error("Error parsing Turkish date:", dateStr, error);
        return null;
    }
}

/**
 * DD.MM.YYYY formatındaki tarihi Date objesine çevirir.
 */
export function parseDottedDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const parts = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/); // Nokta ile ayrılmış
    if (!parts) return null;
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1; // Ay 0'dan başlar
    const year = parseInt(parts[3], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year) || month < 0 || month > 11 || day < 1 || day > 31) return null;
    const date = new Date(year, month, day, 12, 0, 0, 0); 
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
    return date;
  } catch (error) {
    console.error("Error parsing DD.MM.YYYY date:", dateStr, error);
    return null;
  }
} 