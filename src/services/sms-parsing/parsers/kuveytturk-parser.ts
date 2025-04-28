import { parseDottedDate, parseTurkishNumber } from "utils/parsing";
import { BankSmsParser, ParsedStatement, SmsDetails } from "../types";

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