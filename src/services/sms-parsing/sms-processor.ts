import { SmsReader } from '@plugins/sms-reader'; // Plugin import
import type { SmsFilterOptions, SmsPermissionStatus } from '@plugins/sms-reader'; // Tipler

// Tipleri import edelim
import type { BankProcessor, BankSmsParser, BankEmailParser, ParsedStatement, SmsDetails, EmailDetails, ParsedLoan } from './types';

// Gmail Servisi
import { gmailService } from '../index'; // <-- DOĞRU IMPORT: index.ts üzerinden

// SMS Parser'ları
import { QnbSmsParser } from './parsers/qnb-parser';
// import { YapiKrediSmsParser } from './parsers/yapikredi-parser'; // Henüz yok
import { KuveytTurkSmsParser } from './parsers/kuveytturk-parser'; // Yeni parser'ı import et

// Kredi SMS Parser'ları
import { qnbLoanParser } from './parsers/qnb-parser';
import { garantiLoanParser, GarantiParser } from './parsers/garanti-parser'; // Yeni Garanti kredi parser'ını import et

// EMAIL Parser'ları
import { yapikrediEmailParser } from '../email-parsing/parsers/yapikredi-email-parser';
import { ziraatEmailParser } from '../email-parsing/parsers/ziraat-email-parser'; // Yeni parser import edildi
import { isbankEmailParser } from '../email-parsing/parsers/isbank-email-parser'; // <-- YENİ İŞ BANKASI PARSER IMPORTU
import { kuveytturkEmailParser } from 'services/email-parsing/parsers/kuveytturk-email-parser';

// --- Banka İşlemci Yapılandırması --- //
// Her banka için SMS, Kredi ve E-posta parser'larını ve Gmail sorgusunu burada tanımlayalım
// Dışa aktarılıyor:
export const availableBankProcessors: BankProcessor[] = [
  {
    bankName: 'QNB',
    smsSenderKeywords: ['QNB'],
    smsStatementQueryKeyword: 'borcu', // Ekstre için
    smsLoanQueryKeyword: 'krediniz', // Kredi için
    smsParser: new QnbSmsParser(),
    loanSmsParser: qnbLoanParser,
  },
  {
    bankName: 'Yapı Kredi',
    smsSenderKeywords: ['YAPIKREDI', 'YKB', 'WORLD'], // Güncellendi
    emailParser: yapikrediEmailParser,
    gmailQuery: 'from:(ekstre@ekstre.yapikredi.com.tr) subject:("Hesap Özeti")',
  },
  {
    bankName: 'Ziraat Bankası',
    smsSenderKeywords: ['ZIRAATBANK', 'ZRYBNK'],
    emailParser: ziraatEmailParser,
    gmailQuery: 'from:(ziraat@ileti.ziraatbank.com.tr) subject:("e-ekstre")',
  },
  {
    bankName: 'Garanti BBVA',
    smsSenderKeywords: ['GARANTIBBVA', 'GARANTiBBVA', 'BONUS'], // Kullanıcı tarafından güncellendi
    smsStatementQueryKeyword: 'ekstresinin', // Ekstre için
    smsLoanQueryKeyword: 'ihtiyac krediniz', // Sadece kredi için
    smsParser: new GarantiParser(),
    loanSmsParser: garantiLoanParser,
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

  // İzin durumunu kontrol et
  async checkSmsPermission(): Promise<SmsPermissionStatus> {
    try {
      return await SmsReader.checkPermissions();
    } catch (err) {
      console.error('Error checking SMS permissions:', err);
      return { readSms: 'denied' }; // Hata durumunda denied varsayalım
    }
  }

  // İzin iste
  async requestSmsPermission(): Promise<SmsPermissionStatus> {
    try {
      return await SmsReader.requestPermissions();
    } catch (err) {
      console.error('Error requesting SMS permissions:', err);
      return { readSms: 'denied' };
    }
  }

  // Belirtilen filtreye göre SMS ve E-postaları getir ve ekstreleri ayrıştır
  async fetchAndParseStatements(options: SmsFilterOptions = { maxCount: 50 }): Promise<ParsedStatement[]> {
    let parsedStatements: ParsedStatement[] = [];
    const smsPermission = await this.checkSmsPermission();

    // --- SMS İşleme (Her banka için ayrı sorgu) ---
    if (smsPermission.readSms === 'granted') {
        console.log("Starting SMS statement fetch for each bank...");
        for (const processor of availableBankProcessors) {
            // Sadece SMS parser'ı ve gönderici listesi olanları işle
            if (processor.smsParser && processor.smsSenderKeywords && processor.smsSenderKeywords.length > 0) {
                console.log(`Fetching statements for ${processor.bankName}...`);
                const fetchOptions: any = {
                    maxCount: 5,
                    senders: processor.smsSenderKeywords,
                    query: processor.smsStatementQueryKeyword // Ekstre keyword'ünü kullan
                };

                try {
                    const result = await SmsReader.getMessages(fetchOptions);
                    const messages: SmsDetails[] = (result.messages || []).map(msg => ({
                        sender: msg.address || 'Unknown',
                        body: msg.body || '',
                        date: msg.date || Date.now(),
                    }));
                    console.log(` -> Fetched ${messages.length} potential messages for ${processor.bankName}.`);

                    // Dönen mesajları işle (en yeni ilk sırada)
                    for (const message of messages) {
                         // canParse kontrolü hala gerekli olabilir (keyword body'de geçse de format uymayabilir)
                         if (processor.smsParser.canParse(message.sender, message.body)) {
                            const statement = processor.smsParser.parse(message);
                            if (statement) {
                                console.log(` -> Successfully parsed newest SMS statement for ${statement.bankName}`);
                                parsedStatements.push({ ...statement, source: 'sms' });
                                break; // Bu banka için en yeniyi bulduk, sonraki mesajlara bakma
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
    console.log("Starting email statement parsing...");
    const processedEmailBanks = new Set<string>();
    try {
        for (const processor of availableBankProcessors) {
            if (processor.emailParser && processor.gmailQuery) {
                console.log(`Searching emails for ${processor.bankName} using query: ${processor.gmailQuery}`);
                // searchEmails Promise döndürdüğü için await kullan
                const emailInfos = await gmailService.searchEmails(processor.gmailQuery, 10);
                console.log(`Found ${emailInfos.length} potential email(s) for ${processor.bankName}`);

                // emailInfos artık {id, threadId}[] tipinde
                for (const emailInfo of emailInfos) {
                    // Linter Hatası Düzeltmesi: emailInfo.id null/undefined olabilir, kontrol et
                    const messageId = emailInfo?.id;
                    if (!messageId) {
                        console.warn(`SmsProcessor: Found emailInfo without an ID for ${processor.bankName}, skipping.`);
                        continue;
                    }

                    if (processedEmailBanks.has(processor.bankName)) {
                        continue;
                    }

                    // --- YENİ LOG VE TRY...CATCH --- //
                    let emailDetailsResponse: any = null;
                    try {
                        // getEmailDetails Promise döndürdüğü için await kullan
                        emailDetailsResponse = await gmailService.getEmailDetails(messageId);
                        // Detay alındıktan sonra payload var mı kontrol et (optional chaining ile)
                        if (!emailDetailsResponse?.payload) {
                            console.warn(`SmsProcessor: Received empty or payload-less response for ID: ${messageId}`);
                             continue; // Boş yanıt gelirse sonraki e-postayı dene
                        }
                    } catch (detailError) {
                        console.error(`SmsProcessor: ERROR calling getEmailDetails for ID: ${messageId}`, detailError);
                        continue; // Detay alınamazsa bu e-postayı atla, sonraki ID'ye geç
                    }
                    // --- YENİ LOG VE TRY...CATCH SONU --- //

                    // emailDetailsResponse ve payload kontrolü (try..catch sonrası)
                    if (emailDetailsResponse?.payload) {
                        // decodeEmailBody artık { plainBody, htmlBody } döndürüyor
                        const decodedBody = gmailService.decodeEmailBody(emailDetailsResponse.payload); // Payload'ı kullan
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
                            plainBody: decodedBody.plainBody,
                            htmlBody: decodedBody.htmlBody,
                            originalResponse: emailDetailsResponse // <- Ekin alınması için bu önemli
                        };

                        // Linter Hatası Düzeltmesi: canParse artık emailDetails almamalı (interface'e uygun)
                        // PDF kontrolü IsbankEmailParser.parse içine taşındı.
                        const canParseResult = await processor.emailParser.canParse(sender, subject, decodedBody);
                        if (canParseResult) {
                            console.log(`Attempting to parse newest email (${messageId}) for ${processor.bankName}...`);
                            const statement = await processor.emailParser.parse(emailData);
                            processedEmailBanks.add(processor.bankName); // En yeni işlendi olarak işaretle
                            if (statement) {
                                console.log(`Successfully parsed EMAIL statement for ${statement.bankName}`);
                                // source'u kontrol et, parser kendi içinde belirlemeli (örn. 'email-pdf')
                                parsedStatements.push({ ...statement, source: statement.source || 'email' });
                            } else {
                                 console.warn(`Email Parser for ${processor.bankName} identified email but failed to parse content (ID: ${messageId}).`);
                            }
                             // İş Bankası için sadece en yeni PDF'i işlemek istiyorsak burada break edebiliriz.
                             // break;
                        }
                    }
                }
            }
        }
    } catch (error) {
        // fetchWithAuth'dan gelen hatalar burada yakalanabilir
        console.error('Error fetching or parsing EMAIL statement messages:', error);
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

    // Orijinal logu geri getir
    console.log(`Filtered down to ${finalStatements.length} latest statements.`);

    // 3. En son ekstreleri tarihe göre sırala (dueDate)
    finalStatements.sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());

    return finalStatements;
  }

  // --- Kredileri Getir ve Ayrıştır --- //
  async fetchAndParseLoans(options: SmsFilterOptions = { maxCount: 50 }): Promise<ParsedLoan[]> {
    let parsedLoans: ParsedLoan[] = [];
    const smsPermission = await this.checkSmsPermission();

    // --- SMS İşleme (Her banka için ayrı sorgu) ---
    if (smsPermission.readSms === 'granted') {
        console.log("Starting Loan SMS fetch for each bank...");
        for (const processor of availableBankProcessors) {
            // Sadece KREDİ SMS parser'ı ve gönderici listesi olanları işle
            if (processor.loanSmsParser && processor.smsSenderKeywords && processor.smsSenderKeywords.length > 0) {
                console.log(`Fetching loans for ${processor.bankName}...`);
                const fetchLoanOptions: any = {
                    maxCount: 5,
                    senders: processor.smsSenderKeywords,
                    query: processor.smsLoanQueryKeyword // Kredi keyword'ünü kullan
                };

                try {
                    const result = await SmsReader.getMessages(fetchLoanOptions);
                    const messages: SmsDetails[] = (result.messages || []).map(msg => ({
                        sender: msg.address || 'Unknown',
                        body: msg.body || '',
                        date: msg.date || Date.now(),
                    }));
                    console.log(` -> Fetched ${messages.length} potential loan messages for ${processor.bankName}.`);

                    // Dönen mesajları işle (en yeni ilk sırada)
                    for (const message of messages) {
                        if (processor.loanSmsParser.canParse(message.sender, message.body)) {
                            const loan = processor.loanSmsParser.parse(message);
                            if (loan) {
                                console.log(` -> Successfully parsed newest loan SMS for ${loan.bankName}`);
                                parsedLoans.push({ ...loan, source: 'sms'});
                                break; // Bu banka için en yeniyi bulduk
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Error fetching/parsing loans for ${processor.bankName}:`, err);
                }
            }
        }
    } else {
      console.warn('SMS permission not granted. Cannot fetch loans.');
    }

    // --- E-posta Kredileri (Gelecekte eklenebilir) ---

    // --- Sonuçları Birleştirme ve Sıralama ---
    console.log(`Loan parsing complete. Found ${parsedLoans.length} loans (SMS only, newest per bank).`);
    // En son kredileri tarihe göre sırala (null tarihleri sona at)
    parsedLoans.sort((a, b) => {
        if (a.firstPaymentDate && b.firstPaymentDate) {
            return b.firstPaymentDate.getTime() - a.firstPaymentDate.getTime(); // En yeniden eskiye
        } else if (a.firstPaymentDate) {
            return -1; // a'nın tarihi var, b'nin yok, a önce gelsin (yeni olduğu için)
        } else if (b.firstPaymentDate) {
            return 1; // b'nin tarihi var, a'nın yok, b önce gelsin
        } else {
            return 0; // İkisinin de tarihi yok, sıralama değişmesin
        }
    });
    return parsedLoans;
  }
}

// Servisin tek bir örneğini oluşturup dışa aktarabiliriz
// export const smsProcessor = new SmsProcessor(); // Eski isim
export const statementProcessor = new StatementProcessor(); // Yeni isim 