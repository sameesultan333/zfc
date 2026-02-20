package com.zfc_ui;

import android.nfc.cardemulation.HostApduService;
import android.os.Bundle;
import android.util.Log;

public class MyHCEService extends HostApduService {

    private static final String TAG = "ZFC_HCE";

    @Override
    public byte[] processCommandApdu(byte[] commandApdu, Bundle extras) {

        if (commandApdu == null || commandApdu.length < 4) {
            return new byte[]{(byte) 0x6A, (byte) 0x82};
        }

        // Check INS byte for SELECT (0xA4)
        if (commandApdu[1] == (byte) 0xA4) {

            Log.d(TAG, "AID Selected");

            String payload = "zoneId=1;ssid=Denvik_JIO2_4_5G_EXT;password=denvik@345;apiBase=http://192.168.1.50:3090";
            byte[] data = payload.getBytes();

            byte[] response = new byte[data.length + 2];
            System.arraycopy(data, 0, response, 0, data.length);

            // SUCCESS STATUS WORD
            response[response.length - 2] = (byte) 0x90;
            response[response.length - 1] = (byte) 0x00;

            return response;
        }

        return new byte[]{(byte) 0x6A, (byte) 0x82};
    }

    @Override
    public void onDeactivated(int reason) {
        Log.d(TAG, "Deactivated: " + reason);
    }
}
