import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.9f53401b13e24b63bc62944bb82a6e79',
  appName: 'DukaOS',
  webDir: 'dist',
  server: {
    url: 'https://9f53401b-13e2-4b63-bc62-944bb82a6e79.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0a1a',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a1a',
    },
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0a0a1a',
  },
};

export default config;
