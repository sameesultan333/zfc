import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  formatValue,
  POLL_INTERVAL,
  SENSOR_FRIENDLY_NAMES,
  SENSOR_ORDER,
  SMData,
  STATUS_ORDER,
  ZoneData,
} from './zone/shared';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#F5F6FA',
  card: '#FFFFFF',
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  success: '#16A34A',
  successLight: '#F0FDF4',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  text: '#0F172A',
  sub: '#64748B',
  border: '#E2E8F0',
  muted: '#CBD5E1',
  offline: '#94A3B8',
};

// ─── Animated Press ───────────────────────────────────────────────────────────
const PressBtn: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  style?: object;
}> = ({ onPress, children, style }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.88, useNativeDriver: true, speed: 60 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 60 }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
};

// ─── Online Dot ───────────────────────────────────────────────────────────────
const OnlineDot: React.FC<{ online: boolean }> = ({ online }) => {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!online) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [online]);

  return (
    <View style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
      {online && (
        <Animated.View
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: C.success,
            opacity: 0.3,
            transform: [{ scale: pulse }],
          }}
        />
      )}
      <View style={[hs.dot, { backgroundColor: online ? C.success : C.offline }]} />
    </View>
  );
};

// ─── Section Label ────────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ text: string; index?: number }> = ({ text, index = 0 }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 350, delay: index * 80, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[hs.sectionRow, { opacity: anim }]}>
      <Text style={hs.sectionText}>{text}</Text>
      <View style={hs.sectionLine} />
    </Animated.View>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  name: string;
  value: string | number;
  isError?: boolean;
  isLow?: boolean;
  index: number;
}> = ({ name, value, isError, isLow, index }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim, { toValue: 1, duration: 380, delay: index * 45, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 380, delay: index * 45, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const isAlert = isError || isLow;
  const alertColor = isError ? C.danger : isLow ? C.warning : C.primary;
  const alertBg = isError ? C.dangerLight : isLow ? C.warningLight : C.card;

  return (
    <Animated.View
      style={[
        hs.statCard,
        isAlert && { borderColor: alertColor + '60', backgroundColor: alertBg },
        { opacity: anim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={[hs.statValue, { color: isAlert ? alertColor : C.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={hs.statName} numberOfLines={1}>{name}</Text>
      {isAlert && <View style={[hs.statAlertBar, { backgroundColor: alertColor }]} />}
    </Animated.View>
  );
};

// ─── Status Pill ─────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  valve_status: 'Valve',
  water_pump_status: 'Water Pump',
  eca_pump_status: 'EC-A Pump',
  ecb_pump_status: 'EC-B Pump',
  ph_up_pump_status: 'pH Up Pump',
  ph_down_pump_status: 'pH Down Pump',
  fan_status: 'Fan',
  curtain_status: 'Curtain',
  fogger_status: 'Fogger',
  light_status: 'Light',
  macro_status: 'Macro',
  micro_status: 'Micro',
};

const StatusPill: React.FC<{ name: string; status: number; index: number }> = ({ name, status, index }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 300, delay: index * 40, useNativeDriver: true }).start();
  }, []);

  const isOn = status === 1;
  return (
    <Animated.View style={[hs.pill, isOn ? hs.pillOn : hs.pillOff, { opacity: anim }]}>
      <View style={[hs.pillDot, { backgroundColor: isOn ? C.success : C.muted }]} />
      <Text style={[hs.pillText, { color: isOn ? C.success : C.sub }]} numberOfLines={1}>
        {STATUS_LABELS[name] || name}
      </Text>
    </Animated.View>
  );
};

// ─── Banner ───────────────────────────────────────────────────────────────────
const Banner: React.FC<{ message: string; type: 'error' | 'warning' }> = ({ message, type }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18 }).start();
  }, []);

  const isError = type === 'error';
  return (
    <Animated.View
      style={[
        hs.banner,
        isError ? hs.bannerError : hs.bannerWarning,
        { opacity: anim, transform: [{ scaleY: anim }] },
      ]}
    >
      <View style={[hs.bannerDot, { backgroundColor: isError ? C.danger : C.warning }]} />
      <Text style={[hs.bannerText, { color: isError ? C.danger : C.warning }]}>{message}</Text>
    </Animated.View>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  zoneId: string;
  apiBase: string;
  onOpenPin: () => void;
  onExit: () => void;
  onOnlineChange: (value: boolean) => void;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
const HomeScreen: React.FC<Props> = ({ zoneId, apiBase, onOpenPin, onExit, onOnlineChange }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [zoneData, setZoneData] = useState<ZoneData | null>(null);
  const [smData, setSmData] = useState<SMData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('Loading...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const lastSuccessfulPollRef = useRef<number | null>(null);
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);

  const extractPayload = (data: any) => {
    if (!data) return {};
    if (data.payload && typeof data.payload === 'object') return data.payload;
    if (data.data && typeof data.data === 'object') return data.data;
    if (Array.isArray(data)) return data[0] || {};
    if (typeof data === 'object') return data;
    return {};
  };

  const normalizePayload = (payload: any) => {
    const soilValues = Array.isArray(payload.soil_moisture) ? payload.soil_moisture : [];
    return {
      temperature: payload.Temp_value,
      tp4_temperature: payload.TP4_TEMP_Value,
      humidity: payload.hum_Value,
      lux: payload.Lux,
      water_temp: payload.Wtemp,
      ph: payload.pH,
      ec: payload.EC,
      ec_a: payload.Ec_A,
      ec_b: payload.Ec_B,
      ph_up: payload.pH_Up,
      ph_down: payload.pH_Down,
      water_level: payload.W_lvlstatus,
      ...soilValues.reduce((acc: Record<string, any>, value: any, index: number) => {
        acc[`soil_moisture_${index + 1}`] = value;
        return acc;
      }, {}),
      valve_status: payload.valve_status,
      water_pump_status: payload.waterpump_status,
      eca_pump_status: payload.EcApump_status,
      ecb_pump_status: payload.EcBpump_status,
      ph_up_pump_status: payload.pHUppump_status,
      ph_down_pump_status: payload.pHDownpump_status,
      fan_status: payload.FAN_Status,
      curtain_status: payload.Curtain_Status,
      fogger_status: payload.Fogger_Status,
      light_status: payload.LIGHT_status,
      macro_status: payload.Macro_status,
      micro_status: payload.Micro_status,
      pump_ON_count: payload.pump_ON_count,
      Nutrient1: payload.Nutrient1,
      Nutrient2: payload.Nutrient2,
      Nutrient3: payload.Nutrient3,
      Nutrient4: payload.Nutrient4,
      tank_fill_count: payload.tank_fill_count,
      EC_ON_count: payload.EC_ON_count,
      PHD_ON_count: payload.PHD_ON_count,
      PHUP_ON_count: payload.PHUP_ON_count,
      pump_on_hours: payload.pump_on_hours,
    };
  };

  const fetchData = useCallback(async () => {
    try {
      const modeResponses = await Promise.allSettled([
        fetch(`${apiBase}/data?mode=1`).then(r => { if (!r.ok) throw new Error('Mode 1 failed'); return r.json(); }),
        fetch(`${apiBase}/data?mode=2`).then(r => { if (!r.ok) throw new Error('Mode 2 failed'); return r.json(); }),
        fetch(`${apiBase}/data?mode=3`).then(r => { if (!r.ok) throw new Error('Mode 3 failed'); return r.json(); }),
      ]);

      const payloads = modeResponses
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => extractPayload(r.value));

      const rawPayload = payloads.reduce((acc, p) => ({ ...acc, ...p }), {});
      if (Object.keys(rawPayload).length === 0) throw new Error('No data returned from device');

      const merged = normalizePayload(rawPayload);
      if (merged.temperature === undefined && merged.water_temp === undefined && merged.valve_status === undefined) {
        throw new Error('Device response format not matched');
      }

      setZoneData({ timestamp: Date.now(), payload: merged });

      const soilKeys = Object.keys(merged).filter(k => k.startsWith('soil_moisture_'));
      setSmData({
        payload: soilKeys.reduce((acc, k) => ({ ...acc, [k]: merged[k as keyof typeof merged] }), {}),
        no_of_soil_sensors: soilKeys.length,
      });

      setErrorMsg(null);
      lastSuccessfulPollRef.current = Date.now();
      setIsOnline(true);
      onOnlineChange(true);
      setLastUpdated(new Date().toLocaleTimeString());
      setRefreshing(false);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Connection failed');
      if (!lastSuccessfulPollRef.current || Date.now() - lastSuccessfulPollRef.current > POLL_INTERVAL) {
        setIsOnline(false);
        onOnlineChange(false);
      }
      setRefreshing(false);
    }
  }, [apiBase, onOnlineChange]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  const renderSensors = () => {
    if (!zoneData) return null;
    const payload = zoneData.payload || {};
    let idx = 0;
    return SENSOR_ORDER.map(key => {
      if (payload[key as keyof typeof payload] === undefined) return null;
      let displayValue: string | number = payload[key as keyof typeof payload] as any;
      if (key === 'water_level') {
        displayValue = displayValue === 0 ? 'Low' : displayValue === 1 ? 'Mid' : 'High';
      }
      const isError = key !== 'lux' && Number(displayValue) >= 6500;
      const isLow = displayValue === 'Low';
      const formattedValue = isError ? 'ERR' : formatValue(key, displayValue);
      return (
        <View key={key} style={hs.gridItem}>
          <StatCard
            name={SENSOR_FRIENDLY_NAMES[key] || key}
            value={formattedValue}
            isError={isError}
            isLow={isLow}
            index={idx++}
          />
        </View>
      );
    });
  };

  const renderSoil = () => {
    if (!smData) return null;
    const payload = smData.payload || {};
    let idx = 0;
    return Object.keys(payload)
      .filter(k => k.startsWith('soil_moisture_'))
      .map(key => {
        const index = key.split('_')[2];
        const value = payload[key];
        const numericValue = Number(value);
        const isError = value === undefined || value === null || isNaN(numericValue);
        return (
          <View key={key} style={hs.gridItem}>
            <StatCard
              name={`Soil ${index}`}
              value={isError ? 'ERR' : `${numericValue}%`}
              isError={isError}
              isLow={false}
              index={idx++}
            />
          </View>
        );
      });
  };

  const renderStatus = () => {
    if (!zoneData) return null;
    const payload = zoneData.payload || {};
    let idx = 0;
    return STATUS_ORDER.map(key => {
      if (payload[key as keyof typeof payload] === undefined) return null;
      return (
        <StatusPill
          key={key}
          name={key}
          status={Number(payload[key as keyof typeof payload])}
          index={idx++}
        />
      );
    });
  };

  return (
    <View style={hs.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      {/* ── Header ── */}
      <Animated.View style={[hs.header, { opacity: headerAnim }]}>
        {/* Left: zone info */}
        <View style={hs.headerLeft}>
          <View style={hs.zoneTag}>
            <Text style={hs.zoneTagText}>ZONE</Text>
            <Text style={hs.zoneId}>{zoneId}</Text>
          </View>
          <View style={hs.onlineRow}>
            <OnlineDot online={isOnline} />
            <Text style={[hs.onlineText, { color: isOnline ? C.success : C.offline }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        {/* Right: Settings + Exit */}
        <View style={hs.headerRight}>
          <PressBtn onPress={onOpenPin} style={hs.settingsBtn}>
            <View style={hs.settingsBtnInner}>
              {/* Gear icon — 3 lines */}
              <View style={hs.gearDot} />
              <View style={[hs.gearDot, { width: 14 }]} />
              <View style={hs.gearDot} />
            </View>
            <Text style={hs.settingsBtnText}>Settings</Text>
          </PressBtn>

          <PressBtn onPress={onExit} style={hs.exitBtn}>
            {/* Exit arrow icon */}
            <View style={hs.exitIcon}>
              <View style={hs.exitArrow} />
              <View style={hs.exitBox} />
            </View>
            <Text style={hs.exitBtnText}>Exit</Text>
          </PressBtn>
        </View>
      </Animated.View>

      {/* ── Last updated bar ── */}
      <View style={hs.updateBar}>
        <View style={[hs.updateDot, { backgroundColor: isOnline ? C.success : C.muted }]} />
        <Text style={hs.updateText}>Last updated: {lastUpdated}</Text>
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={hs.scroll}
        contentContainerStyle={hs.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            colors={[C.primary]}
            tintColor={C.primary}
          />
        }
      >
        {/* Banners */}
        {errorMsg && <Banner message={errorMsg} type="error" />}
        {!isOnline && <Banner message="Device offline — save disabled" type="warning" />}

        {/* Environment */}
        <SectionLabel text="Environment" index={0} />
        <View style={hs.grid}>{renderSensors()}</View>

        {/* Soil */}
        {smData && smData.no_of_soil_sensors > 0 && (
          <>
            <SectionLabel text="Soil Moisture" index={1} />
            <View style={hs.grid}>{renderSoil()}</View>
          </>
        )}

        {/* System Status */}
        <SectionLabel text="System Status" index={2} />
        <View style={hs.pillGrid}>{renderStatus()}</View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
};

export default HomeScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const hs = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 4 },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  zoneTag: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  zoneTagText: { fontSize: 10, fontWeight: '700', color: C.sub, letterSpacing: 1.2 },
  zoneId: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  onlineText: { fontSize: 12, fontWeight: '600' },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  // Settings button
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  settingsBtnInner: { gap: 2.5, justifyContent: 'center', alignItems: 'flex-end' },
  gearDot: { width: 16, height: 2, backgroundColor: C.primary, borderRadius: 1 },
  settingsBtnText: { fontSize: 13, fontWeight: '600', color: C.primary },

  // Exit button
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.dangerLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  exitIcon: { width: 16, height: 14, justifyContent: 'center', alignItems: 'center' },
  exitArrow: {
    position: 'absolute',
    width: 8,
    height: 2,
    backgroundColor: C.danger,
    borderRadius: 1,
    right: 0,
  },
  exitBox: {
    width: 8,
    height: 10,
    borderWidth: 1.5,
    borderColor: C.danger,
    borderRadius: 2,
    position: 'absolute',
    left: 0,
  },
  exitBtnText: { fontSize: 13, fontWeight: '600', color: C.danger },

  // Update bar
  updateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 6,
  },
  updateDot: { width: 5, height: 5, borderRadius: 3 },
  updateText: { fontSize: 11, color: C.sub, fontWeight: '500' },

  // Section
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 14,
    gap: 10,
  },
  sectionText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.sub,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: C.border },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  gridItem: { width: '33.33%', padding: 4 },

  // Stat card
  statCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 12,
    minHeight: 76,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 },
      android: { elevation: 1 },
    }),
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: C.text,
  },
  statName: {
    fontSize: 10,
    fontWeight: '600',
    color: C.sub,
    letterSpacing: 0.2,
    marginTop: 4,
  },
  statAlertBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 3,
    height: '100%',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },

  // Status pills
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
  },
  pillOn: {
    backgroundColor: C.successLight,
    borderColor: '#BBF7D0',
  },
  pillOff: {
    backgroundColor: '#F8FAFC',
    borderColor: C.border,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, fontWeight: '600' },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
  },
  bannerError: { backgroundColor: C.dangerLight, borderColor: '#FECACA' },
  bannerWarning: { backgroundColor: C.warningLight, borderColor: '#FDE68A' },
  bannerDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '500' },
});