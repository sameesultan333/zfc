import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import NFCSetupScreen from '../screens/NFCSetupScreen';
import PinScreen from '../screens/PinScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import SetpointsScreen from '../screens/SetpointsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ZoneInfoScreen from '../screens/ZoneInfoScreen';

interface ZoneConfig {
  zoneId: string;
  apiBase: string;
  ssid: string;
  password: string;
}

type AppRoute = 'home' | 'nfc' | 'pin' | 'settings' | 'setpoints' | 'schedule' | 'zoneinfo';

const DEFAULT_ZONE_CONFIG: ZoneConfig = {
  zoneId: '1',
  apiBase: 'http://192.168.4.1:3000',
  ssid: '',
  password: '',
};

const AppNavigator: React.FC = () => {
  const [route, setRoute] = useState<AppRoute>('home');
  const [zoneConfig, setZoneConfig] = useState<ZoneConfig>(DEFAULT_ZONE_CONFIG);
  const [isOnline, setIsOnline] = useState(false);

  const handleZoneReady = (config: ZoneConfig) => {
    const rawApiBase = config.apiBase.trim();
    const baseWithProtocol = rawApiBase.startsWith('http')
      ? rawApiBase
      : `http://${rawApiBase}`;
    const normalizedApiBase = /:\d+$/.test(baseWithProtocol)
      ? baseWithProtocol
      : `${baseWithProtocol}:3000`;

    setZoneConfig({
      ...config,
      apiBase: normalizedApiBase,
    });
    setRoute('home');
  };

  let screen: React.ReactNode;

  switch (route) {
    case 'nfc':
      screen = <NFCSetupScreen onZoneReady={handleZoneReady} />;
      break;
    case 'pin':
      screen = <PinScreen onSuccess={() => setRoute('settings')} onCancel={() => setRoute('home')} />;
      break;
    case 'settings':
      screen = (
        <SettingsScreen
          onBack={() => setRoute('home')}
          onOpenSetpoints={() => setRoute('setpoints')}
          onOpenSchedule={() => setRoute('schedule')}
          onOpenZoneInfo={() => setRoute('zoneinfo')}
        />
      );
      break;
    case 'setpoints':
      screen = (
        <SetpointsScreen
          zoneId={zoneConfig.zoneId}
          apiBase={zoneConfig.apiBase}
          isOnline={isOnline}
          onBack={() => setRoute('settings')}
        />
      );
      break;
    case 'schedule':
      screen = (
        <ScheduleScreen
          zoneId={zoneConfig.zoneId}
          apiBase={zoneConfig.apiBase}
          isOnline={isOnline}
          onBack={() => setRoute('settings')}
        />
      );
      break;
    case 'zoneinfo':
      screen = (
        <ZoneInfoScreen
          zoneId={zoneConfig.zoneId}
          apiBase={zoneConfig.apiBase}
          onBack={() => setRoute('settings')}
        />
      );
      break;
    case 'home':
    default:
      screen = (
        <HomeScreen
          zoneId={zoneConfig.zoneId}
          apiBase={zoneConfig.apiBase}
          onOpenPin={() => setRoute('pin')}
          onExit={() => setRoute('nfc')}
          onOnlineChange={setIsOnline}
        />
      );
      break;
  }

  return <SafeAreaView style={styles.container}>{screen}</SafeAreaView>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default AppNavigator;
