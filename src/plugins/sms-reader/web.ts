// src/plugins/sms-reader/web.ts
import { WebPlugin } from '@capacitor/core';

import type { SmsReaderPlugin, SmsPermissionStatus, SmsFilterOptions, SmsMessage } from './definitions';

export class SmsReaderWeb extends WebPlugin implements SmsReaderPlugin {
  async checkPermissions(): Promise<SmsPermissionStatus> {
    console.log('SmsReaderWeb: Mock Check Permissions');
    // Permissions are not applicable on web, return granted
    return Promise.resolve({ readSms: 'granted' });
  }

  async requestPermissions(): Promise<SmsPermissionStatus> {
    console.log('SmsReaderWeb: Mock Request Permissions');
    // Permissions are not applicable on web, return granted
    return Promise.resolve({ readSms: 'granted' });
  }

  async getMessages(options?: SmsFilterOptions): Promise<{ messages: SmsMessage[] }> {
    console.log('SmsReaderWeb: Mock Get Messages with options:', options);
    // Return a list of mock SMS messages matching the SmsMessage interface
    const mockMessages: SmsMessage[] = [
      {
        id: 'mock_sms_1',
        address: 'BANKA A',
        body: 'Kredi karti ekstrenizin son odeme tarihi 15.07.2023, borc 123.45 TL.',
        date: Date.now() - 86400000 * 365,
      },
      {
        id: 'mock_sms_2',
        address: 'BANKA B',
        body: 'Kredi karti son odeme tarihi 20.07.2023.',
        date: Date.now() - 86400000 * 300,
      },
      {
        id: 'mock_qnb_ekstre_1',
        address: 'QNB',
        body: 'Bilgi: 3746 ile biten kartinizin borcu 1,800.50 TL, asgari borcu 721.00 TL, son odeme tarihi 24/12/2025. Ekstre detayiniz icin: https://sposta.qnb.com.tr/OeDNcVlo18f2  B002',
        date: Date.now() - 86400000,
      },
      {
        id: 'mock_qnb_kredi_1',
        address: 'QNB',
        body: "Basvurdugunuz 3 ay vade ve 5.179,22 TL taksitli 15.000,00 TL krediniz, 108266946 no'lu vadesiz hesabiniza yatirilmistir. Ilk taksitin odeme tarihi 16/01/2026'dir. dstk@qnb.com.tr B002",
        date: Date.now(),
      },
      {
        id: 'mock_garanti_kredi_1',
        address: 'GARANTiBBVA',
        body: "10.000 TL tutarinda 3 ay vadeli ihtiyac krediniz kullaniminiza acilmistir. Belgelerinize Garanti BBVA Mobil ve Internet Bankaciligindan ulasabilirsiniz. Iyi gunlerde kullanmanizi dileriz. B001",
        date: Date.now() - 3600000,
      },
      {
        id: 'mock_yapikredi_ekstre_1',
        address: 'YapiKredi',
        body: "1234 no'lu kredi karti hesap ozetiniz hazirlandi. Son odeme tarihi 10/11/2025, toplam borc 2500.00 TL.",
        date: Date.now() - 7200000,
      },
      {
        id: 'mock_ziraat_ekstre_1',
        address: 'Ziraat Bankasi',
        body: '5678 ile biten kartiniza ait donem borcu 950.50 TL, son odeme tarihi 05/03/2026.',
        date: Date.now() - 10800000,
      },
      {
        id: 'mock_kuveytturk_ekstre_1',
        address: 'KUVEYT TURK',
        body: 'Degerli musterimiz, 6071 ile biten kartinizin ekstresi kesildi. Toplam Borc: 1.492,42 TL Asgari Odeme Tutari: 1.492,42 TL Son Odeme Tarihi: 10.07.2025 Kuveyt Turk Mobil uygulamanizdan ya da Cagri Merkezi 444 0 123\'u arayarak ayrintili bilgi alabilirsiniz. B002',
        date: Date.now() - 8 * 24 * 60 * 60 * 1000,
      },
    ];

    return Promise.resolve({ messages: mockMessages });
  }
} 