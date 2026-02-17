import React, {useEffect, useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Platform,
  Linking,
  AppState,
  AppStateStatus,
  PermissionsAndroid,
  Image,
} from 'react-native';
import WifiManager from 'react-native-wifi-reborn';

// ─────────────────────────────────────────────────────
//  ⚙️  ZONE CONFIG
//  These values come from your QR / NFC tag.
//  Later: parse dynamically from tag content.
// ─────────────────────────────────────────────────────
const ZONE_CONFIG = {
  ssid:    'Airtel_sultans',             // must match EXACTLY (case-sensitive)
  apiBase: 'http://192.168.1.28:3090',
  zoneId:  '1',
};

// ─────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────
interface Props {
  onZoneReady: (config: {zoneId: string; apiBase: string; ssid: string}) => void;
}

type Phase =
  | 'checking'    // app just opened – checking current SSID
  | 'show_qr'     // not on correct WiFi – show QR to scan
  | 'connecting'  // trying WifiManager (Android only)
  | 'verifying'   // polling SSID after connect attempt
  | 'success'     // correct SSID confirmed
  | 'wrong_wifi'; // on WiFi but wrong network

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

const VERIFY_POLL_MS    = 1_500;
const VERIFY_TIMEOUT_MS = 15_000;
const MAX_RETRIES       = 2;

// ─────────────────────────────────────────────────────
//  Animated ring
// ─────────────────────────────────────────────────────
const Ring: React.FC<{size: number; delay: number; color?: string}> = ({
  size, delay, color = C.primary,
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {toValue: 1, duration: 2200, useNativeDriver: true}),
      ]),
    ).start();
  }, [anim, delay]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 1.5, borderColor: color,
        opacity:   anim.interpolate({inputRange:[0,0.4,1], outputRange:[0,0.25,0]}),
        transform: [{scale: anim.interpolate({inputRange:[0,1], outputRange:[0.5,1]})}],
      }}
    />
  );
};

// ─────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────
const WifiSetupScreen: React.FC<Props> = ({onZoneReady}) => {
  const [phase,      setPhase]      = useState<Phase>('checking');
  const [statusMsg,  setStatusMsg]  = useState('Checking connection…');
  const [currentNet, setCurrentNet] = useState<string>('');
  const [attempt,    setAttempt]    = useState(0);

  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const verifyTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifyStart  = useRef(0);
  const phaseRef     = useRef<Phase>('checking');
  const appStateRef  = useRef(AppState.currentState);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── mount ──────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim, {toValue:1, duration:500, useNativeDriver:true}).start();
    checkConnection();
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => { sub.remove(); stopVerify(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── pulse anim for QR icon ─────────────────────────
  useEffect(() => {
    if (phase === 'show_qr') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {toValue:1.08, duration:1200, useNativeDriver:true}),
          Animated.timing(pulseAnim, {toValue:1.00, duration:1200, useNativeDriver:true}),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [phase, pulseAnim]);

  // ── check if already on correct WiFi ──────────────
  const checkConnection = useCallback(async () => {
    setPhase('checking');
    setStatusMsg('Checking connection…');
    try {
      const ssid = (await WifiManager.getCurrentWifiSSID()).replace(/"/g, '');
      setCurrentNet(ssid);
      if (ssid === ZONE_CONFIG.ssid) {
        handleSuccess();
      } else if (ssid && ssid !== '<unknown ssid>') {
        setPhase('wrong_wifi');
        setStatusMsg(`Connected to "${ssid}" — need "${ZONE_CONFIG.ssid}"`);
      } else {
        setPhase('show_qr');
        setStatusMsg('Scan the QR code to connect');
      }
    } catch {
      setPhase('show_qr');
      setStatusMsg('Scan the QR code to connect');
    }
  }, []);

  // ── handle confirmed success ───────────────────────
  const handleSuccess = () => {
    stopVerify();
    setPhase('success');
    setStatusMsg(`Connected to "${ZONE_CONFIG.ssid}"`);
    setTimeout(() => onZoneReady(ZONE_CONFIG), 900);
  };

  // ── Android: try to connect programmatically ───────
  const tryAutoConnect = async (retry = 0) => {
    if (Platform.OS === 'ios') {
      // iOS cannot connect programmatically — just show QR
      setPhase('show_qr');
      setStatusMsg('Scan QR with camera to connect');
      return;
    }

    setAttempt(retry);
    setPhase('connecting');
    setStatusMsg(
      retry === 0
        ? `Connecting to "${ZONE_CONFIG.ssid}"…`
        : `Retry ${retry}/${MAX_RETRIES}…`,
    );

    const granted = await requestLocation();
    if (!granted) {
      setPhase('show_qr');
      setStatusMsg('Location permission needed — or scan QR with camera');
      return;
    }

    try {
      await WifiManager.connectToProtectedSSID(
        ZONE_CONFIG.ssid,
        (ZONE_CONFIG as any).password ?? '',
        false, false,
      );
    } catch (e) {
      console.log('[WiFi] connect threw (may still work):', e);
    }

    beginVerify(retry);
  };

  // ── poll SSID ──────────────────────────────────────
  const beginVerify = (retry: number) => {
    setPhase('verifying');
    setStatusMsg('Verifying connection…');
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1, duration: VERIFY_TIMEOUT_MS, useNativeDriver: false,
    }).start();

    stopVerify();
    verifyStart.current = Date.now();

    verifyTimer.current = setInterval(async () => {
      if (Date.now() - verifyStart.current >= VERIFY_TIMEOUT_MS) {
        stopVerify();
        if (retry + 1 <= MAX_RETRIES) {
          tryAutoConnect(retry + 1);
        } else {
          setPhase('show_qr');
          setStatusMsg('Auto-connect failed — scan QR with camera app');
        }
        return;
      }
      try {
        const ssid = (await WifiManager.getCurrentWifiSSID()).replace(/"/g, '');
        setCurrentNet(ssid);
        if (ssid === ZONE_CONFIG.ssid) handleSuccess();
      } catch {}
    }, VERIFY_POLL_MS);
  };

  const stopVerify = () => {
    if (verifyTimer.current) { clearInterval(verifyTimer.current); verifyTimer.current = null; }
  };

  // ── permissions ────────────────────────────────────
  const requestLocation = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const r = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {title:'Permission needed', message:'Required to connect to WiFi', buttonPositive:'Allow', buttonNegative:'Cancel'},
      );
      return r === PermissionsAndroid.RESULTS.GRANTED;
    } catch { return false; }
  };

  // ── AppState: user returns from Camera / Settings ──
  const onAppStateChange = async (next: AppStateStatus) => {
    if (appStateRef.current.match(/inactive|background/) && next === 'active') {
      // User may have just scanned QR with camera — check immediately
      if (['show_qr', 'wrong_wifi', 'connecting'].includes(phaseRef.current)) {
        setStatusMsg('Checking connection…');
        await checkConnection();
      }
    }
    appStateRef.current = next;
  };

  const openWifiSettings = () =>
    Platform.OS === 'android'
      ? Linking.sendIntent('android.settings.WIFI_SETTINGS').catch(()=>{})
      : Linking.openURL('App-Prefs:WIFI').catch(()=>{});

  // ─────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────
  const isLoading = phase === 'checking' || phase === 'connecting' || phase === 'verifying';

  return (
    <Animated.View style={[styles.root, {opacity: fadeAnim}]}>

      {/* Background rings */}
      {phase === 'show_qr' && <>
        <Ring size={340} delay={0}    color={C.primary} />
        <Ring size={420} delay={600}  color={C.primary} />
        <Ring size={500} delay={1200} color={C.primary} />
      </>}
      {phase === 'success' && <>
        <Ring size={260} delay={0}   color={C.success} />
        <Ring size={340} delay={400} color={C.success} />
      </>}

      {/* ── QR display ── */}
      {phase === 'show_qr' && (
        <Animated.View style={[styles.qrWrapper, {transform:[{scale:pulseAnim}]}]}>
          <View style={styles.qrCard}>
            <Image
              source={require('../assets/wifi_qr.png')}
              style={styles.qrImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.qrLabel}>
            <Text style={styles.qrLabelText}>📷  Scan with Camera App</Text>
          </View>
        </Animated.View>
      )}

      {/* ── Loading / success icon ── */}
      {phase !== 'show_qr' && (
        <View style={[
          styles.iconRing,
          phase === 'success'    && styles.iconRingSuccess,
          phase === 'wrong_wifi' && styles.iconRingWarn,
          isLoading              && styles.iconRingLoading,
        ]}>
          {isLoading
            ? <ActivityIndicator size="large" color={C.primary} />
            : <Text style={styles.iconEmoji}>
                {phase === 'success'    ? '✓'  :
                 phase === 'wrong_wifi' ? '⚠️' : '📶'}
              </Text>
          }
        </View>
      )}

      {/* ── Title ── */}
      <Text style={styles.title}>
        {phase === 'checking'   ? 'Checking WiFi…'      :
         phase === 'show_qr'    ? 'Scan to Connect'     :
         phase === 'connecting' ? 'Connecting…'         :
         phase === 'verifying'  ? 'Verifying…'          :
         phase === 'success'    ? 'Connected!'          :
                                  'Wrong Network'}
      </Text>
      <Text style={styles.subtitle}>{statusMsg}</Text>

      {/* ── Progress bar ── */}
      {phase === 'verifying' && (
        <View style={styles.progressTrack}>
          <Animated.View style={[
            styles.progressFill,
            {width: progressAnim.interpolate({inputRange:[0,1], outputRange:['0%','100%']})},
          ]} />
        </View>
      )}

      {/* ── Info card ── */}
      {phase === 'show_qr' && (
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>How to connect</Text>

          <Step n="1" text="Open your phone Camera app" />
          <Step n="2" text={`Point at the QR code above`} />
          <Step n="3" text={`Tap "Join Network" when prompted`} />
          <Step n="4" text="Return to this app — it connects automatically" />

          <View style={styles.divider} />

          <View style={styles.networkRow}>
            <Text style={styles.networkLabel}>Network</Text>
            <Text style={styles.networkValue}>{ZONE_CONFIG.ssid}</Text>
          </View>
          <View style={styles.networkRow}>
            <Text style={styles.networkLabel}>Zone</Text>
            <Text style={styles.networkValue}>{ZONE_CONFIG.zoneId}</Text>
          </View>
        </View>
      )}

      {/* ── Wrong WiFi card ── */}
      {phase === 'wrong_wifi' && (
        <View style={[styles.infoCard, styles.warnCard]}>
          <Text style={styles.warnTitle}>⚠️  Wrong Network</Text>
          <Text style={styles.warnText}>
            You are connected to:{'\n'}
            <Text style={styles.warnHighlight}>"{currentNet}"</Text>
          </Text>
          <Text style={styles.warnText}>
            You need to connect to:{'\n'}
            <Text style={styles.warnHighlight}>"{ZONE_CONFIG.ssid}"</Text>
          </Text>
        </View>
      )}

      {/* ── Action buttons ── */}
      <View style={styles.actions}>
        {(phase === 'show_qr' || phase === 'wrong_wifi') && (
          <>
            {Platform.OS === 'android' && (
              <Btn
                label="⚡  Auto-Connect (Android)"
                onPress={() => tryAutoConnect(0)}
                primary
              />
            )}
            <Btn
              label="⚙️  Open WiFi Settings"
              onPress={openWifiSettings}
            />
            <Btn
              label="🔄  Already Connected – Check Again"
              onPress={checkConnection}
              ghost
            />
          </>
        )}

        {(phase === 'connecting' || phase === 'verifying') && (
          <Btn
            label="Show QR Instead"
            onPress={() => { stopVerify(); setPhase('show_qr'); setStatusMsg('Scan QR with camera to connect'); }}
            ghost
          />
        )}
      </View>

    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────
//  Step helper
// ─────────────────────────────────────────────────────
const Step: React.FC<{n: string; text: string}> = ({n, text}) => (
  <View style={styles.step}>
    <View style={styles.stepNum}>
      <Text style={styles.stepNumText}>{n}</Text>
    </View>
    <Text style={styles.stepText}>{text}</Text>
  </View>
);

const Btn: React.FC<{
  label: string; onPress: () => void; primary?: boolean; ghost?: boolean;
}> = ({label, onPress, primary, ghost}) => (
  <TouchableOpacity
    style={[styles.btn, primary && styles.btnPrimary, ghost && styles.btnGhost]}
    onPress={onPress} activeOpacity={0.78}>
    <Text style={[styles.btnText, primary && styles.btnTextPrimary, ghost && styles.btnTextGhost]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ─────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex:1, backgroundColor:C.bg,
    alignItems:'center', justifyContent:'center',
    paddingHorizontal:24, paddingBottom:30,
  },

  // QR
  qrWrapper:   {alignItems:'center', marginBottom:20},
  qrCard: {
    width:220, height:220, borderRadius:20,
    backgroundColor:C.white, padding:14,
    shadowColor:C.primary, shadowOffset:{width:0,height:8},
    shadowOpacity:0.5, shadowRadius:20, elevation:12,
  },
  qrImage:  {width:'100%', height:'100%'},
  qrLabel: {
    marginTop:12, backgroundColor:'rgba(59,130,246,0.15)',
    borderRadius:20, paddingHorizontal:16, paddingVertical:7,
    borderWidth:1, borderColor:'rgba(59,130,246,0.4)',
  },
  qrLabelText: {fontSize:14, fontWeight:'700', color:C.primary},

  // Icon
  iconRing: {
    width:110, height:110, borderRadius:55,
    borderWidth:2.5, borderColor:C.border, backgroundColor:C.card,
    justifyContent:'center', alignItems:'center',
    marginBottom:22, elevation:8,
    shadowColor:C.primary, shadowOffset:{width:0,height:6},
    shadowOpacity:0.35, shadowRadius:12,
  },
  iconRingSuccess: {borderColor:C.success, backgroundColor:'#064e3b'},
  iconRingWarn:    {borderColor:C.warning, backgroundColor:'#78350f'},
  iconRingLoading: {borderColor:C.primary},
  iconEmoji: {fontSize:46},

  title: {
    fontSize:24, fontWeight:'900', color:C.white,
    letterSpacing:-0.5, marginBottom:8, textAlign:'center',
  },
  subtitle: {
    fontSize:14, color:C.muted, textAlign:'center',
    lineHeight:21, marginBottom:16, paddingHorizontal:8,
  },

  // Progress
  progressTrack: {
    width:'100%', height:4, backgroundColor:C.card,
    borderRadius:2, overflow:'hidden', marginBottom:16,
  },
  progressFill:  {height:'100%', backgroundColor:C.primary, borderRadius:2},

  // Info card
  infoCard: {
    width:'100%', backgroundColor:C.card, borderRadius:16,
    borderWidth:1, borderColor:C.border, padding:18, marginBottom:16,
  },
  infoCardTitle: {
    fontSize:14, fontWeight:'800', color:C.white, marginBottom:14,
  },
  warnCard:      {borderColor:C.warning},
  warnTitle:     {fontSize:15, fontWeight:'800', color:C.warning, marginBottom:12},
  warnText:      {fontSize:13, color:C.muted, marginBottom:10, lineHeight:22},
  warnHighlight: {color:C.white, fontWeight:'800'},

  // Steps
  step: {flexDirection:'row', alignItems:'center', marginBottom:10, gap:12},
  stepNum: {
    width:26, height:26, borderRadius:13,
    backgroundColor:C.primary, justifyContent:'center', alignItems:'center',
    flexShrink:0,
  },
  stepNumText: {fontSize:13, fontWeight:'800', color:C.white},
  stepText:    {fontSize:13, color:C.muted, flex:1, lineHeight:20},

  // Network rows
  divider:      {height:1, backgroundColor:C.border, marginVertical:12},
  networkRow:   {flexDirection:'row', justifyContent:'space-between', paddingVertical:6},
  networkLabel: {fontSize:12, fontWeight:'700', color:C.dim, textTransform:'uppercase', letterSpacing:0.8},
  networkValue: {fontSize:13, fontWeight:'800', color:C.white},

  // Buttons
  actions: {width:'100%', gap:10},
  btn: {
    width:'100%', paddingVertical:14, borderRadius:12,
    alignItems:'center', backgroundColor:C.card,
    borderWidth:1.5, borderColor:C.border,
  },
  btnPrimary: {
    backgroundColor:C.primary, borderColor:C.primary,
    shadowColor:C.primary, shadowOffset:{width:0,height:4},
    shadowOpacity:0.4, shadowRadius:8, elevation:5,
  },
  btnGhost:       {backgroundColor:'transparent', borderColor:'transparent'},
  btnText:        {fontSize:14, fontWeight:'700', color:C.muted},
  btnTextPrimary: {color:C.white, fontSize:15},
  btnTextGhost:   {color:C.dim,  fontSize:13},
});

export default WifiSetupScreen;