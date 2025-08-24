import { BankSmsParser, ParsedStatement, SmsDetails, ParsedLoan } from "../types";
import { parseStandardNumber, parseTurkishNumber, parseDMYDate } from "../../../utils/parsing"; 

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

// --- QNB Kredi Onay Parser --- //

export const qnbLoanParser = {
    bankName: "QNB",

    // Bu parser'ın mesajı işleyip işleyemeyeceğini belirler
    canParse(sender: string, body: string): boolean {
        const lowerSender = sender.toLowerCase();
        const lowerBody = body.toLowerCase();
        return (
            (lowerSender === 'qnb' || lowerSender.includes('qnb finansbank')) &&
            lowerBody.includes('krediniz') &&
            lowerBody.includes('vadesiz hesabiniza yatirilmistir') &&
            lowerBody.includes('ilk taksitin odeme tarihi')
        );
    },

    // Mesajı ayrıştırır
    parse(message: SmsDetails): ParsedLoan | null {
        if (!this.canParse(message.sender, message.body)) {
            return null;
        }

        try {
            // Kredi Tutarını Çıkar (Türkçe formatta bekleniyor: 15.000,00 TL)
            const loanAmountMatch = message.body.match(/ (\d{1,3}(?:[.,]\d{3})*[.,]\d{2}) TL krediniz/i);
            const loanAmount = loanAmountMatch ? parseTurkishNumber(loanAmountMatch[1]) : null;

            // Taksit Tutarını Çıkar (Türkçe formatta bekleniyor: 5.179,22 TL)
            const installmentAmountMatch = message.body.match(/ (\d{1,3}(?:[.,]\d{3})*[.,]\d{2}) TL taksitli/i);
            const installmentAmount = installmentAmountMatch ? parseTurkishNumber(installmentAmountMatch[1]) : null;

            // Vadeyi Çıkar (3 ay)
            const termMatch = message.body.match(/ (\d+) ay vade/i);
            const termMonths = termMatch ? parseInt(termMatch[1], 10) : null;

            // İlk Ödeme Tarihini Çıkar (16/06/2025)
            const dateMatch = message.body.match(/ilk taksitin odeme tarihi (\d{2}\/\d{2}\/\d{4})/i);
            const firstPaymentDate = dateMatch ? parseDMYDate(dateMatch[1]) : null;

            // Hesap Numarasını Çıkar (108266946 no'lu)
            const accountMatch = message.body.match(/ (\d+) no'lu vadesiz/i);
            const accountNumber = accountMatch ? accountMatch[1] : undefined;

            // Gerekli alanlar ayrıştırılabildiyse sonucu döndür
            if (loanAmount !== null && installmentAmount !== null && termMonths !== null && firstPaymentDate instanceof Date) {
                return {
                    bankName: this.bankName,
                    loanAmount,
                    installmentAmount,
                    termMonths,
                    firstPaymentDate,
                    accountNumber,
                    originalMessage: message,
                    source: 'sms',
                    entryType: 'debt',
                };
            }
        } catch (error) {
            console.error(`[qnbLoanParser] Error parsing message: ${message.body}`, error);
        }

        return null;
    },
}; 