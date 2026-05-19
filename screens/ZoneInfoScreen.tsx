import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg: '#F5F6FA',
  card: '#FFFFFF',
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  success: '#16A34A',
  successLight: '#F0FDF4',
  purple: '#7C3AED',
  purpleLight: '#F5F3FF',
  orange: '#EA580C',
  orangeLight: '#FFF7ED',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  teal: '#0D9488',
  tealLight: '#F0FDFA',
  text: '#0F172A',
  sub: '#64748B',
  border: '#E2E8F0',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
};

// ─── Animated Press Button ────────────────────────────────────────────────────
const PressBtn: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  style?: object;
}> = ({ onPress, children, style }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 50 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
};

// ─── Animated Number ──────────────────────────────────────────────────────────
const AnimatedNumber: React.FC<{ value: number; color: string; delay: number }> = ({
  value,
  color,
  delay,
}) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 600,
      delay,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.Text
      style={[
        is.cardValue,
        { color, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
      ]}
    >
      {value.toLocaleString()}
    </Animated.Text>
  );
};

// ─── Info Card ─────────────────────────────────────────────────────────────────
const InfoCard: React.FC<{
  label: string;
  value: number;
  color: string;
  bgColor: string;
  abbr: string;
  index: number;
}> = ({ label, value, color, bgColor, abbr, index }) => {
  const slideAnim = useRef(new Animated.Value(20)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        is.card,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={[is.iconBox, { backgroundColor: bgColor }]}>
        <Text style={[is.iconText, { color }]}>{abbr}</Text>
      </View>
      <AnimatedNumber value={value} color={color} delay={index * 60 + 200} />
      <Text style={is.cardLabel} numberOfLines={2}>{label}</Text>
    </Animated.View>
  );
};

// ─── Section Divider ──────────────────────────────────────────────────────────
const SectionLabel: React.FC<{ text: string }> = ({ text }) => (
  <View style={is.sectionRow}>
    <Text style={is.sectionText}>{text}</Text>
    <View style={is.sectionLine} />
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
interface Props {
  zoneId: string;
  apiBase: string;
  onBack: () => void;
}

const ZoneInfoScreen: React.FC<Props> = ({ zoneId, apiBase, onBack }) => {
  const [info, setInfo] = useState({
    pumpOnCount: 0,
    nutrient1Count: 0,
    nutrient2Count: 0,
    nutrient3Count: 0,
    nutrient4Count: 0,
    tankFillCount: 0,
    ecDoCount: 0,
    phDownDoCount: 0,
    phUpDoCount: 0,
    pumpOnHours: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    loadZoneInfo();
  }, []);

  const loadZoneInfo = async () => {
    try {
      const res = await fetch(`${apiBase}/data?mode=1`);
      if (!res.ok) throw new Error('Failed to fetch zone info');
      const data = await res.json();
      setInfo({
        pumpOnCount: Number(data.pump_ON_count ?? 0),
        nutrient1Count: Number(data.Nutrient1 ?? 0),
        nutrient2Count: Number(data.Nutrient2 ?? 0),
        nutrient3Count: Number(data.Nutrient3 ?? 0),
        nutrient4Count: Number(data.Nutrient4 ?? 0),
        tankFillCount: Number(data.tank_fill_count ?? 0),
        ecDoCount: Number(data.EC_ON_count ?? 0),
        phDownDoCount: Number(data.PHD_ON_count ?? 0),
        phUpDoCount: Number(data.PHUP_ON_count ?? 0),
        pumpOnHours: Number(data.pump_on_hours ?? 0),
      });
      setErrorMsg(null);
      setLoaded(true);
    } catch {
      setErrorMsg('Could not load zone info');
      setLoaded(true);
    }
  };

  const groups = [
    {
      section: 'Pump',
      items: [
        { label: 'Pump On Count', value: info.pumpOnCount, color: C.primary, bgColor: C.primaryLight, abbr: 'PMP' },
        { label: 'Pump On Hours', value: info.pumpOnHours, color: C.teal, bgColor: C.tealLight, abbr: 'HRS' },
      ],
    },
    {
      section: 'Nutrients',
      items: [
        { label: 'Nutrient 1', value: info.nutrient1Count, color: C.success, bgColor: C.successLight, abbr: 'N 1' },
        { label: 'Nutrient 2', value: info.nutrient2Count, color: C.success, bgColor: C.successLight, abbr: 'N 2' },
        { label: 'Nutrient 3', value: info.nutrient3Count, color: C.success, bgColor: C.successLight, abbr: 'N 3' },
        { label: 'Nutrient 4', value: info.nutrient4Count, color: C.success, bgColor: C.successLight, abbr: 'N 4' },
      ],
    },
    {
      section: 'Tank & Dosing',
      items: [
        { label: 'Tank Fill', value: info.tankFillCount, color: C.purple, bgColor: C.purpleLight, abbr: 'TNK' },
        { label: 'EC Dosing', value: info.ecDoCount, color: C.orange, bgColor: C.orangeLight, abbr: 'EC' },
        { label: 'pH Down', value: info.phDownDoCount, color: C.warning, bgColor: C.warningLight, abbr: 'PHD' },
        { label: 'pH Up', value: info.phUpDoCount, color: C.warning, bgColor: C.warningLight, abbr: 'PHU' },
      ],
    },
  ];

  let globalIndex = 0;

  return (
    <View style={is.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      {/* Header */}
      <Animated.View style={[is.header, { opacity: headerAnim }]}>
        <PressBtn onPress={onBack} style={is.backBtn}>
          <View style={is.backBtnInner}>
            <View style={[is.chevron, is.chevronTop]} />
            <View style={[is.chevron, is.chevronBot]} />
          </View>
        </PressBtn>
        <View style={is.headerText}>
          <Text style={is.headerTitle}>Zone Info</Text>
          <Text style={is.headerSub}>Zone {zoneId}</Text>
        </View>
        <PressBtn onPress={loadZoneInfo} style={is.refreshBtn}>
          <Text style={is.refreshBtnText}>Refresh</Text>
        </PressBtn>
      </Animated.View>

      <ScrollView
        style={is.scroll}
        contentContainerStyle={is.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Error banner */}
        {errorMsg && (
          <View style={is.errorBanner}>
            <View style={is.errorDot} />
            <Text style={is.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Stats groups */}
        {loaded && groups.map(group => (
          <View key={group.section}>
            <SectionLabel text={group.section} />
            <View style={is.grid}>
              {group.items.map(item => {
                const idx = globalIndex++;
                return (
                  <InfoCard
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    color={item.color}
                    bgColor={item.bgColor}
                    abbr={item.abbr}
                    index={idx}
                  />
                );
              })}
            </View>
          </View>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
};

export default ZoneInfoScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const CARD_SIZE = '47%';

const is = StyleSheet.create({
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
  refreshBtn: {
    backgroundColor: C.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refreshBtnText: { fontSize: 13, fontWeight: '600', color: C.primary },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.dangerLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.danger },
  errorText: { flex: 1, fontSize: 13, fontWeight: '500', color: C.danger },

  // Section
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 6, gap: 10 },
  sectionText: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionLine: { flex: 1, height: 1, backgroundColor: C.border },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },

  // Card
  card: {
    width: CARD_SIZE,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: C.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  iconBox: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  iconText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  cardValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  cardLabel: { fontSize: 12, fontWeight: '500', color: C.sub, lineHeight: 16 },
});