import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.libravaultclone.app',
  appName: 'LibraVault Store',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#ffffff',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#ffffff',
  },
}

export default config
