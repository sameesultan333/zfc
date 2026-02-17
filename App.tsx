import React, {useState} from 'react';
import {SafeAreaView, StatusBar} from 'react-native';
import WifiSetupScreen from './screens/WifiSetupScreen';
import ZoneScreen from './screens/ZoneScreen';

interface ZoneConfig {
  zoneId:  string;
  apiBase: string;
  ssid:    string;
}

function App(): JSX.Element {
  const [config, setConfig] = useState<ZoneConfig | null>(null);

  return (
    <SafeAreaView style={{flex: 1}}>
      <StatusBar
        barStyle={config ? 'dark-content' : 'light-content'}
        backgroundColor={config ? '#F8FAFC' : '#0F172A'}
      />
      {config ? (
        <ZoneScreen
          zoneId={config.zoneId}
          apiBase={config.apiBase}
          onExit={() => setConfig(null)}
        />
      ) : (
        <WifiSetupScreen onZoneReady={setConfig} />
      )}
    </SafeAreaView>
  );
}

export default App;