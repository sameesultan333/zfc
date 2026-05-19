import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AnimatedButton,
  BackHeader,
  buildSetpointsPacket,
  COLORS,
  DEFAULT_SETPOINTS,
  floatMatch,
  INTEGER_SETPOINT_KEYS,
  mapDeviceSetpoints,
  saveHistory,
  SETPOINT_CONFIGS,
  SyncBanner,
  SyncStatus,
  SYNC_TIMEOUT,
  Toast,
  updateHistoryStatus,
} from './zone/shared';

const { width } = Dimensions.get('window');

interface Props {
  zoneId: string;
  apiBase: string;
  isOnline: boolean;
  onBack: () => void;
}

// ─── Section metadata ──────────────────────────────────────────────────────────
const SECTION_META: Record<string, { accent: string; light: string; tag: string }> = {
  Environment: { accent: '#14B8A6', light: '#F0FDFA', tag: 'ENV' },
  Irrigation:  { accent: '#3B82F6', light: '#EFF6FF', tag: 'IRR' },
  Nutrients:   { accent: '#8B5CF6', light: '#F5F3FF', tag: 'NUT' },
};

// ─── Icon abbreviation badge ───────────────────────────────────────────────────
const IconBadge: React.FC<{ label: string; color: string; bg: string }> = ({ label, color, bg }) => (
  <View style={[localStyles.iconBadge, { backgroundColor: bg }]}>
    <Text style={[localStyles.iconBadgeText, { color }]}>{label}</Text>
  </View>
);

// ─── Single setpoint row ───────────────────────────────────────────────────────
const SetpointRow: React.FC<{
  config: (typeof SETPOINT_CONFIGS)[0];
  value: number;
  onChange: (key: string, val: number) => void;
  hasChanges: boolean;
  disabled: boolean;
  accent: string;
  accentLight: string;
  entryDelay: number;
}> = ({ config, value, onChange, hasChanges, disabled, accent, accentLight, entryDelay }) => {
  const [localValue, setLocalValue] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  const slideAnim = useRef(new Animated.Value(20)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 320,
        delay: entryDelay,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 320,
        delay: entryDelay,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  useEffect(() => {
    Animated.timing(highlightAnim, {
      toValue: hasChanges ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [hasChanges]);

  const step = INTEGER_SETPOINT_KEYS.has(config.key) ? 1 : 0.1;

  const commit = (next: number) => {
    const clampedBase = Math.min(config.max, Math.max(config.min, next));
    const clamped = INTEGER_SETPOINT_KEYS.has(config.key)
      ? Math.trunc(clampedBase)
      : parseFloat(clampedBase.toFixed(2));
    setLocalValue(String(clamped));
    onChange(config.key, clamped);
  };

  const handleDecrement = () => {
    Animated.sequence([
      Animated.timing(pressAnim, { toValue: 0.96, duration: 80, useNativeDriver: false }),
      Animated.spring(pressAnim, { toValue: 1, friction: 4, useNativeDriver: false }),
    ]).start();
    const cur = parseFloat(localValue) || 0;
    commit(cur - step);
  };

  const handleIncrement = () => {
    Animated.sequence([
      Animated.timing(pressAnim, { toValue: 0.96, duration: 80, useNativeDriver: false }),
      Animated.spring(pressAnim, { toValue: 1, friction: 4, useNativeDriver: false }),
    ]).start();
    const cur = parseFloat(localValue) || 0;
    commit(cur + step);
  };

  const handleTextChange = (text: string) => {
    setLocalValue(text);
    const num = INTEGER_SETPOINT_KEYS.has(config.key)
      ? parseInt(text, 10)
      : parseFloat(text);
    if (!isNaN(num) && num >= config.min && num <= config.max) {
      onChange(config.key, num);
    }
  };

  const borderColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.borderLight, '#F59E0B'],
  });

  const bgColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.card, '#FFFBEB'],
  });

  return (
    <Animated.View
      style={[
        localStyles.rowWrap,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { scale: pressAnim }],
          borderColor,
          backgroundColor: bgColor,
        },
      ]}
    >
      {/* Left: icon + label */}
      <View style={localStyles.rowLeft}>
        <IconBadge label={config.icon} color={accent} bg={accentLight} />
        <View style={localStyles.rowLabelWrap}>
          <Text style={localStyles.rowLabel}>{config.label}</Text>
          <Text style={localStyles.rowRange}>
            {config.min} – {config.max}
            {config.unit ? `  ${config.unit}` : ''}
          </Text>
        </View>
      </View>

      {/* Right: stepper */}
      <View style={localStyles.stepper}>
        <TouchableOpacity
          onPress={handleDecrement}
          disabled={disabled}
          activeOpacity={0.7}
          style={[localStyles.stepBtn, { borderColor: accent }]}
        >
          <Text style={[localStyles.stepBtnText, { color: accent }]}>−</Text>
        </TouchableOpacity>

        <TextInput
          style={[
            localStyles.stepInput,
            isFocused && { borderBottomColor: accent },
          ]}
          value={localValue}
          onChangeText={handleTextChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          keyboardType="numeric"
          editable={!disabled}
          selectTextOnFocus
        />

        <TouchableOpacity
          onPress={handleIncrement}
          disabled={disabled}
          activeOpacity={0.7}
          style={[localStyles.stepBtn, { backgroundColor: accent, borderColor: accent }]}
        >
          <Text style={[localStyles.stepBtnText, { color: '#fff' }]}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Changed dot indicator */}
      {hasChanges && <View style={[localStyles.changedDot, { backgroundColor: '#F59E0B' }]} />}
    </Animated.View>
  );
};

// ─── Section header ────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{
  title: string;
  tag: string;
  accent: string;
  accentLight: string;
  count: number;
}> = ({ title, tag, accent, accentLight, count }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start();
  }, []);

  return (
    <Animated.View style={[localStyles.sectionHeader, { opacity: fadeAnim }]}>
      <View style={[localStyles.sectionTagPill, { backgroundColor: accentLight }]}>
        <Text style={[localStyles.sectionTagText, { color: accent }]}>{tag}</Text>
      </View>
      <Text style={localStyles.sectionTitle}>{title}</Text>
      <View style={[localStyles.sectionLine, { backgroundColor: accent }]} />
      <Text style={[localStyles.sectionCount, { color: accent }]}>{count}</Text>
    </Animated.View>
  );
};

// ─── Main Screen ───────────────────────────────────────────────────────────────
const SetpointsScreen: React.FC<Props> = ({ zoneId, apiBase, isOnline, onBack }) => {
  const [setpoints, setSetpoints] = useState<typeof DEFAULT_SETPOINTS>({ ...DEFAULT_SETPOINTS });
  const [originalSetpoints, setOriginalSetpoints] = useState<typeof DEFAULT_SETPOINTS>({ ...DEFAULT_SETPOINTS });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const syncTimerRef        = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTimestampRef = useRef<number | null>(null);
  const pendingChangedKeysRef = useRef<string[]>([]);
  const pendingNewValuesRef   = useRef<Record<string, any>>({});

  const saveButtonScale = useRef(new Animated.Value(1)).current;
  const headerFade      = useRef(new Animated.Value(0)).current;

  const hasChanges = JSON.stringify(setpoints) !== JSON.stringify(originalSetpoints);
  const isBusy     = syncStatus === 'pending';
  const sections   = Array.from(new Set(SETPOINT_CONFIGS.map(c => c.section)));

  // ─── Entry animation ──────────────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(headerFade, { toValue: 1, duration: 400, useNativeDriver: false }).start();
  }, []);

  // ─── Load setpoints ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/data?mode=4`);
        if (res.ok) {
          const data = await res.json();
          const mapped = mapDeviceSetpoints(data);
          setSetpoints(mapped);
          setOriginalSetpoints(mapped);
        }
      } catch (e) {
        console.warn('Could not load setpoints', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase]);

  // ─── Polling for sync confirmation ────────────────────────────────────────
  useEffect(() => {
    if (syncStatus !== 'pending') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/data?mode=4`);
        if (!res.ok) return;
        const data   = await res.json();
        const mapped = mapDeviceSetpoints(data);
        const keys   = pendingChangedKeysRef.current;
        const allMatch = keys.length > 0 && keys.every(k =>
          floatMatch((mapped as any)[k], pendingNewValuesRef.current[k])
        );

        if (allMatch) {
          clearInterval(interval);
          if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
          setSyncStatus('confirmed');
          setOriginalSetpoints(mapped);
          setSetpoints(mapped);
          setToast({ visible: true, message: 'Device confirmed setpoints.', type: 'success' });
          if (pendingTimestampRef.current) updateHistoryStatus(pendingTimestampRef.current, 'confirmed');
          setTimeout(() => setSyncStatus('idle'), 2500);
        }
      } catch (_) {}
    }, 3000);

    return () => clearInterval(interval);
  }, [apiBase, syncStatus]);

  const revertSync = async (reason: string) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    setSyncStatus('failed');
    setSetpoints({ ...originalSetpoints });
    setToast({ visible: true, message: reason, type: 'error' });
    if (pendingTimestampRef.current) await updateHistoryStatus(pendingTimestampRef.current, 'failed');
    setTimeout(() => setSyncStatus('idle'), 10000);
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isOnline) {
      setToast({ visible: true, message: 'Device is offline.', type: 'error' });
      return;
    }

    Animated.sequence([
      Animated.timing(saveButtonScale, { toValue: 0.95, duration: 100, useNativeDriver: false }),
      Animated.spring(saveButtonScale, { toValue: 1, friction: 4, useNativeDriver: false }),
    ]).start();

    const packet = buildSetpointsPacket(setpoints);
    if (packet.length !== 21) {
      setToast({ visible: true, message: 'Packet error. Check setpoint config.', type: 'error' });
      return;
    }

    const changedKeys = Object.keys(setpoints).filter(
      k => !floatMatch((setpoints as any)[k], (originalSetpoints as any)[k])
    );
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};
    changedKeys.forEach(k => {
      oldValues[k] = (originalSetpoints as any)[k];
      newValues[k] = (setpoints as any)[k];
    });

    pendingChangedKeysRef.current = changedKeys;
    pendingNewValuesRef.current   = newValues;
    const timestamp = Date.now();
    pendingTimestampRef.current   = timestamp;

    await saveHistory({ type: 'setpoints', mode: 6, timestamp, changes: changedKeys, oldValues, newValues, status: 'pending' });
    setSyncStatus('pending');

    try {
      const res  = await fetch(`${apiBase}/update/setpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packet }),
      });
      const data = await res.json();
      if (data.status !== 'ok') {
        revertSync(`Device rejected: ${data.reason || 'unknown'}`);
        return;
      }
    } catch (_) {
      revertSync('Network error sending command');
      return;
    }

    syncTimerRef.current = setTimeout(
      () => revertSync('Sync timeout — device did not confirm'),
      SYNC_TIMEOUT
    );
  };

  const handleReset = () => {
    Alert.alert('Reset Setpoints', 'Discard all unsaved changes?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => setSetpoints({ ...originalSetpoints }) },
    ]);
  };

  const changedCount = Object.keys(setpoints).filter(
    k => !floatMatch((setpoints as any)[k], (originalSetpoints as any)[k])
  ).length;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={localStyles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.card} />

      {/* Header */}
      <Animated.View style={[localStyles.header, { opacity: headerFade }]}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={localStyles.backBtn}>
          <View style={localStyles.backArrowCircle}>
            <Text style={localStyles.backArrowText}>{'‹'}</Text>
          </View>
          <Text style={localStyles.backLabel}>Back</Text>
        </TouchableOpacity>

        <View style={localStyles.headerCenter}>
          <Text style={localStyles.headerTitle}>Setpoints</Text>
          <Text style={localStyles.headerSub}>Zone {zoneId}</Text>
        </View>

        <View style={localStyles.headerRight}>
          {hasChanges && (
            <Animated.View style={localStyles.changeBadge}>
              <Text style={localStyles.changeBadgeText}>{changedCount}</Text>
            </Animated.View>
          )}
          {!hasChanges && <View style={{ width: 36 }} />}
        </View>
      </Animated.View>

      {/* Sync banner */}
      <SyncBanner status={syncStatus} />

      {/* Content */}
      {loading ? (
        <View style={localStyles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={localStyles.loadingText}>Loading setpoints...</Text>
        </View>
      ) : (
        <ScrollView
          style={localStyles.scroll}
          contentContainerStyle={localStyles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {sections.map(section => {
            const meta   = SECTION_META[section] ?? { accent: COLORS.primary, light: COLORS.primaryLight, tag: '···' };
            const items  = SETPOINT_CONFIGS.filter(c => c.section === section);
            return (
              <View key={section} style={localStyles.sectionWrap}>
                <SectionHeader
                  title={section}
                  tag={meta.tag}
                  accent={meta.accent}
                  accentLight={meta.light}
                  count={items.length}
                />
                <View style={[localStyles.sectionCard, { borderLeftColor: meta.accent }]}>
                  {items.map((config, idx) => (
                    <React.Fragment key={config.key}>
                      <SetpointRow
                        config={config}
                        value={(setpoints as any)[config.key]}
                        onChange={(key, val) => setSetpoints(prev => ({ ...prev, [key]: val }))}
                        hasChanges={(setpoints as any)[config.key] !== (originalSetpoints as any)[config.key]}
                        disabled={isBusy}
                        accent={meta.accent}
                        accentLight={meta.light}
                        entryDelay={idx * 40}
                      />
                      {idx < items.length - 1 && <View style={localStyles.rowDivider} />}
                    </React.Fragment>
                  ))}
                </View>
              </View>
            );
          })}

          {/* Action buttons */}
          <View style={localStyles.actionRow}>
            <TouchableOpacity
              onPress={handleReset}
              disabled={!hasChanges || isBusy}
              activeOpacity={0.8}
              style={[
                localStyles.resetBtn,
                (!hasChanges || isBusy) && localStyles.btnDisabled,
              ]}
            >
              <Text style={[
                localStyles.resetBtnText,
                (!hasChanges || isBusy) && localStyles.btnTextDisabled,
              ]}>
                Reset
              </Text>
            </TouchableOpacity>

            <Animated.View style={[{ flex: 1 }, { transform: [{ scale: saveButtonScale }] }]}>
              <TouchableOpacity
                onPress={handleSave}
                disabled={!hasChanges || isBusy || !isOnline}
                activeOpacity={0.85}
                style={[
                  localStyles.saveBtn,
                  (!hasChanges || isBusy || !isOnline) && localStyles.saveBtnDisabled,
                ]}
              >
                {isBusy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={localStyles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Offline notice */}
          {!isOnline && (
            <View style={localStyles.offlineBanner}>
              <View style={localStyles.offlineDot} />
              <Text style={localStyles.offlineText}>Device offline — changes cannot be saved</Text>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={() => setToast(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────
const localStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : 18,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 80,
  },
  backArrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrowText: {
    fontSize: 22,
    color: '#0F172A',
    lineHeight: 26,
    fontWeight: '400',
  },
  backLabel: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 1,
  },
  headerRight: {
    width: 80,
    alignItems: 'flex-end',
  },
  changeBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  changeBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Loading
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20 },

  // Section
  sectionWrap: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionTagPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sectionTagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    opacity: 0.25,
    borderRadius: 1,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Section card container
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },

  // Row
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 0,
    position: 'relative',
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 12,
  },
  rowLabelWrap: { flex: 1 },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  rowRange: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // Icon badge
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // Stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 20,
  },
  stepInput: {
    width: 56,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 4,
  },

  // Row divider
  rowDivider: {
    height: 1,
    backgroundColor: '#F8FAFC',
    marginHorizontal: 16,
  },

  // Changed dot
  changedDot: {
    position: 'absolute',
    left: 6,
    top: '50%',
    marginTop: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  resetBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  saveBtnDisabled: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnTextDisabled: {
    color: '#94A3B8',
  },

  // Offline banner
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 8,
  },
  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  offlineText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
});

export default SetpointsScreen;
