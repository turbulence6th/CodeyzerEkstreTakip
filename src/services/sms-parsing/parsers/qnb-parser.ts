import { BankSmsParser, ParsedStatement, SmsDetails } from "../types";
import { parseStandardNumber, parseDMYDate } from "../../../utils/parsing"; 

export class QnbSmsParser implements BankSmsParser {
  private bankName = "QNB";
  // Gönderici isimlerini küçük harfe çevirip kontrol edeceğiz
  private relevantSenders = ["qnb", "qnb finans", "qnb finansbank"];

  canParse(sender: string, body: string): boolean {
    const lowerCaseSender = sender.toLowerCase();
    // Gönderici bizim listemizde mi?
    const isRelevantSender = this.relevantSenders.some(s => lowerCaseSender.includes(s));
    if (!isRelevantSender) {
      return false;
    }
    // Mesaj içeriği beklenen anahtar kelimeleri içeriyor mu?
    const lowerCaseBody = body.toLowerCase();
    return lowerCaseBody.includes("ile biten kartinizin borcu") &&
           lowerCaseBody.includes("son odeme tarihi");
           // "asgari borcu" gibi ek kontroller de eklenebilir.
  }

  parse(message: SmsDetails): ParsedStatement | null {
    if (!this.canParse(message.sender, message.body)) {
      return null;
    }

    try {
      // Son ödeme tarihini bul (DD/MM/YYYY)
      const dateMatch = message.body.match(/son odeme tarihi (\d{2}\/\d{2}\/\d{4})/i);
      const dueDate = dateMatch ? parseDMYDate(dateMatch[1]) : null;

      // Dönem borcunu bul (1,800.50 formatı)
      const amountRegex = /kartinizin borcu ([\d.,]+)\s*TL/i;
      const amountMatch = message.body.match(amountRegex);

      let amount: number | null = null;
      if (amountMatch && amountMatch[1]) {
        const rawAmountString = amountMatch[1];
        amount = parseStandardNumber(rawAmountString);
      }

      // Kartın son 4 hanesini bul (opsiyonel)
      const cardMatch = message.body.match(/(\d{4}) ile biten kartinizin/i);
      const last4Digits = cardMatch ? cardMatch[1] : undefined;

      // Son ödeme tarihi mutlaka bulunmalı
      if (!dueDate) {
        console.warn(`[${this.bankName}] Could not parse due date from: ${message.body}`);
        return null;
      }

      if (dueDate && (amount !== null || last4Digits)) {
        return {
          bankName: this.bankName,
          dueDate: dueDate,
          amount: amount,
          last4Digits: last4Digits,
          originalMessage: message,
          source: 'sms',
          entryType: 'debt',
        };
      }
      return null;
    } catch (error) {
      console.error(`[${this.bankName}] Error parsing message:`, message, error);
      return null;
    }
  }
} 