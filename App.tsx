import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import ZoneScreen from './screens/ZoneScreen';

function App(): JSX.Element {

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      <ZoneScreen
        zoneId="1"
        apiBase="http://192.168.10.1:3000"
        onExit={() => {}}
      />
    </SafeAreaView>
  );
}

export default App;