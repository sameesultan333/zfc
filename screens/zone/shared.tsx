import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ZoneData {
  timestamp: number;
  payload: Record<string, any>;
}

export interface SMData {
  payload: Record<string, any>;
  no_of_soil_sensors: number;
}

export interface Schedule {
  id: number;
  active: boolean;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export type SyncStatus = 'idle' | 'pending' | 'confirmed' | 'failed';

export interface HistoryEntry {
  type: 'setpoints' | 'schedule';
  mode: number;
  timestamp: number;
  changes: string[];
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  status: 'confirmed' | 'failed' | 'pending';
}

export interface SetpointConfig {
  label: string;
  key: string;
  unit: string;
  min: number;
  max: number;
  section: string;
  icon: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const CORRECT_PIN         = '1234';
export const POLL_INTERVAL       = 10000;
export const SYNC_TIMEOUT        = 30000;
export const FLOAT_TOLERANCE     = 0.01;
export const HISTORY_STORAGE_KEY = 'zone_history';

export const COLORS = {
  bg:           '#F8FAFC',
  card:         '#FFFFFF',
  textMain:     '#0F172A',
  textSub:      '#64748B',
  primary:      '#3B82F6',
  primaryDark:  '#2563EB',
  primaryLight: '#DBEAFE',
  success:      '#10B981',
  successLight: '#D1FAE5',
  error:        '#EF4444',
  errorLight:   '#FEE2E2',
  warning:      '#F59E0B',
  warningLight: '#FEF3C7',
  border:       '#E2E8F0',
  borderLight:  '#F1F5F9',
  purple:       '#8B5CF6',
  purpleLight:  '#EDE9FE',
  orange:       '#F97316',
  orangeLight:  '#FFEDD5',
  teal:         '#14B8A6',
  tealLight:    '#CCFBF1',
  glass:        'rgba(255,255,255,0.9)',
};

// ─────────────────────────────────────────────────────────────────────────────
// Sensor / Status ordering
// ─────────────────────────────────────────────────────────────────────────────

export const SENSOR_ORDER = [
  'temperature', 'tp4_temperature', 'humidity',    'lux',
  'water_temp',  'ph',              'ec',           'water_level',
  'ec_a',        'ec_b',            'ph_up',        'ph_down',
];

export const STATUS_ORDER = [
  'valve_status',      'water_pump_status', 'eca_pump_status',   'ecb_pump_status',
  'ph_up_pump_status', 'ph_down_pump_status','fan_status',        'curtain_status',
  'fogger_status',     'light_status',      'micro_status',      'macro_status',
];

export const SENSOR_FRIENDLY_NAMES: Record<string, string> = {
  temperature:     'Air Temp 1',
  tp4_temperature: 'Air Temp 2',
  humidity:        'Humidity',
  lux:             'Light',
  water_temp:      'Water Temp',
  ph:              'pH',
  ec:              'EC',
  ec_a:            'Tank A',
  ec_b:            'Tank B',
  ph_up:           'pH Up',
  ph_down:         'pH Down',
  water_level:     'Water Level',
};

// ─────────────────────────────────────────────────────────────────────────────
// Setpoint configs  (growLightON / growLightOFF removed)
// ─────────────────────────────────────────────────────────────────────────────

export const SETPOINT_CONFIGS: SetpointConfig[] = [
  // Environment
  { label: 'Total Soil Sensors',   key: 'totalSoilSensors',       unit: 'count', min: 0, max: 10,    section: 'Environment', icon: 'SS' },
  { label: 'Lux Minimum',          key: 'luxMinimum',             unit: 'lux',   min: 0, max: 10000, section: 'Environment', icon: 'LM' },
  { label: 'Lux Maximum',          key: 'luxMaximum',             unit: 'lux',   min: 0, max: 10000, section: 'Environment', icon: 'LX' },
  { label: 'Circulation Fan',      key: 'circulationFanSetpoint', unit: 'C',     min: 0, max: 100,   section: 'Environment', icon: 'CF' },
  { label: 'Fogging Humidity Min', key: 'foggingHumidityMin',     unit: '%',     min: 0, max: 100,   section: 'Environment', icon: 'HM' },
  { label: 'Fogging Humidity Max', key: 'foggingHumidityMax',     unit: '%',     min: 0, max: 100,   section: 'Environment', icon: 'HX' },
  { label: 'Fogging Wait Time',    key: 'foggingWaitTime',        unit: 'min',   min: 0, max: 100,   section: 'Environment', icon: 'WT' },
  // Irrigation
  { label: 'EC Setpoint',          key: 'ecSetpoint',             unit: '',      min: 0, max: 2,     section: 'Irrigation',  icon: 'EC' },
  { label: 'EC Dose Seconds',      key: 'ecDoseSeconds',          unit: 'sec',   min: 0, max: 500,   section: 'Irrigation',  icon: 'DS' },
  { label: 'EC Dose Cycle',        key: 'ecDoseCycle',            unit: 'cycle', min: 0, max: 500,   section: 'Irrigation',  icon: 'DC' },
  { label: 'pH Min',               key: 'phMin',                  unit: 'pH',    min: 0, max: 14,    section: 'Irrigation',  icon: 'PN' },
  { label: 'pH Max',               key: 'phMax',                  unit: 'pH',    min: 0, max: 14,    section: 'Irrigation',  icon: 'PX' },
  { label: 'pH Dose Seconds',      key: 'phDoseSeconds',          unit: 'sec',   min: 0, max: 100,   section: 'Irrigation',  icon: 'PS' },
  { label: 'pH Dose Cycle',        key: 'phDoseCycle',            unit: 'cycle', min: 0, max: 500,   section: 'Irrigation',  icon: 'PC' },
  { label: 'Pump ON Setpoint',     key: 'pumpOnSetpoint',         unit: '',      min: 0, max: 100,   section: 'Irrigation',  icon: 'ON' },
  { label: 'Pump OFF Setpoint',    key: 'pumpOffSetpoint',        unit: '',      min: 0, max: 100,   section: 'Irrigation',  icon: 'OF' },
  { label: 'Irrigation Type',      key: 'irrigationType',         unit: '',      min: 0, max: 1,     section: 'Irrigation',  icon: 'IT' },
  // Nutrients
  { label: 'Nutrient Pump Time',   key: 'nutrientPumpTime',       unit: 'sec',   min: 0, max: 500,   section: 'Nutrients',   icon: 'NP' },
  { label: 'Nutrient On Hour',     key: 'nutrientOnHour',         unit: 'hr',    min: 0, max: 23,    section: 'Nutrients',   icon: 'NH' },
  { label: 'EC Pump Error',        key: 'ecPumpErrorSetpoint',    unit: 'mS/cm', min: 0, max: 5,     section: 'Nutrients',   icon: 'EE' },
  { label: 'pH Pump Error',        key: 'phPumpErrorSetpoint',    unit: '',      min: 0, max: 5,     section: 'Nutrients',   icon: 'PE' },
];

export const INTEGER_SETPOINT_KEYS = new Set([
  'totalSoilSensors',
  'luxMinimum',
  'luxMaximum',
  'circulationFanSetpoint',
  'foggingHumidityMin',
  'foggingHumidityMax',
  'foggingWaitTime',
  'ecDoseSeconds',
  'ecDoseCycle',
  'phDoseSeconds',
  'phDoseCycle',
  'pumpOnSetpoint',
  'pumpOffSetpoint',
  'irrigationType',
  'nutrientPumpTime',
  'nutrientOnHour',
]);

const toNumberOrZero = (value: any) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const toIntOrZero = (value: any) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// Default setpoints  (growLightON / growLightOFF removed)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SETPOINTS = {
  totalSoilSensors:       0,
  ecSetpoint:             0,
  ecDoseSeconds:          0,
  ecDoseCycle:            0,
  phMin:                  0,
  phMax:                  0,
  phDoseSeconds:          0,
  phDoseCycle:            0,
  pumpOnSetpoint:         0,
  pumpOffSetpoint:        0,
  ecPumpErrorSetpoint:    0,
  phPumpErrorSetpoint:    0,
  luxMinimum:             0,
  luxMaximum:             0,
  foggingHumidityMin:     0,
  foggingHumidityMax:     0,
  foggingWaitTime:        0,
  circulationFanSetpoint: 0,
  irrigationType:         0,
  nutrientPumpTime:       0,
  nutrientOnHour:         0,
};

export const DEFAULT_SCHEDULES: Schedule[] = [
  { id: 1, active: true,  startHour: 6,  startMinute: 0,  endHour: 8,  endMinute: 30 },
  { id: 2, active: true,  startHour: 10, startMinute: 0,  endHour: 12, endMinute: 0  },
  { id: 3, active: true,  startHour: 14, startMinute: 15, endHour: 16, endMinute: 45 },
  { id: 4, active: true,  startHour: 18, startMinute: 0,  endHour: 20, endMinute: 0  },
  { id: 5, active: false, startHour: 23, startMinute: 0,  endHour: 20, endMinute: 0  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

export const formatValue = (key: string, value: any) => {
  if (typeof value === 'string' && isNaN(parseFloat(value))) return value;
  const num = parseFloat(value);
  if (isNaN(num))              return '--';
  if (key.includes('temp'))    return `${num.toFixed(1)} C`;
  if (key === 'humidity')      return `${num.toFixed(0)}%`;
  if (key === 'lux')           return `${num} lx`;
  if (key === 'ec' || key === 'ph') return num.toFixed(1);
  return value;
};

export const floatMatch = (a: number, b: number) =>
  Math.abs(a - b) < FLOAT_TOLERANCE;

// ─────────────────────────────────────────────────────────────────────────────
// Packet builders
//
//  buildSetpointsPacket — 21 values (no command byte; screen checks length 21)
//  buildSchedulePacket  — field order: startHour, startMinute, endHour,
//                         endMinute, active  (active last, matches your final)
// ─────────────────────────────────────────────────────────────────────────────

export const buildSetpointsPacket = (sp: typeof DEFAULT_SETPOINTS): number[] => [
  toNumberOrZero(sp.ecSetpoint),
  toIntOrZero(sp.ecDoseSeconds),
  toIntOrZero(sp.ecDoseCycle),
  toNumberOrZero(sp.phMin),
  toNumberOrZero(sp.phMax),
  toIntOrZero(sp.phDoseSeconds),
  toIntOrZero(sp.phDoseCycle),
  toIntOrZero(sp.pumpOnSetpoint),
  toIntOrZero(sp.pumpOffSetpoint),
  toNumberOrZero(sp.ecPumpErrorSetpoint),
  toNumberOrZero(sp.phPumpErrorSetpoint),
  toIntOrZero(sp.luxMinimum),
  toIntOrZero(sp.luxMaximum),
  toIntOrZero(sp.foggingHumidityMin),
  toIntOrZero(sp.foggingHumidityMax),
  toIntOrZero(sp.foggingWaitTime),
  toIntOrZero(sp.totalSoilSensors),
  toIntOrZero(sp.circulationFanSetpoint),
  toIntOrZero(sp.irrigationType),
  toIntOrZero(sp.nutrientPumpTime),
  toIntOrZero(sp.nutrientOnHour),
];

export const buildSchedulePacket = (schedules: Schedule[]): number[] => {
  const packet: number[] = [];
  schedules.forEach(s => {
    packet.push(
      s.startHour,
      s.startMinute,
      s.endHour,
      s.endMinute,
      s.active ? 1 : 0,   // active last — matches your final shared
    );
  });
  return packet;
};

// ─────────────────────────────────────────────────────────────────────────────
// History helpers
// ─────────────────────────────────────────────────────────────────────────────

export const saveHistory = async (entry: HistoryEntry) => {
  try {
    const raw     = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    const history: HistoryEntry[] = raw ? JSON.parse(raw) : [];
    history.unshift(entry);
    await AsyncStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(history.slice(0, 100)),
    );
  } catch (e) {
    console.warn('History save failed', e);
  }
};

export const updateHistoryStatus = async (
  timestamp: number,
  status: 'confirmed' | 'failed',
) => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return;
    const history: HistoryEntry[] = JSON.parse(raw);
    const idx = history.findIndex(h => h.timestamp === timestamp);
    if (idx !== -1) {
      history[idx].status = status;
      await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    }
  } catch (e) {
    console.warn('History update failed', e);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Device mappers
// ─────────────────────────────────────────────────────────────────────────────

export const mapDeviceSetpoints = (data: any): typeof DEFAULT_SETPOINTS => ({
  totalSoilSensors:
    toIntOrZero(data.totalSoilSensors ?? data.soil_count),
  luxMinimum:
    toIntOrZero(data['LUX-MINsetpoint'] ?? data.LUX_MINsetpoint ?? data.luxMinimum),
  luxMaximum:
    toIntOrZero(data['LUX-MAXsetpoint'] ?? data.LUX_MAXsetpoint ?? data.luxMaximum),
  circulationFanSetpoint:
    toIntOrZero(data.circulationFanSetpoint ?? data.circulation_fan_setpoint),
  foggingHumidityMin:
    toIntOrZero(data.foggingHumidityMin ?? data.HUM_FOG_MINsetpoint),
  foggingHumidityMax:
    toIntOrZero(data.foggingHumidityMax ?? data.HUM_FOG_MAXsetpoint),
  foggingWaitTime:
    toIntOrZero(data.foggingWaitTime ?? data.HUM_FOG_WaitTime),
  ecSetpoint:
    toNumberOrZero(data['EC-setpoint'] ?? data.EC_Setpoint ?? data.ecSetpoint),
  ecDoseSeconds:
    toIntOrZero(data.ecDoseSeconds ?? data.Ecdose_sec),
  ecDoseCycle:
    toIntOrZero(data.ecDoseCycle ?? data.Ecdose_cycle),
  phMin:
    toNumberOrZero(data.phMin ?? data.pH_min),
  phMax:
    toNumberOrZero(data.phMax ?? data.pH_max),
  phDoseSeconds:
    toIntOrZero(data.phDoseSeconds ?? data.pHdose_sec),
  phDoseCycle:
    toIntOrZero(data.phDoseCycle ?? data.pHdose_cycle),
  pumpOnSetpoint:
    toIntOrZero(data.pumpOnSetpoint ?? data.PumpON_setpoint),
  pumpOffSetpoint:
    toIntOrZero(data.pumpOffSetpoint ?? data.PumpOff_setpoint),
  irrigationType:
    toIntOrZero(data.irrigationType ?? data.WaterPUMP_mode),
  nutrientPumpTime:
    toIntOrZero(data.nutrientPumpTime ?? data.Nutrient_time),
  nutrientOnHour:
    toIntOrZero(data.nutrientOnHour ?? data.Nutrient_hours),
  ecPumpErrorSetpoint:
    toNumberOrZero(data.ecPumpErrorSetpoint ?? data.Ec_PumpEr_setpoint),
  phPumpErrorSetpoint:
    toNumberOrZero(data.phPumpErrorSetpoint ?? data.pH_PumpEr_setpoint),
});

export const mapDeviceSchedule = (data: any): Schedule[] => {
  const raw = Array.isArray(data)
    ? data
    : Array.isArray(data?.schedule)
    ? data.schedule
    : null;

  if (raw) {
    return raw.slice(0, 5).map((item: any, i: number) => ({
      id:          i + 1,
      active:      Boolean(item.active ?? item.enable),
      startHour:   item.startHour   ?? item.on_hr  ?? 0,
      startMinute: item.startMinute ?? item.on_min ?? 0,
      endHour:     item.endHour     ?? item.off_hr ?? 0,
      endMinute:   item.endMinute   ?? item.off_min ?? 0,
    }));
  }

  return DEFAULT_SCHEDULES;
};

// ─────────────────────────────────────────────────────────────────────────────
// AnimatedButton
// ─────────────────────────────────────────────────────────────────────────────

export const AnimatedButton = ({
  onPress,
  style,
  children,
  disabled,
}: {
  onPress: () => void;
  style: any;
  children: React.ReactNode;
  disabled?: boolean;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const useNativeDriver = false;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.95, useNativeDriver }).start();

  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver,
    }).start();

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Toast  — slide-in from top + fade, no text prefix, coloured left border
// ─────────────────────────────────────────────────────────────────────────────

export const Toast = ({
  message,
  type,
  visible,
  onHide,
}: {
  message: string;
  type: 'success' | 'error';
  visible: boolean;
  onHide: () => void;
}) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-16)).current;
  const useNativeDriver = false;

  useEffect(() => {
    if (!visible) return;

    // Reset before animating in
    fadeAnim.setValue(0);
    slideAnim.setValue(-16);

    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 260, useNativeDriver }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8,   useNativeDriver }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 0, duration: 240, useNativeDriver }),
        Animated.timing(slideAnim, { toValue: -16, duration: 240, useNativeDriver }),
      ]).start(() => onHide());
    }, 2800);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const accentColor = type === 'success' ? COLORS.success : COLORS.error;

  return (
    <Animated.View
      style={[
        styles.toast,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Coloured left accent bar */}
      <View style={[styles.toastAccentBar, { backgroundColor: accentColor }]} />
      {/* Dot */}
      <View style={[styles.toastDot, { backgroundColor: accentColor }]} />
      <Text style={styles.toastText} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SyncBanner  — slides down from header, spring animation
// ─────────────────────────────────────────────────────────────────────────────

export const SyncBanner = ({ status }: { status: SyncStatus }) => {
  const slideAnim = useRef(new Animated.Value(-52)).current;
  const prevStatus = useRef<SyncStatus>('idle');
  const useNativeDriver = false;

  useEffect(() => {
    const entering = status !== 'idle';
    const wasIdle  = prevStatus.current === 'idle';
    prevStatus.current = status;

    if (entering && wasIdle) {
      // Slide in
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 9,
        tension: 80,
        useNativeDriver,
      }).start();
    } else if (!entering) {
      // Slide out
      Animated.timing(slideAnim, {
        toValue: -52,
        duration: 220,
        useNativeDriver,
      }).start();
    }
  }, [status]);

  if (status === 'idle') return null;

  const config = {
    pending:   { color: COLORS.warning, bg: COLORS.warningLight, label: 'Syncing with device...' },
    confirmed: { color: COLORS.success, bg: COLORS.successLight, label: 'Device confirmed'        },
    failed:    { color: COLORS.error,   bg: COLORS.errorLight,   label: 'Sync failed — changes reverted' },
  }[status];

  return (
    <Animated.View
      style={[
        styles.syncBanner,
        {
          backgroundColor: config.bg,
          borderBottomColor: config.color,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {status === 'pending' && (
        <ActivityIndicator size="small" color={config.color} style={{ marginRight: 8 }} />
      )}
      <Text style={[styles.syncBannerText, { color: config.color }]}>
        {config.label}
      </Text>
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// StatCard
// ─────────────────────────────────────────────────────────────────────────────

export const StatCard = ({
  name,
  value,
  isError,
  isLow,
}: {
  name: string;
  value: string | number;
  isError: boolean;
  isLow: boolean;
}) => (
  <View style={[styles.card, isError ? styles.cardError : null]}>
    <Text style={styles.cardLabel} numberOfLines={1}>{name}</Text>
    <Text style={[styles.cardValue, (isError || isLow) ? styles.textError : styles.textMain]}>
      {value}
    </Text>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// StatusPill
// ─────────────────────────────────────────────────────────────────────────────

export const StatusPill = ({ name, status }: { name: string; status: number }) => {
  const isOn      = status === 1;
  const cleanName = name.replace(/_status$/, '').replace(/_/g, ' ');
  return (
    <View style={[styles.pill, isOn ? styles.pillActive : styles.pillInactive]}>
      <View style={[styles.dot, isOn ? styles.dotActive : styles.dotInactive]} />
      <Text style={[styles.pillText, isOn ? styles.pillTextActive : styles.pillTextInactive]}>
        {cleanName}
      </Text>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

export const Header = ({
  zoneId, lastUpdated, fresh, isOnline, onSettingsPress, onExit,
}: {
  zoneId: string;
  lastUpdated: string;
  fresh: boolean;
  isOnline: boolean;
  onSettingsPress: () => void;
  onExit?: () => void;
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!fresh) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 1000, useNativeDriver: false }),
      ]),
    ).start();
  }, [fresh]);

  return (
    <View style={styles.header}>
      {onExit && (
        <TouchableOpacity onPress={onExit} style={styles.exitLink}>
          <Text style={styles.exitLinkText}>EXIT</Text>
        </TouchableOpacity>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>Zone {zoneId}</Text>
        <Text style={styles.headerSubtitle}>{lastUpdated}</Text>
      </View>
      <View style={styles.headerActions}>
        <View style={[styles.statusBadge, isOnline ? styles.bgSuccessLight : styles.bgErrorLight]}>
          <Animated.View
            style={[
              styles.statusDot,
              isOnline ? styles.statusDotSuccess : styles.statusDotError,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />
          <Text style={[styles.statusText, isOnline ? styles.textSuccess : styles.textError]}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </Text>
        </View>
        <AnimatedButton onPress={onSettingsPress} style={styles.settingsButton}>
          <View style={styles.settingsGlass}>
            <Text style={styles.settingsIconText}>SET</Text>
          </View>
        </AnimatedButton>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BackHeader
// ─────────────────────────────────────────────────────────────────────────────

export const BackHeader = ({
  title, subtitle, onBack, rightSlot,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  rightSlot?: React.ReactNode;
}) => (
  <View style={styles.stickyHeader}>
    <AnimatedButton onPress={onBack} style={styles.backButtonTop}>
      <Text style={styles.backArrow}>{'<'}</Text>
      <Text style={styles.backText}>Back</Text>
    </AnimatedButton>
    <View style={styles.pageHeaderCenter}>
      <Text style={styles.pageTitle}>{title}</Text>
      <Text style={styles.pageSubtitle}>{subtitle}</Text>
    </View>
    <View style={styles.pageHeaderRight}>{rightSlot}</View>
  </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// SetpointCard  (kept for backward compat with other screens)
// ─────────────────────────────────────────────────────────────────────────────

export const SetpointCard = ({
  config, value, onChange, hasChanges, disabled,
}: {
  config: SetpointConfig;
  value: number;
  onChange: (key: string, value: number) => void;
  hasChanges: boolean;
  disabled: boolean;
}) => {
  const [localValue, setLocalValue] = useState<number>(value);
  useEffect(() => { setLocalValue(value); }, [value]);

  const increment = () => {
    const next = Math.min(localValue + 1, config.max);
    setLocalValue(next);
    onChange(config.key, next);
  };

  const decrement = () => {
    const next = Math.max(localValue - 1, config.min);
    setLocalValue(next);
    onChange(config.key, next);
  };

  const handleTextChange = (text: string) => {
    const num = parseFloat(text);
    if (!isNaN(num) && num >= config.min && num <= config.max) {
      setLocalValue(num);
      onChange(config.key, num);
    }
  };

  return (
    <View
      style={[
        styles.setpointCardEnhanced,
        hasChanges && styles.setpointCardModified,
        disabled && { opacity: 0.6 },
      ]}
    >
      <View style={styles.setpointCardLeft}>
        <Text style={styles.setpointIcon}>{config.icon}</Text>
        <View>
          <Text style={styles.setpointLabel}>{config.label}</Text>
          <Text style={styles.setpointRange}>
            {config.min} – {config.max} {config.unit}
          </Text>
        </View>
      </View>
      <View style={styles.setpointCardRight}>
        <AnimatedButton onPress={decrement} style={styles.stepperButton} disabled={disabled}>
          <Text style={styles.stepperButtonText}>−</Text>
        </AnimatedButton>
        <TextInput
          style={styles.setpointValueInput}
          value={localValue.toString()}
          onChangeText={handleTextChange}
          keyboardType="numeric"
          editable={!disabled}
        />
        <AnimatedButton onPress={increment} style={styles.stepperButton} disabled={disabled}>
          <Text style={styles.stepperButtonText}>+</Text>
        </AnimatedButton>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  // ── Layout ──────────────────────────────────────────────────────────────────
  fullScreen:   { flex: 1, backgroundColor: COLORS.bg },
  container:    { flex: 1 },
  content:      { padding: 16 },
  contentPadded:{ padding: 16 },

  // ── Main header (zone screen) ────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  exitLink:        { position: 'absolute', left: 16, top: 16, zIndex: 10 },
  exitLinkText:    { color: COLORS.error, fontWeight: 'bold', fontSize: 16 },
  headerTitle:     { fontSize: 32, fontWeight: '900', color: COLORS.textMain, letterSpacing: -1 },
  headerSubtitle:  { fontSize: 14, color: COLORS.textSub, fontWeight: '500', marginTop: 4 },
  headerActions:   { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // ── Status badge ─────────────────────────────────────────────────────────
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot:        { width: 8, height: 8, borderRadius: 4 },
  statusDotSuccess: { backgroundColor: COLORS.success },
  statusDotError:   { backgroundColor: COLORS.error },
  statusText:       { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  bgSuccessLight:   { backgroundColor: COLORS.successLight, borderWidth: 1, borderColor: '#86EFAC' },
  bgErrorLight:     { backgroundColor: COLORS.errorLight,   borderWidth: 1, borderColor: '#FECACA' },
  textSuccess:      { color: COLORS.success },
  textError:        { color: COLORS.error },

  // ── Settings button ───────────────────────────────────────────────────────
  settingsButton: { width: 48, height: 48, borderRadius: 24 },
  settingsGlass: {
    width: '100%', height: '100%', borderRadius: 24,
    backgroundColor: COLORS.glass,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  settingsIconText: { fontSize: 12, fontWeight: '800', color: COLORS.textMain, letterSpacing: 0.5 },

  // ── Sensor grid ───────────────────────────────────────────────────────────
  grid:           { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  gridItemSensor: { width: '33.33%', padding: 6 },
  gridItemSoil:   { width: '20%',    padding: 6 },

  // ── Stat card ─────────────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.card, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: COLORS.borderLight,
    justifyContent: 'center', alignItems: 'center', minHeight: 70,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 2,
  },
  cardError: { borderColor: COLORS.error, backgroundColor: COLORS.errorLight },
  cardLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textSub,
    textAlign: 'center', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  cardValue: { fontSize: 18, fontWeight: '800', color: COLORS.textMain, textAlign: 'center' },
  textMain:  { color: COLORS.textMain },

  // ── Status pills ─────────────────────────────────────────────────────────
  statusGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill:            { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, gap: 8 },
  pillActive:      { backgroundColor: COLORS.successLight, borderColor: COLORS.success },
  pillInactive:    { backgroundColor: COLORS.card,         borderColor: COLORS.border  },
  dot:             { width: 10, height: 10, borderRadius: 5 },
  dotActive:       { backgroundColor: COLORS.success },
  dotInactive:     { backgroundColor: COLORS.textSub },
  pillText:        { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  pillTextActive:  { color: COLORS.textMain },
  pillTextInactive:{ color: COLORS.textSub  },

  // ── Section titles ────────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 20, fontWeight: '800', color: COLORS.textMain,
    marginTop: 28, marginBottom: 14, marginLeft: 4, letterSpacing: -0.5,
  },
  sectionTitleEnhanced: {
    fontSize: 18, fontWeight: '800', color: COLORS.textMain,
    marginTop: 24, marginBottom: 12, marginLeft: 4,
    letterSpacing: -0.3, textTransform: 'uppercase',
  },

  // ── Error banner ──────────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.errorLight, padding: 14, borderRadius: 12,
    marginBottom: 16, borderWidth: 1, borderColor: '#FEE2E2', gap: 8,
  },
  errorIcon: { fontSize: 18 },
  errorText: { color: COLORS.error, fontSize: 14, fontWeight: '600' },

  // ── SyncBanner ────────────────────────────────────────────────────────────
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  syncBannerText: { fontSize: 14, fontWeight: '700' },

  // ── PIN screen ────────────────────────────────────────────────────────────
  pinScreen: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  pinCard: {
    backgroundColor: COLORS.card, borderRadius: 24, padding: 32,
    width: width - 48, maxWidth: 400,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
  },
  pinCardError:   { borderWidth: 2, borderColor: COLORS.error },
  pinHeader:      { alignItems: 'center', marginBottom: 32 },
  pinTitle:       { fontSize: 28, fontWeight: '900', color: COLORS.textMain, marginBottom: 8, letterSpacing: -0.5 },
  pinSubtitle:    { fontSize: 15, color: COLORS.textSub, textAlign: 'center', lineHeight: 22 },
  dotsContainer:  { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 24 },
  pinDot:         { width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.borderLight, borderWidth: 2, borderColor: COLORS.border },
  pinDotFilled:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary, transform: [{ scale: 1.1 }] },
  pinDotError:    { backgroundColor: COLORS.error,   borderColor: COLORS.error },
  pinErrorText:   { color: COLORS.error, fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 16 },
  keypad:         { gap: 14 },
  keypadRow:      { flexDirection: 'row', gap: 14, justifyContent: 'center' },
  keypadButton: {
    width: 75, height: 75, borderRadius: 16, backgroundColor: COLORS.bg,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  keypadText: { fontSize: 26, fontWeight: '700', color: COLORS.textMain },

  // ── Settings screen ───────────────────────────────────────────────────────
  settingsTopBar:    { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 50 : 16, paddingBottom: 12, backgroundColor: COLORS.bg },
  backButtonTop:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backArrow:         { fontSize: 24, color: COLORS.textMain, fontWeight: '600' },
  backText:          { fontSize: 17, color: COLORS.textMain, fontWeight: '600' },
  settingsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  settingsHeader:    { alignItems: 'center', marginBottom: 48 },
  settingsTitle:     { fontSize: 36, fontWeight: '900', color: COLORS.textMain, marginBottom: 8, letterSpacing: -1 },
  settingsTime:      { fontSize: 16, color: COLORS.textSub, fontWeight: '600' },
  settingsGrid:      { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginBottom: 48, width: '100%' },
  settingsCard: {
    borderRadius: 24, padding: 24, alignItems: 'center',
    width: (width - 72) / 2, minHeight: 180,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6, justifyContent: 'center',
  },
  settingsIconCircle: {
    width: 70, height: 70, borderRadius: 35,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  settingsIconEmoji:   { fontSize: 18, fontWeight: '800', color: COLORS.card },
  settingsCardText:    { fontSize: 18, fontWeight: '800', color: COLORS.textMain, marginBottom: 4 },
  settingsCardSubtext: { fontSize: 12, color: COLORS.textSub, fontWeight: '500', textAlign: 'center' },
  exitButton: {
    backgroundColor: COLORS.textMain, borderRadius: 16,
    paddingVertical: 18, paddingHorizontal: 48, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
  },
  exitButtonText: { color: COLORS.card, fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },

  // ── BackHeader (sub-screens) ──────────────────────────────────────────────
  stickyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 16,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 3,
  },
  pageHeaderCenter: { flex: 1, alignItems: 'center' },
  pageTitle:        { fontSize: 20, fontWeight: '800', color: COLORS.textMain, letterSpacing: -0.5 },
  pageSubtitle:     { fontSize: 13, color: COLORS.textSub, fontWeight: '600', marginTop: 2 },
  pageHeaderRight:  { width: 80, alignItems: 'flex-end' },
  changesBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.warning,
    justifyContent: 'center', alignItems: 'center',
  },
  changesBadgeText: { color: COLORS.card, fontSize: 20, fontWeight: '700' },

  // ── SetpointCard (legacy, used in other screens) ──────────────────────────
  setpointCardEnhanced: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.card, borderRadius: 16, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.borderLight,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  setpointCardModified: { borderColor: COLORS.warning, borderWidth: 2, backgroundColor: COLORS.warningLight },
  setpointCardLeft:     { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  setpointIcon:         { fontSize: 16, fontWeight: '800', color: COLORS.textMain },
  setpointLabel:        { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 2 },
  setpointRange:        { fontSize: 11, color: COLORS.textSub, fontWeight: '500' },
  setpointCardRight:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepperButton: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  stepperButtonText:  { color: COLORS.card, fontSize: 20, fontWeight: '700' },
  setpointValueInput: {
    width: 60, fontSize: 18, fontWeight: '800', color: COLORS.textMain,
    textAlign: 'center', borderBottomWidth: 2, borderBottomColor: COLORS.primary, paddingVertical: 4,
  },

  // ── Action buttons ────────────────────────────────────────────────────────
  actionButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  primaryButton: {
    backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  primaryButtonText:   { color: COLORS.card, fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  secondaryButton:     { backgroundColor: COLORS.card, borderRadius: 16, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: COLORS.border },
  secondaryButtonText: { color: COLORS.textMain, fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  disabledButton:      { backgroundColor: COLORS.border, opacity: 0.5 },
  disabledText:        { color: COLORS.textSub },

  // ── Schedule card ─────────────────────────────────────────────────────────
  editableScheduleCard: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.borderLight,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  scheduleCardModified: { borderColor: COLORS.warning, borderWidth: 2, backgroundColor: COLORS.warningLight },
  scheduleCardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  scheduleTitle:        { fontSize: 18, fontWeight: '800', color: COLORS.textMain, letterSpacing: -0.3 },
  modifiedBadge:        { backgroundColor: COLORS.warning, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  modifiedBadgeText:    { color: COLORS.card, fontSize: 11, fontWeight: '700' },

  // ── Time picker ───────────────────────────────────────────────────────────
  timePickerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timePickerSection:{ flex: 1 },
  timePickerLabel:  { fontSize: 12, fontWeight: '700', color: COLORS.textSub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  timePickerInputs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  timeInputGroup:   { alignItems: 'center', gap: 4 },
  timeButton:       { width: 32, height: 24, borderRadius: 8, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  timeButtonText:   { fontSize: 12, fontWeight: '700', color: COLORS.textMain },
  timeInput:        { width: 50, fontSize: 24, fontWeight: '900', color: COLORS.textMain, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: COLORS.primary, paddingVertical: 4 },
  timeSeparator:    { fontSize: 24, fontWeight: '700', color: COLORS.textSub, marginHorizontal: 4 },
  timeArrow:        { fontSize: 24, color: COLORS.textSub, marginHorizontal: 8 },

  // ── Info cards ────────────────────────────────────────────────────────────
  infoGrid: { gap: 12 },
  infoCardEnhanced: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: COLORS.borderLight,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  infoCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  infoIcon:       { fontSize: 16, fontWeight: '800', color: COLORS.textSub },
  infoLabel:      { fontSize: 13, fontWeight: '700', color: COLORS.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue:      { fontSize: 36, fontWeight: '900', letterSpacing: -1 },

  // ── Toast ─────────────────────────────────────────────────────────────────
  toast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    overflow: 'hidden',          // clips the accent bar flush
    maxWidth: width - 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 9999,
  },
  // Flush left accent bar (replaces borderLeft which breaks borderRadius)
  toastAccentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  toastDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 14,
    marginRight: 10,
    flexShrink: 0,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMain,
    flexShrink: 1,
    paddingVertical: 16,
    paddingRight: 18,
  },
  // Legacy — kept so older imports don't break
  toastSuccess: {},
  toastError:   {},
});
