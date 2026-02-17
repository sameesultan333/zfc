import React, { useEffect } from 'react';
import { View, Text, Alert } from 'react-native';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

interface Props {
  onZoneReady: (config: {
    zoneId: string;
    apiBase: string;
    ssid: string;
  }) => void;
}

const NFCSetupScreen: React.FC<Props> = ({ onZoneReady }) => {

  useEffect(() => {
    NfcManager.start();
    readNfc();
  }, []);

  const readNfc = async () => {
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);

      const tag = await NfcManager.getTag();
      if (tag?.ndefMessage) {
  const record = tag.ndefMessage[0];

  const payload = Ndef.text.decodePayload(
    record.payload as any
  );

  const parts = payload.split(';');
  const config: any = {};

  parts.forEach((part) => {
    const [key, value] = part.split('=');
    config[key] = value;
  });

  onZoneReady({
    zoneId: config.zoneId,
    apiBase: config.apiBase,
    ssid: config.ssid,
  });
}


    } catch (ex) {
      console.warn('NFC Error', ex);
    } finally {
      NfcManager.cancelTechnologyRequest();
    }
  };

  return (
    <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
      <Text style={{ fontSize:22 }}>
        Tap NFC Tag to Connect
      </Text>
    </View>
  );
};

export default NFCSetupScreen;
