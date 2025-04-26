import type { ParsedLoan, SmsDetails } from '../types';

// Yardımcı fonksiyon: Türkçe sayı formatını ayrıştırma (Nokta=Binlik, Virgül=Ondalık örn: 15.000)
// Kredi SMS'inde ondalık kısım olmayabilir, fonksiyonu buna göre uyarlamak gerekebilir.
function parseTurkishInteger(text: string): number | null {
    if (!text) return null;
    try {
      // Binlik ayıracı olan noktaları kaldır
      const dotRemoved = text.replace(/\./g, '');
      // Virgül varsa hata ver (veya ondalık olarak işle?) - Şimdilik tam sayı varsayalım
      if (dotRemoved.includes(',')) {
           console.warn("[GarantiLoanParser] Unexpected comma found in integer amount:", text);
           return null;
      }
      const number = parseInt(dotRemoved, 10);
      return isNaN(number) ? null : number;
    } catch (error) {
      console.error("[GarantiLoanParser] Error parsing Turkish integer:", text, error);
      return null;
    }
}


export const garantiLoanParser = {
    bankName: "Garanti BBVA",

    canParse(sender: string, body: string): boolean {
        const lowerSender = sender.toLowerCase();
        const lowerBody = body.toLowerCase();
        return (
            lowerSender.includes('garantibbva') &&
            lowerBody.includes('tutarinda') && // 'tutarında' yerine
            lowerBody.includes('ay vadeli') &&
            lowerBody.includes('ihtiyac krediniz') && // 'ihtiyaç' yerine
            lowerBody.includes('kullaniminiza acilmistir') // 'kullanımınıza açılmıştır' yerine
        );
    },

    parse(message: SmsDetails): ParsedLoan | null {
        if (!this.canParse(message.sender, message.body)) {
            return null;
        }

        try {
            // Kredi Tutarını Çıkar (10.000 TL)
            // Regex, hem 10.000 hem de 10000 gibi formatları yakalayabilir
            const loanAmountMatch = message.body.match(/([\d.]+) TL tutarinda/i);
            const loanAmount = loanAmountMatch ? parseTurkishInteger(loanAmountMatch[1]) : null;

            // Vadeyi Çıkar (3 ay)
            const termMatch = message.body.match(/(\d+) ay vadeli/i);
            const termMonths = termMatch ? parseInt(termMatch[1], 10) : null;

            // Diğer bilgiler SMS'te yok
            const installmentAmount = null;
            const firstPaymentDate = null; // SMS'te tarih yok
            const accountNumber = undefined;

            // Gerekli alanlar ayrıştırılabildiyse sonucu döndür
            // Bu SMS formatında firstPaymentDate zorunlu olmamalı
            if (loanAmount !== null && termMonths !== null) {
                // firstPaymentDate null olabileceği için Date kontrolü yapma
                 // Başarılı parse logu
                 console.log(`[${this.bankName}] Successfully parsed loan from SMS.`);

                return {
                    bankName: this.bankName,
                    loanAmount,
                    installmentAmount, // null olacak
                    termMonths,
                    firstPaymentDate, // null olacak
                    accountNumber, // undefined olacak
                    originalMessage: message,
                    source: 'sms'
                };
            } else {
                 // Ayrıştırma başarısız logu
                 console.warn(`[${this.bankName}] Could not parse required fields (loanAmount, termMonths) from SMS: ${message.body}`);
            }
        } catch (error) {
            console.error(`[${this.bankName}] Error parsing message: ${message.body}`, error);
        }

        return null;
    },
}; 