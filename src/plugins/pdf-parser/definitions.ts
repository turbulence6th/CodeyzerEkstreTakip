export interface ParsePdfResult {
  text?: string; // Başarılı olursa metin içeriği
  error?: string; // Hata olursa hata mesajı
}

export interface PdfParserPlugin {
  /**
   * Parses the text content from a Base64 encoded PDF.
   * Requires Apache PDFBox dependency in the native Android project.
   * @param options Object containing the Base64 encoded PDF data.
   * @returns A promise resolving with an object containing either 'text' or 'error'.
   */
  parsePdfText(options: { base64Data: string }): Promise<ParsePdfResult>;
} 