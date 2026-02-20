import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Button,
  Alert,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  StyleSheet
} from 'react-native';

import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import WifiManager from 'react-native-wifi-reborn';

interface ZoneConfig {
  zoneId: string;
  apiBase: string;
  ssid: string;
  password: string;
}

interface Props {
  onZoneReady: (config: ZoneConfig) => void;
}

const NFCSetupScreen: React.FC<Props> = ({ onZoneReady }) => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready to Scan');

  useEffect(() => {
    NfcManager.start();
    requestPermissions();

    return () => {
      NfcManager.cancelTechnologyRequest();
    };
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        // Remove NFC from here! It's not a runtime permission.
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
      } catch (err) {
        console.warn(err);
      }
    }
  };

  // Helper to parse the custom semicolon string from your Java HCE service
  const parseHCEString = (str: string): ZoneConfig => {
    const config: any = {};
    str.split(';').forEach(part => {
      const [key, value] = part.split('=');
      if (key && value) config[key.trim()] = value.trim();
    });

    return {
      zoneId: config.zoneId || '0',
      apiBase: config.apiBase || '192.168.4.1',
      ssid: config.ssid || '',
      password: config.password || '12345678', // Default ESP32 pass if not sent
    };
  };

  const readHCE = async () => {
    try {
      setLoading(true);
      setStatus('Searching for Transmitter Phone...');
      
      // 1. Request ISO-DEP (Required for Phone-to-Phone)
      await NfcManager.requestTechnology(NfcTech.IsoDep);

      // 2. The APDU Handshake (Must match your Java AID)
      // [CLA, INS, P1, P2, Lc, AID(7 bytes), Le]
      const selectCommand = [
        0x00, 0xA4, 0x04, 0x00, 0x07, 
        0xD2, 0x76, 0x00, 0x00, 0x85, 0x01, 0x01, 0x00
      ];

      // 3. Exchange data with the other phone
      const response = await NfcManager.isoDepHandler.transceive(selectCommand);

      if (response && response.length > 0) {
        // Convert byte array to String and strip status bytes (90 00)
        const text = response
          .map((byte: number) => String.fromCharCode(byte))
          .join('')
          .replace(/[\x00-\x1F\x7F-\x9F]/g, ""); 

        console.log("🔥 HCE Data Received:", text);
        const config = parseHCEString(text);
        
        if (config.ssid) {
          showConnectPrompt(config);
        } else {
          Alert.alert("Invalid Data", "Received NFC data but SSID was missing.");
        }
      }
    } catch (error: any) {
      console.warn("NFC Scan Error:", error);
      setStatus('Scan Failed. Try again.');
    } finally {
      setLoading(false);
      NfcManager.cancelTechnologyRequest();
    }
  };

  const showConnectPrompt = (config: ZoneConfig) => {
    Alert.alert(
      "Farm Network Found",
      `Connect to ${config.ssid}?`,
      [
        { text: "Cancel", style: "cancel", onPress: () => setStatus('Ready to Scan') },
        { text: "Connect", onPress: () => connectToWifi(config) }
      ]
    );
  };

  const connectToWifi = async (config: ZoneConfig) => {
    try {
      setStatus(`Connecting to ${config.ssid}...`);
      
      // Connect to the ESP32 Access Point
      await WifiManager.connectToProtectedSSID(
        config.ssid,
        config.password,
        false, // isWep
        false  // isHidden
      );

      Alert.alert("Success", "Connected to Farm Antenna!");
      onZoneReady(config); // Move to the Dashboard
    } catch (err: any) {
      Alert.alert("WiFi Error", "Could not connect to the antenna. Is it powered on?");
      setStatus('Connection Failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ZFC Antenna Setup</Text>
      
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : (
        <View style={styles.buttonContainer}>
          <Text style={styles.instruction}>Tap the back of the Transmitter Phone to this device.</Text>
          <Button title="Start NFC Scan" color="#4CAF50" onPress={readHCE} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 30, color: '#333' },
  loaderContainer: { alignItems: 'center' },
  statusText: { marginTop: 15, fontSize: 16, color: '#666' },
  buttonContainer: { width: '100%', alignItems: 'center' },
  instruction: { textAlign: 'center', marginBottom: 20, color: '#888', fontSize: 14 }
});

export default NFCSetupScreen;