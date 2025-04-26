import { BankSmsParser, ParsedStatement, SmsDetails } from "../types";

// Türkçe sayı formatını ayrıştırma (Nokta=Binlik, Virgül=Ondalık örn: 1.492,42)
function parseTurkishNumber(text: string): number | null {
  if (!text) return null;
  try {
    // 1. Binlik ayıracı olan noktaları kaldır
    const dotRemoved = text.replace(/\./g, '');
    // 2. Ondalık ayıracı olan virgülü noktaya çevir
    const commaToDot = dotRemoved.replace(/,/g, '.');
    // 3. parseFloat ile sayıyı ayrıştır
    const number = parseFloat(commaToDot);
    return isNaN(number) ? null : number;
  } catch (error) {
    console.error("Error parsing Turkish number:", text, error);
    return null;
  }
}

// DD.MM.YYYY formatını Date objesine çevirme (saat dilimine dikkat!)
function parseDottedDate(dateStr: string): Date | null {
    try {
      const parts = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (!parts) return null;
      // JavaScript Date ay parametresi 0'dan başlar (0 = Ocak)
      const day = parseInt(parts[1], 10);
      const month = parseInt(parts[2], 10) - 1;
      const year = parseInt(parts[3], 10);

      // Tarihin geçerliliğini basitçe kontrol et
      if (month < 0 || month > 11 || day < 1 || day > 31) return null;

      // Yerel saat dilimine göre oluştur, saati öğlen yapalım ki gün değişimi sorun olmasın
      const date = new Date(year, month, day, 12, 0, 0, 0);
      // Eğer oluşturulan tarih, parse edilen yılla eşleşmiyorsa geçersizdir.
      if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
          return null;
      }
      return date;
    } catch (error) {
      console.error("Error parsing dotted date:", dateStr, error);
      return null;
    }
  }


export class KuveytTurkSmsParser implements BankSmsParser {
  bankName = "Kuveyt Türk";
  // Gönderici isimlerini küçük harfe çevirip kontrol edeceğiz
  relevantSenders = ["kuveyt turk"];

  canParse(sender: string, body: string): boolean {
    const lowerCaseSender = sender.toLowerCase();
    // Gönderici bizim listemizde mi?
    const isRelevantSender = this.relevantSenders.some(s => lowerCaseSender.includes(s));
    if (!isRelevantSender) {
      return false;
    }
    // Mesaj içeriği beklenen anahtar kelimeleri içeriyor mu?
    const lowerCaseBody = body.toLowerCase();
    return lowerCaseBody.includes("ile biten kartinizin ekstresi kesildi") &&
           lowerCaseBody.includes("son odeme tarihi:");
  }

  parse(message: SmsDetails): ParsedStatement | null {
    if (!this.canParse(message.sender, message.body)) {
      return null;
    }

    try {
      // Son ödeme tarihini bul (DD.MM.YYYY)
      const dateMatch = message.body.match(/Son Odeme Tarihi: (\d{2}\.\d{2}\.\d{4})/i);
      const dueDate = dateMatch ? parseDottedDate(dateMatch[1]) : null;

      // Dönem borcunu bul (1.492,42 TL formatı)
      const amountRegex = /Toplam Borc: ([\d.,]+) TL/i;
      const amountMatch = message.body.match(amountRegex);

      let amount: number | null = null;
      if (amountMatch && amountMatch[1]) {
        amount = parseTurkishNumber(amountMatch[1]);
      }

      // Kartın son 4 hanesini bul (opsiyonel)
      const cardMatch = message.body.match(/(\d{4}) ile biten kartinizin/i);
      const last4Digits = cardMatch ? cardMatch[1] : undefined;

      // Son ödeme tarihi mutlaka bulunmalı
      if (!dueDate) {
        console.warn(`[${this.bankName}] Could not parse due date from: ${message.body}`);
        return null;
      }

      return {
        bankName: this.bankName,
        dueDate: dueDate,
        amount: amount, // Borç null olabilir
        last4Digits: last4Digits,
        originalMessage: message,
        source: 'sms'
      };
    } catch (error) {
      console.error(`[${this.bankName}] Error parsing message:`, message, error);
      return null;
    }
  }
} 