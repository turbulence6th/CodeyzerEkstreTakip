import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.codeyzer.ekstre',
  appName: 'Codeyzer Ekstre Takip',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    backgroundColor: '#ffffff',
    allowsLinkPreview: true,
    scrollEnabled: true
  },
  android: {
    allowMixedContent: false
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: 'default',
      overlaysWebView: true
    },
    SplashScreen: {
      launchAutoHide: true,
      showSpinner: false
    }
  }
};

export default config;
