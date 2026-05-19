import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CORRECT_PIN } from './zone/shared';

const C = {
  bg: '#F5F6FA',
  card: '#FFFFFF',
  text: '#0F172A',
  sub: '#64748B',
  muted: '#CBD5E1',
  border: '#E2E8F0',
  primary: '#2563EB',
  danger: '#DC2626',
  success: '#16A34A',
  keyBg: '#F8FAFC',
  keyBgPress: '#EFF6FF',
};

// ─── Key ─────────────────────────────────────────────────────────────────────
const Key: React.FC<{
  label: string;
  sub?: string;
  onPress: () => void;
  disabled?: boolean;
  isAction?: boolean;
}> = ({ label, sub, onPress, disabled, isAction }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const bg = useRef(new Animated.Value(0)).current;

  const pressIn = () => {
    if (disabled) return;
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.92, useNativeDriver: false, speed: 80 }),
      Animated.timing(bg, { toValue: 1, duration: 60, useNativeDriver: false }),
    ]).start();
  };
  const pressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: false, speed: 40, bounciness: 8 }),
      Animated.timing(bg, { toValue: 0, duration: 180, useNativeDriver: false }),
    ]).start();
  };

  const bgColor = bg.interpolate({
    inputRange: [0, 1],
    outputRange: [C.keyBg, C.keyBgPress],
  });

  return (
    <Pressable onPress={disabled ? undefined : onPress} onPressIn={pressIn} onPressOut={pressOut} style={s.keyOuter}>
      <Animated.View style={[
        s.key,
        isAction && s.keyAction,
        { backgroundColor: bgColor, transform: [{ scale }] },
        disabled && { opacity: 0.3 },
      ]}>
        <Text style={[s.keyLabel, isAction && s.keyLabelAction]}>{label}</Text>
        {sub ? <Text style={s.keySub}>{sub}</Text> : null}
      </Animated.View>
    </Pressable>
  );
};

// ─── Dot ─────────────────────────────────────────────────────────────────────
const Dot: React.FC<{ filled: boolean; state: 'idle' | 'error' | 'success' }> = ({ filled, state }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const prev = useRef(false);

  useEffect(() => {
    if (filled && !prev.current) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.4, useNativeDriver: false, speed: 80 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: false, speed: 40 }),
      ]).start();
    }
    prev.current = filled;
  }, [filled]);

  const color = !filled
    ? C.muted
    : state === 'error'
    ? C.danger
    : state === 'success'
    ? C.success
    : C.primary;

  return (
    <Animated.View style={[s.dot, { backgroundColor: color, transform: [{ scale }] }]} />
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────
interface Props {
  onSuccess: () => void;
  onCancel: () => void;
}

const PinScreen: React.FC<Props> = ({ onSuccess, onCancel }) => {
  const [pin, setPin] = useState('');
  const [dots, setDots] = useState([false, false, false, false]);
  const [state, setState] = useState<'idle' | 'error' | 'success'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const errorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: false }),
    ]).start();
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 55, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 45, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 45, useNativeDriver: false }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 35, useNativeDriver: false }),
    ]).start();
  };

  const press = (num: string) => {
    if (pin.length >= 4 || state !== 'idle') return;
    const next = pin + num;
    const nextDots = [...dots];
    nextDots[pin.length] = true;
    setPin(next);
    setDots(nextDots);
    setErrorMsg('');

    if (next.length === 4) {
      setTimeout(() => {
        if (next === CORRECT_PIN) {
          setState('success');
          setTimeout(onSuccess, 500);
        } else {
          setState('error');
          setErrorMsg('Incorrect PIN');
          errorAnim.setValue(0);
          Animated.timing(errorAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
          shake();
          setTimeout(() => {
            setPin('');
            setDots([false, false, false, false]);
            setState('idle');
            setErrorMsg('');
          }, 900);
        }
      }, 100);
    }
  };

  const backspace = () => {
    if (!pin.length || state !== 'idle') return;
    const nextDots = [...dots];
    nextDots[pin.length - 1] = false;
    setDots(nextDots);
    setPin(pin.slice(0, -1));
    setErrorMsg('');
  };

  const clear = () => {
    if (state !== 'idle') return;
    setPin('');
    setDots([false, false, false, false]);
    setErrorMsg('');
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <Animated.View style={[s.card, {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { translateX: shakeAnim }],
      }]}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.lockWrap}>
            <View style={s.lockBody} />
            <View style={s.lockShackle} />
          </View>
          <Text style={s.title}>Enter PIN</Text>
          <Text style={s.subtitle}>Access to zone settings</Text>
        </View>

        {/* Dots */}
        <View style={s.dotsRow}>
          {dots.map((filled, i) => (
            <Dot key={i} filled={filled} state={state} />
          ))}
        </View>

        {/* Error */}
        <Animated.View style={{ opacity: errorAnim, height: 20, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={s.errorText}>{errorMsg}</Text>
        </Animated.View>

        {/* Keypad */}
        <View style={s.keypad}>
          {[['1','2','3'],['4','5','6'],['7','8','9']].map((row, ri) => (
            <View key={ri} style={s.keyRow}>
              {row.map((k, ki) => {
                const subs = ['','ABC','DEF','GHI','JKL','MNO','PQRS','TUV','WXYZ'];
                return (
                  <Key
                    key={k}
                    label={k}
                    sub={subs[ri * 3 + ki]}
                    onPress={() => press(k)}
                    disabled={state !== 'idle'}
                  />
                );
              })}
            </View>
          ))}

          {/* Bottom row */}
          <View style={s.keyRow}>
            <Key label="CLR" onPress={clear} isAction disabled={!pin.length || state !== 'idle'} />
            <Key label="0" onPress={() => press('0')} disabled={state !== 'idle'} />
            {/* Backspace */}
            <Pressable
              onPress={backspace}
              style={[s.keyOuter, (!pin.length || state !== 'idle') && { opacity: 0.3 }]}
            >
              <View style={[s.key, s.keyAction]}>
                <View style={s.bsWrap}>
                  <View style={s.bsArrow} />
                  <View style={s.bsBox} />
                </View>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Cancel */}
        <Pressable onPress={onCancel} style={s.cancelBtn}>
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>

      </Animated.View>
    </View>
  );
};

export default PinScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────
const KEY = 70;

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: C.card,
    borderRadius: 24,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24 },
      android: { elevation: 6 },
    }),
  },

  // Header
  header: { alignItems: 'center', marginBottom: 28 },
  lockWrap: { marginBottom: 16, alignItems: 'center' },
  lockBody: {
    width: 28,
    height: 20,
    borderRadius: 7,
    backgroundColor: C.primary,
  },
  lockShackle: {
    position: 'absolute',
    top: -10,
    width: 16,
    height: 14,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderWidth: 3,
    borderColor: C.primary,
    borderBottomWidth: 0,
  },
  title: { fontSize: 20, fontWeight: '700', color: C.text, letterSpacing: -0.3, marginBottom: 4 },
  subtitle: { fontSize: 13, color: C.sub },

  // Dots
  dotsRow: { flexDirection: 'row', gap: 20, marginBottom: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },

  // Error
  errorText: { fontSize: 12, color: C.danger, fontWeight: '600' },

  // Keypad
  keypad: { width: '100%', gap: 8, marginTop: 16 },
  keyRow: { flexDirection: 'row', gap: 8 },
  keyOuter: { flex: 1 },

  key: {
    height: KEY,
    borderRadius: 14,
    backgroundColor: C.keyBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  keyAction: { backgroundColor: C.card },
  keyLabel: { fontSize: 22, fontWeight: '600', color: C.text },
  keyLabelAction: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 0.8 },
  keySub: { fontSize: 8, fontWeight: '600', color: C.muted, letterSpacing: 1.2, marginTop: 1 },

  // Backspace icon
  bsWrap: { flexDirection: 'row', alignItems: 'center' },
  bsArrow: {
    width: 0, height: 0,
    borderTopWidth: 6, borderBottomWidth: 6, borderRightWidth: 8,
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
    borderRightColor: C.sub,
  },
  bsBox: {
    width: 12, height: 12,
    borderTopRightRadius: 3, borderBottomRightRadius: 3,
    borderWidth: 2, borderLeftWidth: 0,
    borderColor: C.sub,
  },

  // Cancel
  cancelBtn: { marginTop: 20, paddingVertical: 8, paddingHorizontal: 20 },
  cancelText: { fontSize: 14, color: C.sub, fontWeight: '500' },
});
