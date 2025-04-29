import { WebPlugin } from '@capacitor/core';

import type { PdfParserPlugin, ParsePdfResult } from './definitions';

export class PdfParserWeb extends WebPlugin implements PdfParserPlugin {
  async parsePdfText(options: { base64Data: string }): Promise<ParsePdfResult> {
    console.log('PdfParserWeb.parsePdfText called with options:', options);

    // Web ortamında gerçek PDF ayrıştırma işlemi genellikle yapılmaz.
    // Basit bir mock yanıtı veya hata döndürebiliriz.
    if (!options.base64Data) {
        console.error('PdfParserWeb: Missing base64Data');
         return Promise.resolve({ error: 'Missing base64Data in web mock' });
    }

    console.warn('PdfParserWeb: PDF parsing not implemented in web. Returning mock data.');
    // Başarılı bir senaryoyu simüle etmek için:
    return Promise.resolve({
        text: `
0000********0000
Son Ödeme Tarihi: 22.07.2025
Hesap Özeti Borcu: 2001,44 TL
        `
    });

    // Hata senaryosunu simüle etmek için:
    // return Promise.resolve({ error: 'PDF parsing failed in web mock' });
  }
} 