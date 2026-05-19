import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  buildSchedulePacket,
  DEFAULT_SCHEDULES,
  mapDeviceSchedule,
  saveHistory,
  Schedule,
  SyncStatus,
  SYNC_TIMEOUT,
  updateHistoryStatus,
} from './zone/shared';

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  bg: '#F5F6FA',
  card: '#FFFFFF',
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  success: '#16A34A',
  successLight: '#F0FDF4',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  text: '#0F172A',
  sub: '#64748B',
  border: '#E2E8F0',
  muted: '#CBD5E1',
  modified: '#FFF7ED',
  modifiedBorder: '#F97316',
};

// ─── Animated Press Button ───────────────────────────────────────────────────
const PressBtn: React.FC<{
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: object;
}> = ({ onPress, disabled, children, style }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 0.88, useNativeDriver: false, speed: 50 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: false, speed: 50 }).start();
  };

  return (
    <Pressable onPress={disabled ? undefined : onPress} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View style={[{ transform: [{ scale }] }, style, disabled && { opacity: 0.38 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// ─── Stepper Button (+/-) ────────────────────────────────────────────────────
const StepBtn: React.FC<{ label: string; onPress: () => void; disabled?: boolean }> = ({
  label,
  onPress,
  disabled,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const bg = useRef(new Animated.Value(0)).current;

  const pressIn = () => {
    if (disabled) return;
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.85, useNativeDriver: false, speed: 60 }),
      Animated.timing(bg, { toValue: 1, duration: 80, useNativeDriver: false }),
    ]).start();
  };
  const pressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: false, speed: 60 }),
      Animated.timing(bg, { toValue: 0, duration: 150, useNativeDriver: false }),
    ]).start();
  };

  const bgColor = bg.interpolate({ inputRange: [0, 1], outputRange: ['#F1F5F9', '#DBEAFE'] });

  return (
    <Pressable onPress={disabled ? undefined : onPress} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View
        style={[
          ss.stepBtn,
          { backgroundColor: bgColor, transform: [{ scale }] },
          disabled && { opacity: 0.3 },
        ]}
      >
        <Text style={ss.stepBtnLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
};

// ─── Time Field ──────────────────────────────────────────────────────────────
const TimeField: React.FC<{
  label: string;
  value: number;
  max: number;
  step: number;
  onIncrease: () => void;
  onDecrease: () => void;
  onChange: (v: number) => void;
  disabled?: boolean;
}> = ({ label, value, max, step, onIncrease, onDecrease, onChange, disabled }) => (
  <View style={ss.timeField}>
    <Text style={ss.timeFieldLabel}>{label}</Text>
    <View style={ss.timeFieldRow}>
      <StepBtn label="+" onPress={onIncrease} disabled={disabled} />
      <TextInput
        style={ss.timeInput}
        value={String(value).padStart(2, '0')}
        keyboardType="numeric"
        maxLength={2}
        editable={!disabled}
        selectTextOnFocus
        onChangeText={t => {
          const n = parseInt(t, 10);
          if (!isNaN(n) && n >= 0 && n <= max) onChange(n);
        }}
      />
      <StepBtn label="−" onPress={onDecrease} disabled={disabled} />
    </View>
  </View>
);

// ─── Sync Banner ─────────────────────────────────────────────────────────────
const SyncBanner: React.FC<{ status: SyncStatus }> = ({ status }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'idle') {
      Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: false }).start();
    } else {
      Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: false }).start();
    }
  }, [status]);

  const config: Record<Exclude<SyncStatus, 'idle'>, { bg: string; text: string; msg: string }> = {
    pending: { bg: '#2563EB', text: '#FFFFFF', msg: 'Syncing with device...' },
    confirmed: { bg: '#16A34A', text: '#FFFFFF', msg: 'Schedule saved successfully' },
    failed: { bg: '#DC2626', text: '#FFFFFF', msg: 'Sync failed — changes reverted' },
  };

  if (status === 'idle') return null;
  const { bg, text, msg } = config[status];

  return (
    <Animated.View
      style={[
        ss.syncBanner,
        { backgroundColor: bg, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] },
      ]}
    >
      {status === 'pending' && <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />}
      <Text style={[ss.syncBannerText, { color: text }]}>{msg}</Text>
    </Animated.View>
  );
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast: React.FC<{
  message: string;
  type: 'success' | 'error';
  visible: boolean;
  onHide: () => void;
}> = ({ message, type, visible, onHide }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(anim, { toValue: 1, useNativeDriver: false, speed: 20 }).start();
      const t = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: false }).start(() => onHide());
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        ss.toast,
        type === 'error' ? ss.toastError : ss.toastSuccess,
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      <View style={[ss.toastDot, { backgroundColor: type === 'error' ? C.danger : C.success }]} />
      <Text style={ss.toastText}>{message}</Text>
    </Animated.View>
  );
};

// ─── Schedule Card ────────────────────────────────────────────────────────────
const ScheduleCard: React.FC<{
  schedule: Schedule;
  isModified: boolean;
  isBusy: boolean;
  onUpdate: (id: number, field: keyof Schedule, value: any) => void;
  index: number;
}> = ({ schedule, isModified, isBusy, onUpdate, index }) => {
  const slideAnim = useRef(new Animated.Value(30)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 380,
        delay: index * 70,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 380,
        delay: index * 70,
        useNativeDriver: false,
      }),
    ]).start();
  }, []);

  const up = (field: keyof Schedule, cur: number, max: number, step: number) =>
    onUpdate(schedule.id, field, Math.min(max, cur + step));
  const dn = (field: keyof Schedule, cur: number, step: number) =>
    onUpdate(schedule.id, field, Math.max(0, cur - step));

  return (
    <Animated.View
      style={[
        ss.card,
        isModified && ss.cardModified,
        isBusy && { opacity: 0.65 },
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      {/* Header */}
      <View style={ss.cardHeader}>
        <View style={ss.cardTitleRow}>
          <View style={[ss.cardIndex, isModified && { backgroundColor: C.modifiedBorder }]}>
            <Text style={ss.cardIndexText}>{schedule.id}</Text>
          </View>
          <Text style={ss.cardTitle}>Schedule {schedule.id}</Text>
          {isModified && (
            <View style={ss.modBadge}>
              <Text style={ss.modBadgeText}>Edited</Text>
            </View>
          )}
        </View>
        <Switch
          value={schedule.active}
          onValueChange={v => onUpdate(schedule.id, 'active', v)}
          trackColor={{ false: C.muted, true: C.primary }}
          thumbColor={C.card}
          ios_backgroundColor={C.muted}
          disabled={isBusy}
        />
      </View>

      {/* Status pill */}
      <View style={[ss.statusPill, schedule.active ? ss.statusPillOn : ss.statusPillOff]}>
        <View style={[ss.statusDot, { backgroundColor: schedule.active ? C.success : C.muted }]} />
        <Text style={[ss.statusText, { color: schedule.active ? C.success : C.sub }]}>
          {schedule.active ? 'Active' : 'Inactive'}
        </Text>
      </View>

      {/* Time pickers */}
      <View style={ss.timesRow}>
        <View style={ss.timeSection}>
          <Text style={ss.timeSectionLabel}>Start</Text>
          <View style={ss.timePairRow}>
            <TimeField
              label="HR"
              value={schedule.startHour}
              max={23}
              step={1}
              onIncrease={() => up('startHour', schedule.startHour, 23, 1)}
              onDecrease={() => dn('startHour', schedule.startHour, 1)}
              onChange={v => onUpdate(schedule.id, 'startHour', v)}
              disabled={isBusy}
            />
            <Text style={ss.timeSep}>:</Text>
            <TimeField
              label="MIN"
              value={schedule.startMinute}
              max={59}
              step={15}
              onIncrease={() => up('startMinute', schedule.startMinute, 59, 15)}
              onDecrease={() => dn('startMinute', schedule.startMinute, 15)}
              onChange={v => onUpdate(schedule.id, 'startMinute', v)}
              disabled={isBusy}
            />
          </View>
        </View>

        <View style={ss.arrowDivider}>
          <View style={ss.arrowLine} />
          <View style={ss.arrowHead} />
        </View>

        <View style={ss.timeSection}>
          <Text style={ss.timeSectionLabel}>End</Text>
          <View style={ss.timePairRow}>
            <TimeField
              label="HR"
              value={schedule.endHour}
              max={23}
              step={1}
              onIncrease={() => up('endHour', schedule.endHour, 23, 1)}
              onDecrease={() => dn('endHour', schedule.endHour, 1)}
              onChange={v => onUpdate(schedule.id, 'endHour', v)}
              disabled={isBusy}
            />
            <Text style={ss.timeSep}>:</Text>
            <TimeField
              label="MIN"
              value={schedule.endMinute}
              max={59}
              step={15}
              onIncrease={() => up('endMinute', schedule.endMinute, 59, 15)}
              onDecrease={() => dn('endMinute', schedule.endMinute, 15)}
              onChange={v => onUpdate(schedule.id, 'endMinute', v)}
              disabled={isBusy}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
interface Props {
  zoneId: string;
  apiBase: string;
  isOnline: boolean;
  onBack: () => void;
}

const ScheduleScreen: React.FC<Props> = ({ zoneId, apiBase, isOnline, onBack }) => {
  const [schedules, setSchedules] = useState<Schedule[]>(DEFAULT_SCHEDULES);
  const [originalSchedules, setOriginalSchedules] = useState<Schedule[]>(DEFAULT_SCHEDULES);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({
    visible: false,
    message: '',
    type: 'success',
  });

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTimestampRef = useRef<number | null>(null);
  const pendingChangedIdsRef = useRef<number[]>([]);
  const pendingNewSchedulesRef = useRef<Schedule[]>([]);

  const hasChanges = JSON.stringify(schedules) !== JSON.stringify(originalSchedules);
  const isBusy = syncStatus === 'pending';

  // Fetch on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/data/?mode=5`);
        if (!res.ok) return;
        const data = await res.json();
        const mapped = mapDeviceSchedule(data);
        setSchedules(mapped);
        setOriginalSchedules(mapped);
      } catch {}
    })();
  }, [apiBase]);

  // Polling for confirmation
  useEffect(() => {
    if (syncStatus !== 'pending') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/data/?mode=5`);
        if (!res.ok) return;
        const data = await res.json();
        const mapped = mapDeviceSchedule(data);
        const changedIds = pendingChangedIdsRef.current;
        const allMatch = changedIds.every(id => {
          const exp = pendingNewSchedulesRef.current.find(i => i.id === id);
          const act = mapped.find(i => i.id === id);
          if (!exp || !act) return false;
          return (
            act.active === exp.active &&
            act.startHour === exp.startHour &&
            act.startMinute === exp.startMinute &&
            act.endHour === exp.endHour &&
            act.endMinute === exp.endMinute
          );
        });
        if (allMatch) {
          clearInterval(interval);
          if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
          setSyncStatus('confirmed');
          setOriginalSchedules(mapped);
          setSchedules(mapped);
          setToast({ visible: true, message: 'Schedule confirmed by device.', type: 'success' });
          if (pendingTimestampRef.current) updateHistoryStatus(pendingTimestampRef.current, 'confirmed');
          setTimeout(() => setSyncStatus('idle'), 10000);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [apiBase, syncStatus]);

  const revertSync = async (reason: string) => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    setSyncStatus('failed');
    setSchedules([...originalSchedules]);
    setToast({ visible: true, message: reason, type: 'error' });
    if (pendingTimestampRef.current) await updateHistoryStatus(pendingTimestampRef.current, 'failed');
    setTimeout(() => setSyncStatus('idle'), 10000);
  };

  const handleSave = async () => {
    if (!isOnline) {
      setToast({ visible: true, message: 'Device is offline. Cannot save.', type: 'error' });
      return;
    }
    const packet = buildSchedulePacket(schedules);
    if (packet.length !== 25) {
      setToast({ visible: true, message: 'Packet error. Must have exactly 5 schedules.', type: 'error' });
      return;
    }
    const changedIds = schedules
      .filter(s => JSON.stringify(s) !== JSON.stringify(originalSchedules.find(o => o.id === s.id)))
      .map(s => s.id);

    pendingChangedIdsRef.current = changedIds;
    pendingNewSchedulesRef.current = [...schedules];
    const timestamp = Date.now();
    pendingTimestampRef.current = timestamp;

    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};
    changedIds.forEach(id => {
      oldValues[`schedule_${id}`] = originalSchedules.find(i => i.id === id);
      newValues[`schedule_${id}`] = schedules.find(i => i.id === id);
    });

    await saveHistory({ type: 'schedule', mode: 7, timestamp, changes: changedIds.map(id => `schedule_${id}`), oldValues, newValues, status: 'pending' });
    setSyncStatus('pending');

    try {
      const res = await fetch(`${apiBase}/update/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packet }),
      });
      const data = await res.json();
      if (data.status !== 'ok') { revertSync(`Device rejected: ${data.reason || 'unknown error'}`); return; }
    } catch {
      revertSync('Network error sending command'); return;
    }

    syncTimerRef.current = setTimeout(() => revertSync('Sync timeout — device did not confirm'), SYNC_TIMEOUT);
  };

  const updateSchedule = (id: number, field: keyof Schedule, value: any) => {
    setSchedules(prev => prev.map(s => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const headerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start();
  }, []);

  return (
    <View style={ss.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      {/* Header */}
      <Animated.View style={[ss.header, { opacity: headerAnim }]}>
        <PressBtn onPress={onBack} style={ss.backBtn}>
          <View style={ss.backBtnInner}>
            <View style={[ss.chevron, ss.chevronTop]} />
            <View style={[ss.chevron, ss.chevronBot]} />
          </View>
        </PressBtn>
        <View style={ss.headerText}>
          <Text style={ss.headerTitle}>Schedule</Text>
          <Text style={ss.headerSub}>Zone {zoneId}</Text>
        </View>
        {hasChanges && (
          <View style={ss.changesBadge}>
            <Text style={ss.changesBadgeText}>Unsaved</Text>
          </View>
        )}
      </Animated.View>

      <SyncBanner status={syncStatus} />

      <ScrollView style={ss.scroll} contentContainerStyle={ss.scrollContent} showsVerticalScrollIndicator={false}>
        {schedules.map((schedule, i) => {
          const isModified = JSON.stringify(schedule) !== JSON.stringify(originalSchedules.find(o => o.id === schedule.id));
          return (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              isModified={isModified}
              isBusy={isBusy}
              onUpdate={updateSchedule}
              index={i}
            />
          );
        })}

        {/* Action buttons */}
        <View style={ss.actions}>
          <PressBtn
            onPress={() => setSchedules([...originalSchedules])}
            disabled={!hasChanges || isBusy}
            style={[ss.resetBtn, (!hasChanges || isBusy) && { opacity: 0.38 }]}
          >
            <Text style={ss.resetBtnText}>Reset</Text>
          </PressBtn>
          <PressBtn
            onPress={handleSave}
            disabled={!hasChanges || isBusy || !isOnline}
            style={[ss.saveBtn, (!hasChanges || isBusy || !isOnline) && { opacity: 0.38 }]}
          >
            {isBusy
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={ss.saveBtnText}>Save Schedule</Text>}
          </PressBtn>
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>

      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={() => setToast(p => ({ ...p, visible: false }))}
      />
    </View>
  );
};

export default ScheduleScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 8 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  backBtn: { padding: 4 },
  backBtnInner: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  chevron: {
    width: 10,
    height: 2,
    backgroundColor: C.text,
    borderRadius: 1,
    position: 'absolute',
  },
  chevronTop: { transform: [{ rotate: '-45deg' }, { translateY: -3 }] },
  chevronBot: { transform: [{ rotate: '45deg' }, { translateY: 3 }] },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.text, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: C.sub, marginTop: 1 },
  changesBadge: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: C.modifiedBorder,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  changesBadgeText: { fontSize: 11, fontWeight: '600', color: C.modifiedBorder },

  // Sync banner
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  syncBannerText: { fontSize: 13, fontWeight: '600' },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  cardModified: {
    borderColor: C.modifiedBorder,
    backgroundColor: C.modified,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardIndex: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIndexText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: C.text },
  modBadge: {
    backgroundColor: '#FFF7ED',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.modifiedBorder,
  },
  modBadgeText: { fontSize: 10, fontWeight: '600', color: C.modifiedBorder },

  // Status pill
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 14,
    gap: 5,
  },
  statusPillOn: { backgroundColor: C.successLight },
  statusPillOff: { backgroundColor: '#F8FAFC' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '500' },

  // Times
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeSection: { flex: 1 },
  timeSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.sub,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
    textAlign: 'center',
  },
  timePairRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  timeSep: { fontSize: 20, fontWeight: '700', color: C.muted, marginHorizontal: 2, marginBottom: 14 },

  arrowDivider: { alignItems: 'center', justifyContent: 'center', width: 24, flexDirection: 'row' },
  arrowLine: { flex: 1, height: 1.5, backgroundColor: C.muted },
  arrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: C.muted,
  },

  // Time field
  timeField: { alignItems: 'center' },
  timeFieldLabel: { fontSize: 9, fontWeight: '700', color: C.sub, letterSpacing: 0.8, marginBottom: 4 },
  timeFieldRow: { alignItems: 'center', gap: 2 },
  timeInput: {
    width: 44,
    height: 38,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    marginVertical: 2,
    ...Platform.select({ android: { paddingVertical: 0 } }),
  },

  // Step button
  stepBtn: {
    width: 44,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  stepBtnLabel: { fontSize: 18, fontWeight: '400', color: C.primary, lineHeight: 22 },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  resetBtn: {
    flex: 1,
    height: 50,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: { fontSize: 15, fontWeight: '600', color: C.sub },
  saveBtn: {
    flex: 2,
    height: 50,
    backgroundColor: C.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Toast
  toast: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    right: 20,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  toastSuccess: { backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' },
  toastError: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  toastDot: { width: 8, height: 8, borderRadius: 4 },
  toastText: { flex: 1, fontSize: 13, fontWeight: '500', color: C.text },
});
