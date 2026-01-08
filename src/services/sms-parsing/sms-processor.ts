import { SmsReader } from '@plugins/sms-reader'; // Plugin import
import type { SmsFilterOptions, SmsPermissionStatus } from '@plugins/sms-reader'; // Tipler
import { Capacitor } from '@capacitor/core'; // Platform detection

// Plugin Definitions Tiplerini Doğrudan Import Et
import type {
    GmailSearchResponse, // EKLENDİ
    // Diğer gerekebilecek tipler (şimdilik sadece bu)
} from '../../plugins/google-auth/definitions';

// Tipleri import edelim
import type { BankProcessor, BankSmsParser, BankEmailParser, ParsedStatement, SmsDetails, EmailDetails, DecodedEmailBody } from './types'; // DecodedEmailBody eklendi (canParse için)

// Gmail Servisi
// import { gmailService } from '../index'; // <-- İndex üzerinden import kaldırıldı
import { GmailService } from '../gmail.service'; // <-- Doğrudan import edildi

// Servisi yerel olarak başlatalım
const localGmailService = new GmailService();

// SMS Parser'ları
import { QnbSmsParser } from './parsers/qnb-parser';
// import { YapiKrediSmsParser } from './parsers/yapikredi-parser'; // Henüz yok
import { KuveytTurkSmsParser } from './parsers/kuveytturk-parser'; // Yeni parser'ı import et

// Garanti Parser
import { GarantiParser } from './parsers/garanti-parser';
import { garantiEmailParser } from 'services/email-parsing/parsers/garanti-email-parser';

// EMAIL Parser'ları
import { yapikrediEmailParser } from '../email-parsing/parsers/yapikredi-email-parser';
import { ziraatEmailParser } from '../email-parsing/parsers/ziraat-email-parser'; // Yeni parser import edildi
import { isbankEmailParser } from '../email-parsing/parsers/isbank-email-parser'; // <-- YENİ İŞ BANKASI PARSER IMPORTU
import { kuveytturkEmailParser } from 'services/email-parsing/parsers/kuveytturk-email-parser';
import { akbankEmailParser } from 'services/email-parsing/parsers/akbank-email-parser';

// SCREENSHOT Parser'ları
import { akbankScreenshotParser } from '../screenshot-parsing/parsers/akbank-screenshot-parser';

// --- Banka İşlemci Yapılandırması --- //
// Her banka için SMS ve E-posta parser'larını ve Gmail sorgusunu burada tanımlayalım
// Dışa aktarılıyor:
export const availableBankProcessors: BankProcessor[] = [
  {
    bankName: 'QNB',
    smsSenderKeywords: ['QNB'],
    smsStatementQueryKeyword: 'borcu', // Ekstre için
    smsParser: new QnbSmsParser(),
  },
  {
    bankName: 'Yapı Kredi', 
    emailParser: yapikrediEmailParser,
    gmailQuery: 'from:(ekstre@ekstre.yapikredi.com.tr) subject:("Hesap Özeti")',
  },
  {
    bankName: 'Ziraat Bankası',
    smsSenderKeywords: ['ZIRAATBANK'],
    emailParser: ziraatEmailParser,
    gmailQuery: 'from:(ziraat@ileti.ziraatbank.com.tr) subject:("e-ekstre")',
  },
  {
    bankName: 'Garanti BBVA Bonus',
    smsSenderKeywords: ['GARANTIBBVA', 'GARANTiBBVA', 'BONUS'],
    smsStatementQueryKeyword: 'ekstresinin',
    smsParser: new GarantiParser(),
    emailParser: garantiEmailParser,
    gmailQuery: 'from:(garantibbva@garantibbva.com.tr) subject:("Bonus Ekstresi")',
  },
  {
    bankName: 'Kuveyt Türk',
    smsSenderKeywords: ['KUVEYT TURK'], // Büyük harf olabilir, SMS başlığına göre düzelt
    smsStatementQueryKeyword: 'ekstresi kesildi', // Kuveyt Türk ekstre SMS'i için anahtar kelime
    smsParser: new KuveytTurkSmsParser(), // Yeni eklenen SMS parser
    emailParser: kuveytturkEmailParser,
    gmailQuery: 'from:(bilgilendirme@kuveytturk.com.tr) subject:("Kuveyt Türk Kredi Kartı Hesap Ekstreniz")',
  },
  // --- YENİ EKLENEN İŞ BANKASI ---
  {
    bankName: 'İş Bankası',
    emailParser: isbankEmailParser, // Yeni PDF işleyecek parser
    // Gmail sorgusu: gönderen ve konu başlangıcına göre (kart no/tarih kısmı değişken olabilir)
    gmailQuery: 'from:(bilgilendirme@ileti.isbank.com.tr) subject:("Maximum Kredi Kartı Hesap Özeti")',
  },
  {
    bankName: 'Akbank',
    emailParser: akbankEmailParser,
    screenshotParser: akbankScreenshotParser, // YENİ: Screenshot parser eklendi
    gmailQuery: 'from:(hizmet@bilgi.akbank.com) subject:("Kredi kartı ekstre bilgileri")',
  },
  // ... Diğer bankalar eklenebilir
];

// Kullanılacak tüm parser'ları bir listede tutalım (ESKİ YÖNTEM - KALDIRILIYOR)
/*
const availableParsers: BankSmsParser[] = [
  new QnbSmsParser(),
  // new YapiKrediSmsParser(),
];
const availableLoanParsers = [
  qnbLoanParser,
];
*/
// --- Yapılandırma Sonu ---


export class StatementProcessor { // Sınıf adını daha genel yapalım: SmsProcessor -> StatementProcessor

  // Platform iOS mu kontrol et
  private isIOS(): boolean {
    return Capacitor.getPlatform() === 'ios';
  }

  // İzin durumunu kontrol et
  async checkSmsPermission(): Promise<SmsPermissionStatus> {
    // iOS'ta SMS okuma API'si yok
    if (this.isIOS()) {
      console.log('[StatementProcessor] iOS platform - SMS reading not available');
      return { readSms: 'denied' };
    }

    try {
      return await SmsReader.checkPermissions();
    } catch (err) {
      console.error('Error checking SMS permissions:', err);
      return { readSms: 'denied' }; // Hata durumunda denied varsayalım
    }
  }

  // İzin iste
  async requestSmsPermission(): Promise<SmsPermissionStatus> {
    // iOS'ta SMS izni istenemez
    if (this.isIOS()) {
      console.warn('[StatementProcessor] iOS platform - SMS permission cannot be requested');
      return { readSms: 'denied' };
    }

    try {
      return await SmsReader.requestPermissions();
    } catch (err) {
      console.error('Error requesting SMS permissions:', err);
      return { readSms: 'denied' };
    }
  }

  // Belirtilen filtreye göre SMS ve E-postaları getir ve ekstreleri ayrıştır
  async fetchAndParseStatements(options: SmsFilterOptions = { maxCount: 100 }): Promise<ParsedStatement[]> {
    let parsedStatements: ParsedStatement[] = [];
    const smsPermission = await this.checkSmsPermission();

    // Son 2 aylık mesajlar için tarih filtresi
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const minDateTimestamp = twoMonthsAgo.getTime();

    // --- SMS İşleme (Her banka için ayrı sorgu) ---
    // iOS'ta SMS okuma mevcut değil, bu blok atlanacak
    if (smsPermission.readSms === 'granted' && !this.isIOS()) {
        for (const processor of availableBankProcessors) {
            // Sadece SMS parser'ı ve gönderici listesi olanları işle
            if (processor.smsParser && processor.smsSenderKeywords && processor.smsSenderKeywords.length > 0 && processor.smsStatementQueryKeyword) {
                const fetchStatementOptions: SmsFilterOptions = {
                    maxCount: 5, // Her banka için az sayıda, en yeni SMS yeterli
                    senders: processor.smsSenderKeywords, // Sadece bu bankanın göndericileri
                    keywords: [processor.smsStatementQueryKeyword], // Sadece ekstre anahtar kelimesi
                    minDate: minDateTimestamp, // Son 2 ayda gelenler
                };

                try {
                    // Native filtreleme ile mesajları çek
                    const result = await SmsReader.getMessages(fetchStatementOptions);
                    const messages: SmsDetails[] = (result.messages || []).map(msg => ({
                        sender: msg.address || 'Unknown',
                        body: msg.body || '',
                        date: msg.date || Date.now(),
                    }));

                    // Dönen mesajları işle (en yeni ilk sırada)
                    for (const message of messages) {
                         // canParse kontrolü hala gerekli olabilir (keyword body'de geçse de format uymayabilir)
                         if (processor.smsParser.canParse(message.sender, message.body)) {
                            const statement = processor.smsParser.parse(message);
                            if (statement) {
                                parsedStatements.push({ ...statement, source: 'sms' });
                                // break; // Bu banka için en yeniyi bulduk, sonraki mesajlara bakma
                            }
                         } else {
                            // console.log(` -> Message from ${message.sender} did not pass canParse for ${processor.bankName}`);
                         }
                    }
                } catch (err) {
                    console.error(`Error fetching/parsing statements for ${processor.bankName}:`, err);
                }
            }
        }
    } else {
      console.warn('SMS permission not granted. Skipping SMS statement check.');
    }

    // --- E-posta İşleme ---
    try {
        // Gmail için tarih filtresi (YYYY/MM/DD formatında)
        const gmailDateFilter = `${twoMonthsAgo.getFullYear()}/${String(twoMonthsAgo.getMonth() + 1).padStart(2, '0')}/${String(twoMonthsAgo.getDate()).padStart(2, '0')}`;

        for (const processor of availableBankProcessors) {
            if (processor.emailParser && processor.gmailQuery) {
                // Gmail query'sine tarih filtresi ekle
                const queryWithDate = `${processor.gmailQuery} after:${gmailDateFilter}`;

                // accessToken eklendi ve maxResults düzeltildi
                // Dönüş tipi açıkça belirtilMİYOR, TS çıkarsın
                // gmailService yerine localGmailService kullanıldı
                const emailSearchResult = await localGmailService.searchEmails(queryWithDate, 10);
                // emailSearchResult.messages üzerinde iterate et
                // messages alanı opsiyonel olduğu için kontrol ekleyelim
                for (const emailInfo of emailSearchResult?.messages || []) {
                    // Linter Hatası Düzeltmesi: emailInfo.id null/undefined olabilir, kontrol et
                    const messageId = emailInfo?.id;
                    if (!messageId) {
                        console.warn(`SmsProcessor: Found emailInfo without an ID for ${processor.bankName}, skipping.`);
                        continue;
                    }

                    // --- YENİ LOG VE TRY...CATCH --- //
                    let emailDetailsResponse: any = null;
                    try {
                        // getEmailDetails Promise döndürdüğü için await kullan
                        // accessToken eklendi
                        // gmailService yerine localGmailService kullanıldı
                        emailDetailsResponse = await localGmailService.getEmailDetails(messageId);
                        // Detay alındıktan sonra payload var mı kontrol et (optional chaining ile)
                        if (!emailDetailsResponse?.payload) {
                            console.warn(`SmsProcessor: Received empty or payload-less response for ID: ${messageId}`);
                             continue; // Boş yanıt gelirse sonraki e-postayı dene
                        }
                    } catch (detailError) {
                        console.error(`[Processor] !!! ERROR calling gmailService.getEmailDetails for ID: ${messageId}`, detailError);
                        continue; // Detay alınamazsa bu e-postayı atla, sonraki ID'ye geç
                    }
                    // --- YENİ LOG VE TRY...CATCH SONU --- //

                    // emailDetailsResponse ve payload kontrolü (try..catch sonrası)
                    if (emailDetailsResponse?.payload) {
                        // decodeEmailBody artık { plainBody, htmlBody } döndürüyor
                        // gmailService yerine localGmailService kullanıldı
                        const decodedBody = localGmailService.decodeEmailBody(emailDetailsResponse); // Message objesini kullan
                        
                        // decodedBody null kontrolü eklendi
                        if (decodedBody) {
                            const headers = emailDetailsResponse.payload?.headers || []; // Optional chaining
                            const senderHeader = headers.find((h: any) => h.name === 'From');
                            const subjectHeader = headers.find((h: any) => h.name === 'Subject');
                            const dateHeader = headers.find((h: any) => h.name === 'Date');

                            const sender = senderHeader?.value || 'Unknown'; // Optional chaining
                            const subject = subjectHeader?.value || 'No Subject'; // Optional chaining
                            let emailDate = new Date();
                            try { if (dateHeader?.value) { emailDate = new Date(dateHeader.value); } } catch {}

                            const emailData: EmailDetails = {
                                id: messageId, // messageId (string) ata
                                sender: sender,
                                subject: subject,
                                date: emailDate,
                                plainBody: decodedBody.plainBody, // Null değilse eriş
                                htmlBody: decodedBody.htmlBody,   // Null değilse eriş
                                originalResponse: emailDetailsResponse // <- Ekin alınması için bu önemli
                            };

                            // PDF kontrolü IsbankEmailParser.parse içine taşındı.
                            // decodedBody null kontrolü burada da geçerli
                            const canParseResult = await processor.emailParser.canParse(sender, subject, decodedBody as DecodedEmailBody, emailData);
                            if (canParseResult) {
                                // console.log(`Attempting to parse newest email (${messageId}) for ${processor.bankName}...`); // Log kaldırıldı
                                // accessToken eklendi
                                const statement = await processor.emailParser.parse(emailData /*, accessToken */); // accessToken kaldırıldı
                                if (statement) {
                                    // console.log(`Successfully parsed EMAIL statement for ${statement.bankName}`); // Log kaldırıldı
                                    // source'u kontrol et, parser kendi içinde belirlemeli (örn. 'email-pdf')
                                    parsedStatements.push({ ...statement, source: statement.source || 'email' });
                                } else {
                                     console.warn(`Email Parser for ${processor.bankName} identified email but failed to parse content (ID: ${messageId}).`); // Uyarı kalsın
                                }
                                 // break; // Eski yorum kalsın
                            }
                        } else {
                             console.warn(`SmsProcessor: Could not decode body for email ID: ${messageId}`);
                        }
                    }
                }
            }
        }
    } catch (error) {
        // fetchWithAuth'dan gelen hatalar burada yakalanabilir
        console.error('[Processor] !!! ERROR fetching or parsing EMAIL statement messages:', error);
    }

    // --- Sonuçları Birleştirme, Filtreleme ve Sıralama (YENİ MANTIK) ---

    // 1. Gruplama ve En Yeniyi Seçme
    const latestStatementsMap = new Map<string, ParsedStatement>();

    for (const currentStatement of parsedStatements) {
        // Geliş tarihini al (SMS: number, Email: Date)
        const arrivalTime = currentStatement.originalMessage.date instanceof Date
                            ? currentStatement.originalMessage.date.getTime()
                            : currentStatement.originalMessage.date;

        // Gruplama anahtarı oluştur (dueDateString KULLANILMIYOR)
        const groupKey = `${currentStatement.bankName}-${currentStatement.last4Digits || 'N/A'}`;

        const existingStatement = latestStatementsMap.get(groupKey);

        if (existingStatement) {
            const existingArrivalTime = existingStatement.originalMessage.date instanceof Date
                                      ? existingStatement.originalMessage.date.getTime()
                                      : existingStatement.originalMessage.date;

            if (arrivalTime > existingArrivalTime) {
                latestStatementsMap.set(groupKey, currentStatement);
            }
        } else {
            latestStatementsMap.set(groupKey, currentStatement);
        }
    }

    // 2. Map'ten nihai listeyi oluştur
    const finalStatements = Array.from(latestStatementsMap.values());

    // 3. En son ekstreleri tarihe göre sırala (dueDate)
    finalStatements.sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());

    return finalStatements;
  }

}

// Servisin tek bir örneğini oluşturup dışa aktarabiliriz
// export const smsProcessor = new SmsProcessor(); // Eski isim
export const statementProcessor = new StatementProcessor(); // Yeni isim 

// --- Dinamik Filtre Listeleri Oluşturma ---

// Dinamik olarak tüm bankaların gönderici ve anahtar kelime listelerini oluştur
// Bu listeler configureFilters ile native tarafa gönderilecek.
// const allRelevantSenders: string[] = [ ... ]; // KALDIRILDI
// const allRelevantKeywords: string[] = [ ... ]; // KALDIRILDI

// console.log('[SMS Filters] Generated Senders:', allRelevantSenders); // KALDIRILDI
// console.log('[SMS Filters] Generated Keywords (Processor-specific only):', allRelevantKeywords); // KALDIRILDI

// --- Native Filtreleri Ayarlama Fonksiyonu - KALDIRILDI ---

// /**
//  * Native SMS Reader eklentisine dinamik filtreleri gönderir.
//  * Hata durumunda konsola log yazar.
//  * @returns Promise<void>
//  */
// export const setupNativeSmsFilters = async (): Promise<void> => { ... }; // KALDIRILDI 