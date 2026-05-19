import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#F5F6FA',
  card: '#FFFFFF',
  primary: '#2563EB',
  primaryLight: '#EFF6FF',
  primaryMid: '#BFDBFE',
  purple: '#7C3AED',
  purpleLight: '#F5F3FF',
  purpleMid: '#DDD6FE',
  orange: '#EA580C',
  orangeLight: '#FFF7ED',
  orangeMid: '#FED7AA',
  text: '#0F172A',
  sub: '#64748B',
  border: '#E2E8F0',
  muted: '#CBD5E1',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
};

// ─── Animated Press ───────────────────────────────────────────────────────────
const PressBtn: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  style?: object;
}> = ({ onPress, children, style }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const shadow = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 60 }),
      Animated.timing(shadow, { toValue: 0, duration: 100, useNativeDriver: false }),
    ]).start();
  };
  const pressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }),
      Animated.timing(shadow, { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// ─── Icon: Sliders (Setpoints) ────────────────────────────────────────────────
const IconSliders: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 22, height: 18, justifyContent: 'space-between' }}>
    {[0, 1, 2].map(i => (
      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ flex: i === 0 ? 0.4 : i === 1 ? 0.65 : 0.5, height: 2, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
        <View style={{ flex: i === 0 ? 0.6 : i === 1 ? 0.35 : 0.5, height: 2, backgroundColor: color, borderRadius: 1 }} />
      </View>
    ))}
  </View>
);

// ─── Icon: Clock (Schedule) ───────────────────────────────────────────────────
const IconClock: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ position: 'absolute', width: 2, height: 6, backgroundColor: color, borderRadius: 1, bottom: '50%', left: '50%', marginLeft: -1 }} />
    <View style={{ position: 'absolute', width: 2, height: 5, backgroundColor: color, borderRadius: 1, bottom: '50%', left: '50%', marginLeft: -1, transform: [{ rotate: '90deg' }, { translateY: -2.5 }] }} />
    <View style={{ width: 2.5, height: 2.5, borderRadius: 2, backgroundColor: color }} />
  </View>
);

// ─── Icon: Chart (Zone Info) ──────────────────────────────────────────────────
const IconChart: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 22, height: 18, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
    {[10, 16, 12, 18, 14].map((h, i) => (
      <View key={i} style={{ flex: 1, height: h, backgroundColor: color, borderRadius: 2 }} />
    ))}
  </View>
);

// ─── Chevron Right ────────────────────────────────────────────────────────────
const ChevronRight: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 16, height: 16, justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: 6, height: 6, borderTopWidth: 2, borderRightWidth: 2, borderColor: color, transform: [{ rotate: '45deg' }] }} />
  </View>
);

// ─── Settings Menu Item ───────────────────────────────────────────────────────
const MenuItem: React.FC<{
  label: string;
  subtitle: string;
  accentColor: string;
  accentLight: string;
  accentMid: string;
  icon: React.ReactNode;
  onPress: () => void;
  index: number;
  tag?: string;
}> = ({ label, subtitle, accentColor, accentLight, accentMid, icon, onPress, index, tag }) => {
  const slideAnim = useRef(new Animated.Value(24)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 420,
        delay: index * 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 420,
        delay: index * 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: opacityAnim, transform: [{ translateY: slideAnim }] }}>
      <PressBtn onPress={onPress}>
        <View style={[ss.menuItem, { borderLeftColor: accentColor }]}>
          {/* Icon box */}
          <View style={[ss.iconBox, { backgroundColor: accentLight }]}>
            <View style={[ss.iconInner, { backgroundColor: accentMid }]}>
              {icon}
            </View>
          </View>

          {/* Text */}
          <View style={ss.menuText}>
            <View style={ss.menuTitleRow}>
              <Text style={ss.menuLabel}>{label}</Text>
              {tag && (
                <View style={[ss.menuTag, { backgroundColor: accentLight, borderColor: accentMid }]}>
                  <Text style={[ss.menuTagText, { color: accentColor }]}>{tag}</Text>
                </View>
              )}
            </View>
            <Text style={ss.menuSub}>{subtitle}</Text>
          </View>

          {/* Arrow */}
          <ChevronRight color={C.muted} />
        </View>
      </PressBtn>
    </Animated.View>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  onBack: () => void;
  onOpenSetpoints: () => void;
  onOpenSchedule: () => void;
  onOpenZoneInfo: () => void;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
const SettingsScreen: React.FC<Props> = ({
  onBack,
  onOpenSetpoints,
  onOpenSchedule,
  onOpenZoneInfo,
}) => {
  const now = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const headerAnim = useRef(new Animated.Value(0)).current;
  const footerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Animated.timing(footerAnim, { toValue: 1, duration: 400, delay: 380, useNativeDriver: true }).start();
  }, []);

  const menuItems = [
    {
      label: 'Setpoints',
      subtitle: 'Configure thresholds and target values',
      tag: 'Config',
      accentColor: C.primary,
      accentLight: C.primaryLight,
      accentMid: C.primaryMid,
      icon: <IconSliders color={C.primary} />,
      onPress: onOpenSetpoints,
    },
    {
      label: 'Schedule',
      subtitle: 'Manage irrigation timing windows',
      tag: 'Timer',
      accentColor: C.purple,
      accentLight: C.purpleLight,
      accentMid: C.purpleMid,
      icon: <IconClock color={C.purple} />,
      onPress: onOpenSchedule,
    },
    {
      label: 'Zone Info',
      subtitle: 'View operational statistics and counters',
      tag: 'Read only',
      accentColor: C.orange,
      accentLight: C.orangeLight,
      accentMid: C.orangeMid,
      icon: <IconChart color={C.orange} />,
      onPress: onOpenZoneInfo,
    },
  ];

  return (
    <View style={ss.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.card} />

      {/* ── Header ── */}
      <Animated.View style={[ss.header, { opacity: headerAnim }]}>
        <PressBtn onPress={onBack} style={ss.backBtn}>
          <View style={ss.backBtnInner}>
            <View style={[ss.chevron, ss.chevronTop]} />
            <View style={[ss.chevron, ss.chevronBot]} />
          </View>
        </PressBtn>

        <View style={ss.headerCenter}>
          <Text style={ss.headerTitle}>Settings</Text>
          <Text style={ss.headerSub}>Zone Configuration</Text>
        </View>

        <View style={ss.timeChip}>
          <View style={ss.timeChipDot} />
          <Text style={ss.timeChipText}>{now}</Text>
        </View>
      </Animated.View>

      {/* ── Body ── */}
      <View style={ss.body}>

        {/* Divider label */}
        <View style={ss.dividerRow}>
          <Text style={ss.dividerText}>OPTIONS</Text>
          <View style={ss.dividerLine} />
        </View>

        {/* Menu Items */}
        <View style={ss.menuList}>
          {menuItems.map((item, i) => (
            <MenuItem
              key={item.label}
              label={item.label}
              subtitle={item.subtitle}
              tag={item.tag}
              accentColor={item.accentColor}
              accentLight={item.accentLight}
              accentMid={item.accentMid}
              icon={item.icon}
              onPress={item.onPress}
              index={i}
            />
          ))}
        </View>

        {/* Footer actions */}
        <Animated.View style={[ss.footer, { opacity: footerAnim }]}>
          <PressBtn onPress={onBack} style={ss.backFullBtn}>
            <View style={ss.backFullBtnInner}>
              <View style={[ss.chevron, ss.chevronTop, { backgroundColor: C.sub }]} />
              <View style={[ss.chevron, ss.chevronBot, { backgroundColor: C.sub }]} />
            </View>
            <Text style={ss.backFullBtnText}>Back to Dashboard</Text>
          </PressBtn>
        </Animated.View>
      </View>
    </View>
  );
};

export default SettingsScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  backBtn: { padding: 6 },
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

  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
  headerSub: { fontSize: 11, color: C.sub, marginTop: 1, fontWeight: '500' },

  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.border,
  },
  timeChipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#16A34A' },
  timeChipText: { fontSize: 12, fontWeight: '700', color: C.text, letterSpacing: 0.4 },

  // Body
  body: { flex: 1, padding: 20 },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    marginTop: 4,
  },
  dividerText: { fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 1.5 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },

  // Menu list
  menuList: { gap: 10 },

  // Menu item
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 3,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconInner: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1 },
  menuTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  menuLabel: { fontSize: 15, fontWeight: '700', color: C.text },
  menuTag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  menuTagText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  menuSub: { fontSize: 12, color: C.sub, fontWeight: '400', lineHeight: 17 },

  // Footer
  footer: { marginTop: 'auto', paddingTop: 24 },
  backFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.card,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  backFullBtnInner: { width: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  backFullBtnText: { fontSize: 14, fontWeight: '600', color: C.sub },
});
