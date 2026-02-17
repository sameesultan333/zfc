import React, {useEffect, useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Platform,
  Alert,
  Linking,
  AppState,
  AppStateStatus,
  PermissionsAndroid,
} from 'react-native';
import NfcManager, {NfcTech, Ndef} from 'react-native-nfc-manager';
import WifiManager from 'react-native-wifi-reborn';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
interface NFCPayload {
  ssid: string;
  apiBase: string;
  zoneId: string;
  password?: string;
}

interface Props {
  onZoneReady: (config: {zoneId: string; apiBase: string; ssid: string}) => void;
}

type Phase =
  | 'scanning'    // waiting for NFC tap
  | 'read_ok'     // tag parsed, about to connect
  | 'connecting'  // WifiManager in flight
  | 'verifying'   // polling getCurrentWifiSSID
  | 'success'     // matched
  | 'manual'      // auto-connect exhausted
  | 'error';      // NFC read failed

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
const MAX_RETRIES       = 3;
const VERIFY_POLL_MS    = 1_000;
const VERIFY_TIMEOUT_MS = 12_000;

const C = {
  bg:      '#0F172A',
  card:    '#1E293B',
  border:  '#334155',
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  error:   '#EF4444',
  white:   '#F8FAFC',
  muted:   '#94A3B8',
  dim:     '#64748B',
};

// ─────────────────────────────────────────────
//  Animated wave ring (only shown while scanning)
// ─────────────────────────────────────────────
const Ring: React.FC<{size: number; delay: number}> = ({size, delay}) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {toValue: 1, duration: 2400, useNativeDriver: true}),
      ]),
    ).start();
  }, [anim, delay]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: C.primary,
        opacity: anim.interpolate({inputRange: [0, 0.5, 1], outputRange: [0, 0.3, 0]}),
        transform: [{scale: anim.interpolate({inputRange: [0, 1], outputRange: [0.55, 1]})}],
      }}
    />
  );
};

// ─────────────────────────────────────────────
//  Helper sub-components
// ─────────────────────────────────────────────
const Row: React.FC<{label: string; value: string}> = ({label, value}) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue} numberOfLines={1} ellipsizeMode="middle">{value}</Text>
  </View>
);

interface BtnProps {
  label: string;
  onPress: () => void;
  primary?: boolean;
  ghost?: boolean;
}
const Btn: React.FC<BtnProps> = ({label, onPress, primary, ghost}) => (
  <TouchableOpacity
    style={[styles.btn, primary && styles.btnPrimary, ghost && styles.btnGhost]}
    onPress={onPress}
    activeOpacity={0.78}>
    <Text style={[styles.btnText, primary && styles.btnTextPrimary, ghost && styles.btnTextGhost]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ─────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────
const NFCSetupScreen: React.FC<Props> = ({onZoneReady}) => {
  const [phase,   setPhase]   = useState<Phase>('scanning');
  const [msg,     setMsg]     = useState('Hold phone to NFC tag');
  const [payload, setPayload] = useState<NFCPayload | null>(null);
  const [attempt, setAttempt] = useState(0);

  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const pulseLoop    = useRef<Animated.CompositeAnimation | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const verifyTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifyStart  = useRef<number>(0);
  const appStateRef  = useRef(AppState.currentState);
  // keep latest payload in a ref for AppState callback
  const payloadRef   = useRef<NFCPayload | null>(null);
  const phaseRef     = useRef<Phase>('scanning');

  // keep refs in sync
  useEffect(() => { payloadRef.current = payload; }, [payload]);
  useEffect(() => { phaseRef.current   = phase;   }, [phase]);

  // ── mount ──────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim, {toValue: 1, duration: 600, useNativeDriver: true}).start();
    initNfc();
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => {
      sub.remove();
      stopVerify();
      NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── pulse anim ─────────────────────────────
  useEffect(() => {
    if (phase === 'scanning') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {toValue: 1.22, duration: 900, useNativeDriver: true}),
          Animated.timing(pulseAnim, {toValue: 1.00, duration: 900, useNativeDriver: true}),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      Animated.timing(pulseAnim, {toValue: 1, duration: 200, useNativeDriver: true}).start();
    }
  }, [phase, pulseAnim]);

  // ── NFC init ───────────────────────────────
  const initNfc = async () => {
    try {
      const supported = await NfcManager.isSupported();
      if (!supported) { setPhase('error'); setMsg('NFC not supported'); return; }
      await NfcManager.start();
      startNfcRead();
    } catch {
      setPhase('error');
      setMsg('Failed to start NFC');
    }
  };

  // ── NFC read (re-arms on failure) ──────────
  const startNfcRead = useCallback(async () => {
    setPhase('scanning');
    setMsg('Hold phone to NFC tag');
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      if (!tag?.ndefMessage?.length) throw new Error('Empty tag');

      const rawText = Ndef.text.decodePayload(
        tag.ndefMessage[0].payload as unknown as Uint8Array,
      );
      const parsed = parseTagText(rawText);
      if (!parsed) {
        throw new Error(
          `Invalid tag content.\nRead: "${rawText}"\nExpected: zoneId=1;ssid=MyNet;apiBase=http://...`,
        );
      }

      await NfcManager.cancelTechnologyRequest();
      setPayload(parsed);
      setPhase('read_ok');
      setMsg(`Zone ${parsed.zoneId} found – connecting…`);
      await attemptConnect(parsed, 0);

    } catch (ex: any) {
      await NfcManager.cancelTechnologyRequest().catch(() => {});
      // only restart scan if we haven't progressed past scanning
      if (phaseRef.current === 'scanning') {
        setTimeout(startNfcRead, 600);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── parse "key=val;key=val" ─────────────────
  const parseTagText = (raw: string): NFCPayload | null => {
    try {
      const map: Record<string, string> = {};
      raw.trim().split(';').forEach(part => {
        const idx = part.indexOf('=');
        if (idx > 0) map[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
      });
      const {ssid, apiBase, zoneId, password} = map;
      if (!ssid || !apiBase || !zoneId) return null;
      return {ssid, apiBase, zoneId, password};
    } catch {
      return null;
    }
  };

  // ── WiFi connect ────────────────────────────
  const attemptConnect = async (p: NFCPayload, retry: number) => {
    setAttempt(retry);
    setPhase('connecting');
    setMsg(
      retry === 0
        ? `Connecting to "${p.ssid}"…`
        : `Retry ${retry}/${MAX_RETRIES - 1} → "${p.ssid}"…`,
    );

    const ok = await requestLocation();
    if (!ok) {
      setPhase('manual');
      setMsg('Location permission required for Wi-Fi');
      return;
    }

    try {
      await WifiManager.connectToProtectedSSID(
        p.ssid,
        p.password ?? '',   // open network = empty string
        false,              // isWEP
        false,              // isHidden
      );
    } catch (e) {
      // Some Android versions throw even when connection succeeds –
      // proceed to verification and let it confirm or time out.
      console.log('[WiFi] connectToProtectedSSID threw (may still succeed):', e);
    }

    beginVerify(p, retry);
  };

  // ── verify loop ─────────────────────────────
  const beginVerify = (p: NFCPayload, retry: number) => {
    setPhase('verifying');
    setMsg('Verifying connection…');
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: VERIFY_TIMEOUT_MS,
      useNativeDriver: false,
    }).start();

    stopVerify();
    verifyStart.current = Date.now();

    verifyTimer.current = setInterval(async () => {
      const elapsed = Date.now() - verifyStart.current;

      if (elapsed >= VERIFY_TIMEOUT_MS) {
        stopVerify();
        if (retry + 1 < MAX_RETRIES) {
          attemptConnect(p, retry + 1);
        } else {
          setPhase('manual');
          setMsg('Automatic connection failed.');
        }
        return;
      }

      try {
        const current = (await WifiManager.getCurrentWifiSSID()).replace(/"/g, '');
        if (current === p.ssid) {
          stopVerify();
          setPhase('success');
          setMsg(`Connected to "${p.ssid}"`);
          setTimeout(() => onZoneReady(p), 900);
        }
      } catch {
        /* not yet connected – keep polling */
      }
    }, VERIFY_POLL_MS);
  };

  const stopVerify = () => {
    if (verifyTimer.current) { clearInterval(verifyTimer.current); verifyTimer.current = null; }
  };

  // ── location permission ─────────────────────
  const requestLocation = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const r = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {title: 'Location needed', message: 'Required to scan/connect to Wi-Fi.', buttonPositive: 'Allow', buttonNegative: 'Deny'},
      );
      return r === PermissionsAndroid.RESULTS.GRANTED;
    } catch { return false; }
  };

  // ── AppState – user returns from Wi-Fi settings ──
  const onAppStateChange = async (next: AppStateStatus) => {
    if (
      appStateRef.current.match(/inactive|background/) &&
      next === 'active' &&
      phaseRef.current === 'manual' &&
      payloadRef.current
    ) {
      const p = payloadRef.current;
      try {
        const cur = (await WifiManager.getCurrentWifiSSID()).replace(/"/g, '');
        if (cur === p.ssid) {
          setPhase('success'); setMsg(`Connected to "${p.ssid}"`);
          setTimeout(() => onZoneReady(p), 900);
        } else {
          setMsg('Still not connected. Tap "Try Again" or open Settings.');
        }
      } catch {}
    }
    appStateRef.current = next;
  };

  // ── manual UI actions ──────────────────────
  const openWifiSettings = () => {
    Platform.OS === 'android'
      ? Linking.sendIntent('android.settings.WIFI_SETTINGS').catch(() =>
          Alert.alert('Error', 'Cannot open Wi-Fi settings'),
        )
      : Linking.openURL('App-Prefs:WIFI').catch(() => {});
  };

  const retryConnect = () => { if (payload) attemptConnect(payload, 0); };

  const rescan = async () => {
    stopVerify();
    setPayload(null);
    await NfcManager.cancelTechnologyRequest().catch(() => {});
    startNfcRead();
  };

  // ─────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────
  const isLoading = phase === 'connecting' || phase === 'verifying' || phase === 'read_ok';
  const isManual  = phase === 'manual' || phase === 'error';
  const isSuccess = phase === 'success';

  const iconBgColor    = isSuccess ? C.success : isManual ? '#92400e' : C.card;
  const iconBorderColor= isSuccess ? C.success : isManual ? C.warning  : isLoading ? C.primary : C.primary;

  return (
    <Animated.View style={[styles.root, {opacity: fadeAnim}]}>

      {/* Background wave rings (scanning only) */}
      {phase === 'scanning' && <>
        <Ring size={260} delay={0}   />
        <Ring size={320} delay={500} />
        <Ring size={380} delay={1000}/>
      </>}

      {/* Icon */}
      <Animated.View style={[
        styles.iconRing,
        {backgroundColor: iconBgColor, borderColor: iconBorderColor},
        phase === 'scanning' && {transform: [{scale: pulseAnim}]},
      ]}>
        {isLoading
          ? <ActivityIndicator size="large" color={C.primary} />
          : <Text style={styles.iconEmoji}>
              {isSuccess ? '✓' : isManual ? '⚠️' : '📲'}
            </Text>
        }
      </Animated.View>

      {/* Title */}
      <Text style={styles.title}>
        {phase === 'scanning'   ? 'NFC Zone Access'      :
         phase === 'read_ok'    ? 'Tag Detected'         :
         phase === 'connecting' ? 'Connecting'           :
         phase === 'verifying'  ? 'Verifying'            :
         phase === 'success'    ? 'Connected!'           :
         phase === 'manual'     ? 'Connection Required'  :
                                  'NFC Error'}
      </Text>
      <Text style={styles.subtitle}>{msg}</Text>

      {/* Progress bar (verifying only) */}
      {phase === 'verifying' && (
        <View style={styles.progressTrack}>
          <Animated.View style={[
            styles.progressFill,
            {width: progressAnim.interpolate({inputRange: [0,1], outputRange: ['0%','100%']})},
          ]}/>
        </View>
      )}

      {/* Detail card */}
      {payload && (
        <View style={styles.detailCard}>
          <Row label="Zone"    value={payload.zoneId} />
          <Row label="Network" value={payload.ssid}   />
          <Row label="API"     value={payload.apiBase}/>
          {isLoading && attempt > 0 && (
            <Row label="Attempt" value={`${attempt + 1} / ${MAX_RETRIES}`} />
          )}
        </View>
      )}

      {/* Manual fallback actions */}
      {phase === 'manual' && (
        <View style={styles.actions}>
          <Btn label="🔄  Try Again"           onPress={retryConnect}    primary />
          <Btn label="⚙️  Open Wi-Fi Settings" onPress={openWifiSettings}        />
          <Btn label="← Scan Different Tag"    onPress={rescan}          ghost   />
        </View>
      )}

      {/* Instruction box (scanning only) */}
      {phase === 'scanning' && (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📋  How to set up your NFC tag</Text>
          <Text style={styles.infoText}>
            {'1. Install "NFC Tools" on any phone or iPhone\n'}
            {'2. Write → Add record → Text\n'}
            {'3. Enter the tag content below\n'}
            {'4. Write to a physical NFC sticker\n'}
            {'5. Hold this Android to the sticker'}
          </Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>
              {'zoneId=1;ssid=YourWifi;apiBase=http://192.168.1.10:3090'}
            </Text>
          </View>
          <Text style={styles.infoNote}>
            Add{' '}
            <Text style={styles.codeInline}>;password=yourpass</Text>
            {' '}for password-protected networks.
          </Text>
        </View>
      )}

    </Animated.View>
  );
};

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingBottom: 36,
  },
  iconRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 26,
    elevation: 10,
    shadowColor: C.primary,
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.4,
    shadowRadius: 14,
  },
  iconEmoji: {fontSize: 50},
  title: {
    fontSize: 25,
    fontWeight: '900',
    color: C.white,
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
    paddingHorizontal: 6,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: C.card,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 18,
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.primary,
    borderRadius: 2,
  },
  detailCard: {
    width: '100%',
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '700',
    color: C.white,
    maxWidth: '65%',
  },
  actions: {width: '100%', gap: 10, marginBottom: 6},
  btn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  btnPrimary: {
    backgroundColor: C.primary,
    borderColor: C.primary,
    shadowColor: C.primary,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  btnGhost: {backgroundColor: 'transparent', borderColor: 'transparent'},
  btnText:        {fontSize: 15, fontWeight: '700', color: C.muted},
  btnTextPrimary: {color: C.white},
  btnTextGhost:   {color: C.dim, fontSize: 14},
  infoBox: {
    width: '100%',
    marginTop: 14,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
  },
  infoTitle: {fontSize: 14, fontWeight: '800', color: C.white, marginBottom: 12},
  infoText:  {fontSize: 13, color: C.muted, lineHeight: 23, marginBottom: 14},
  codeBox: {
    backgroundColor: '#0d1a2d',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.4)',
    marginBottom: 12,
  },
  codeText: {
    fontSize: 12,
    color: C.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    lineHeight: 18,
  },
  infoNote: {fontSize: 12, color: C.dim, lineHeight: 18},
  codeInline: {
    color: C.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 12,
  },
});

export default NFCSetupScreen;