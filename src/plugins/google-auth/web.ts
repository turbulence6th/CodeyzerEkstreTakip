import { WebPlugin } from '@capacitor/core';

import type { GoogleAuthPlugin, GoogleUser } from './definitions';

export class GoogleAuthWeb extends WebPlugin implements GoogleAuthPlugin {
  private user: GoogleUser | null = null; // Mock kullanıcıyı saklamak için

  constructor() {
    super();
    // Web'de test için başlangıçta bir mock kullanıcı ayarlayabiliriz (opsiyonel)
    // this.user = this.getMockUser();
    console.log('GoogleAuthWeb loaded');
  }

  private getMockUser(): GoogleUser {
      return {
        id: 'mock_web_12345',
        name: 'Mock Web User',
        email: 'mock.web.user@example.com',
        imageUrl: 'https://via.placeholder.com/150',
        idToken: 'mock_id_token_web_' + Date.now(),
        accessToken: 'mock_access_token_web_' + Date.now(), // Access token'ı da mockla
      };
  }

  async signIn(): Promise<GoogleUser> {
    console.log('GoogleAuthWeb.signIn() called');
    // Web'de gerçek bir sign-in akışı simüle etmek zor, bu yüzden sadece mock data döndürüyoruz.
    // Gerçek OAuth akışı için farklı bir kütüphane (gapi, vs.) gerekir.
    const mockUser = this.getMockUser();
    this.user = mockUser;
    return mockUser;
  }

  async trySilentSignIn(): Promise<GoogleUser> {
    console.log('GoogleAuthWeb.trySilentSignIn() called');
    // Eğer daha önce mock sign-in yapıldıysa, o kullanıcıyı döndür.
    if (this.user) {
        console.log('Silent sign-in successful (found mock user)');
        // İsteğe bağlı: Token'ları mock olarak "yenileyebiliriz"
        this.user.idToken = 'mock_id_token_web_silent_' + Date.now();
        this.user.accessToken = 'mock_access_token_web_silent_' + Date.now();
        return this.user;
    } else {
        console.log('Silent sign-in failed (no mock user found)');
        // Gerçek senaryoda SIGN_IN_REQUIRED gibi bir hata kodu döndürülebilir.
        return Promise.reject('No mock user signed in silently.');
    }
  }

  async signOut(): Promise<void> {
    console.log('GoogleAuthWeb.signOut() called');
    this.user = null; // Mock kullanıcıyı temizle
    return Promise.resolve();
  }

  // --- Web Platformu için Takvim Metodları (Mock Implementasyon) ---

  async createCalendarEvent(options: import("./definitions").CalendarEventOptions): Promise<import("./definitions").CalendarEventResponse> {
    console.warn('GoogleAuthWeb.createCalendarEvent() called on web. Mock response returned.', options);
    // Web'de gerçek takvim işlemi yapılamaz.
    // Başarılı olduğunu varsayan basit bir mock yanıt döndür.
    return Promise.resolve({ 
      id: 'mock_event_id_' + Date.now(),
      summary: options.summary,
      htmlLink: '#mock-link'
    }); 
  }

  async searchCalendarEvents(options: import("./definitions").CalendarSearchOptions): Promise<import("./definitions").CalendarSearchResponse> {
    console.warn('GoogleAuthWeb.searchCalendarEvents() called on web. Mock response returned.', options);
    // Web'de gerçek takvim araması yapılamaz.
    // Etkinlik bulunamadığını varsayan basit bir mock yanıt döndür.
    return Promise.resolve({ eventFound: false }); 
  }

} 