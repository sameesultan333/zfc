import React, { useState } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';

import NFCSetupScreen from './screens/NFCSetupScreen';
import ZoneScreen from './screens/ZoneScreen';

interface ZoneConfig {
  zoneId: string;
  apiBase: string;
  ssid: string;
}

function App(): JSX.Element {
  const [zoneConfig, setZoneConfig] = useState<ZoneConfig | null>(null);

  // Not connected → show NFC
  if (!zoneConfig) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" />
        <NFCSetupScreen onZoneReady={(config) => setZoneConfig(config)} />
      </SafeAreaView>
    );
  }

  // Connected → show Zone
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      <ZoneScreen
        zoneId={zoneConfig.zoneId}
        apiBase={zoneConfig.apiBase}
        onExit={() => setZoneConfig(null)}
      />
    </SafeAreaView>
  );
}

export default App;
