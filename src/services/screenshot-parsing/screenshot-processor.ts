import type { BankScreenshotParser, ScreenshotDetails, ParsedStatement } from '../sms-parsing/types';
import { availableBankProcessors } from '../sms-parsing/sms-processor';

/**
 * Screenshot Processor Service
 *
 * OCR'dan gelen metni tüm kayıtlı banka parser'larına göndererek
 * hangi bankaya ait olduğunu otomatik tespit eder ve parse eder.
 */
export class ScreenshotProcessor {
    private parsers: BankScreenshotParser[] = [];

    constructor() {
        // availableBankProcessors'dan screenshot parser'ları topla
        this.parsers = availableBankProcessors
            .filter(processor => processor.screenshotParser)
            .map(processor => processor.screenshotParser!);

        console.log(`ScreenshotProcessor initialized with ${this.parsers.length} parsers:`,
            this.parsers.map(p => p.bankName));
    }

    /**
     * OCR metnini parse eder ve banka bilgilerini çıkarır
     *
     * @param extractedText OCR'dan gelen ham metin
     * @param imageUri Görüntünün URI'si (opsiyonel)
     * @returns ParsedStatement veya null
     */
    async processScreenshot(extractedText: string, imageUri?: string): Promise<ParsedStatement | null> {
        if (!extractedText || extractedText.trim().length === 0) {
            console.error('ScreenshotProcessor: Empty extracted text');
            return null;
        }

        const screenshot: ScreenshotDetails = {
            extractedText,
            imageUri,
            date: new Date(),
        };

        console.log('ScreenshotProcessor: Processing screenshot with text length:', extractedText.length);

        // Tüm parser'ları dene
        for (const parser of this.parsers) {
            try {
                if (parser.canParse(extractedText)) {
                    console.log(`ScreenshotProcessor: Matched parser for ${parser.bankName}`);

                    const result = parser.parse(screenshot);

                    if (result) {
                        console.log(`ScreenshotProcessor: Successfully parsed statement for ${parser.bankName}`,
                            { dueDate: result.dueDate, amount: result.amount, last4Digits: result.last4Digits });
                        return result;
                    } else {
                        console.warn(`ScreenshotProcessor: Parser ${parser.bankName} matched but parse failed`);
                    }
                }
            } catch (error) {
                console.error(`ScreenshotProcessor: Error with parser ${parser.bankName}:`, error);
            }
        }

        console.warn('ScreenshotProcessor: No matching parser found for the screenshot');
        return null;
    }

    /**
     * Desteklenen bankaların listesini döndürür
     */
    getSupportedBanks(): string[] {
        return this.parsers.map(p => p.bankName);
    }

    /**
     * Belirli bir banka için parser var mı kontrol eder
     */
    hasParserForBank(bankName: string): boolean {
        return this.parsers.some(p => p.bankName.toLowerCase() === bankName.toLowerCase());
    }
}

// Singleton instance export et
export const screenshotProcessor = new ScreenshotProcessor();
