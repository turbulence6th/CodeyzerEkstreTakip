import { BankEmailParser, ParsedStatement, EmailDetails, DecodedEmailBody } from '../../sms-parsing/types'; // Tipleri sms-parsing'den alıyoruz
import { gmailService } from '../../index'; // Gmail servisi
// import { Plugins } from '@capacitor/core'; // Eski import
import { parseTurkishNumber } from '../../../utils/parsing'; // Sayı ayrıştırma yardımcısını ekle

// Varsayımsal PdfParser plugin tanımını import edelim
import { ParsePdfResult, PdfParser } from '@plugins/pdf-parser';

// Bu parser, PDF'ten çıkarılan *ham metni* işleyecek asıl mantığı içerecek.
async function parseExtractedPdfText(pdfText: string, emailDetails: EmailDetails): Promise<ParsedStatement | null> {
    const emailId = emailDetails.id; // Loglama için ID alalım

    const dueDateRegex = /Son Ödeme Tarihi\s*:\s*(\d{2}\.\d{2}\.\d{4})/i;
    const amountRegex = /Hesap Özeti Borcu\s*:\s*([\d.,]+)\s*TL/i;
    // Kart numarasının son 4 hanesini yakalamak için regex (XXXX********XXXX formatı)
    const cardLast4Regex = /\b(\d{4})\s*\*{4}\s*\*{4}\s*(\d{4})\b/; // İlk 4 ve son 4'ü yakalar

    const dueDateMatch = pdfText.match(dueDateRegex);
    const amountMatch = pdfText.match(amountRegex);
    const cardMatch = pdfText.match(cardLast4Regex);

    let last4Digits: string | undefined = undefined;
    if (cardMatch && cardMatch[2]) {
        last4Digits = cardMatch[2];
        console.log(`[Isbank PDF Parser - ${emailId}] Found last 4 digits: ${last4Digits}`);
    } else {
        console.warn(`[Isbank PDF Parser - ${emailId}] Could not find card number pattern (XXXX********XXXX) in extracted PDF text.`);
    }

    if (dueDateMatch && dueDateMatch[1] && amountMatch && amountMatch[1]) {
        try {
            const dateString = dueDateMatch[1]; // DD.MM.YYYY
            const amountString = amountMatch[1]; // Örn: 2.001,44

            const dateParts = dateString.split('.');
            if (dateParts.length !== 3) {
                console.error(`[Isbank PDF Parser - ${emailId}] Invalid date format found in PDF: ${dateString}`);
                return null;
            }
            const day = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // Ay 0-indexli
            const year = parseInt(dateParts[2], 10);
            const dueDate = new Date(Date.UTC(year, month, day)); // UTC olarak oluştur

            const amount = parseTurkishNumber(amountString);

            if (isNaN(dueDate.getTime())) {
                 console.error(`[Isbank PDF Parser - ${emailId}] Invalid date parsed from PDF parts: ${dateString}`);
                 return null;
            }
             if (amount === null || isNaN(amount)) {
                 console.error(`[Isbank PDF Parser - ${emailId}] Invalid amount parsed from PDF string: ${amountString}`);
                 return null;
             }

            console.log(`[Isbank PDF Parser - ${emailId}] Successfully parsed from PDF.`);
            // Dönüş objesine last4Digits'i ekle (varsa)
            const parsedData: ParsedStatement = {
                bankName: 'İş Bankası',
                amount: amount,
                dueDate: dueDate,
                source: 'email',
                originalMessage: emailDetails,
                last4Digits: last4Digits
            };
            return parsedData;

        } catch (e) {
            console.error(`[Isbank PDF Parser - ${emailId}] Error parsing extracted values from PDF:`, e);
        }
    } else {
        if (!dueDateMatch) console.warn(`[Isbank PDF Parser - ${emailId}] Could not find 'Son Ödeme Tarihi' pattern in extracted PDF text.`);
        if (!amountMatch) console.warn(`[Isbank PDF Parser - ${emailId}] Could not find 'Hesap Özeti Borcu' pattern in extracted PDF text.`);
    }

    return null;
}

// Helper function to convert Base64URL to standard Base64
function base64UrlToStandardBase64(base64Url: string): string {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if necessary
    while (base64.length % 4) {
        base64 += '=';
    }
    return base64;
}

class IsbankEmailParser implements BankEmailParser {
    bankName = 'İş Bankası';

    // canParse: Sadece gönderici ve konu formatını kontrol et (async olmasına gerek yok)
    // Interface'e uygun olarak 4. parametreyi kaldırdık.
    canParse(sender: string, subject: string, body: DecodedEmailBody): boolean {
        const isCorrectSender = sender.includes('bilgilendirme@ileti.isbank.com.tr');
        // Konunun değişken kısmını tolere et (örn. kart no, ay/yıl)
        const subjectRegex = /^(.*?)\d{4}\s\*{4}\s\*{4}\s\d{4}\s-\s.*?\d{4}\s(.*?)Kredi\sKartı\sHesap\sÖzeti$/i;
        const isCorrectSubjectFormat = subjectRegex.test(subject);

        // Body içeriğine bakmaya gerek yok, PDF kontrolü parse içinde yapılacak.
        return isCorrectSender && isCorrectSubjectFormat;
    }

    // parse (async yaptık)
    async parse(emailDetails: EmailDetails): Promise<ParsedStatement | null> {
        const emailId = emailDetails.id;

        const parts = emailDetails.originalResponse?.payload?.parts;
        if (!parts) {
            return null;
        }

        const pdfPart = parts.find(
            (part: any) => part.mimeType === 'application/octet-stream' && part.filename?.toLowerCase().endsWith('.pdf') && part.body?.attachmentId
        );

        if (!pdfPart || !pdfPart.body?.attachmentId) {
            return null;
        }

        const attachmentId = pdfPart.body.attachmentId;

        try {
            const attachmentResponse = await gmailService.getAttachment(emailId, attachmentId);

            let base64PdfDataUrl: string | null = null;
            if (attachmentResponse?.size !== undefined && attachmentResponse?.data && typeof attachmentResponse.data === 'string') {
                 base64PdfDataUrl = attachmentResponse.data;
            } else {
                console.error(`[Isbank Parser - ${emailId}] Failed to get Base64 data from attachment response. Unexpected format:`, attachmentResponse);
                return null;
            }

            if (!base64PdfDataUrl) {
                 console.error(`[Isbank Parser - ${emailId}] Extracted base64PdfDataUrl is null or empty. Aborting.`);
                 return null;
             }
            
            const base64PdfDataStandard = base64UrlToStandardBase64(base64PdfDataUrl);

            if (typeof PdfParser.parsePdfText !== 'function') {
                 console.error(`[Isbank Parser - ${emailId}] PdfParser plugin is registered but 'parsePdfText' method is missing.`);
                 return null;
            }

            const result: ParsePdfResult = await PdfParser.parsePdfText({ base64Data: base64PdfDataStandard });

            if (result.text) {
                return await parseExtractedPdfText(result.text, emailDetails);
            } else if (result.error) {
                console.error(`[Isbank Parser - ${emailId}] Native PDF parsing failed (likely corrupt PDF data from API): ${result.error}`);
                return null;
            } else {
                console.error(`[Isbank Parser - ${emailId}] Unknown response from PdfParser plugin (neither text nor error).`);
                return null;
            }

        } catch (error: any) {
            console.error(`[Isbank Parser - ${emailId}] Error during PDF processing pipeline (fetching or parsing):`, error);
             if (error?.message) {
                console.error(`Error message details: ${error.message}`);
             }
            return null;
        }
    }
}

export const isbankEmailParser = new IsbankEmailParser(); 