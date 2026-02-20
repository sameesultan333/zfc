import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    StatusBar,
    TextInput,
    Alert,
    Dimensions,
    Animated,
    Modal,
    Switch,
    ActivityIndicator,
    Platform,
} from 'react-native';

const { width, height } = Dimensions.get('window');

// --- Types ---
interface ZoneData {
    timestamp: number;
    payload: Record<string, any>;
}

interface SMData {
    payload: Record<string, any>;
    no_of_soil_sensors: number;
}

interface SetpointData {
    'LUX-MINsetpoint': number;
    'LUX-MAXsetpoint': number;
    'EC-setpoint': number;
}

interface SetpointConfig {
    label: string;
    key: string;
    unit: string;
    min: number;
    max: number;
    section: string;
    icon: string;
}

interface Schedule {
    id: number;
    active: boolean;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
}

type Screen = 'zone' | 'pin' | 'settings' | 'setpoints' | 'schedule' | 'zoneinfo';

// API_BASE and ZONE_ID are now passed as props
const CORRECT_PIN = '1234';

// --- Configuration ---
const COLORS = {
    bg: '#F8FAFC',
    bgDark: '#0F172A',
    card: '#FFFFFF',
    cardDark: '#1E293B',
    textMain: '#0F172A',
    textSub: '#64748B',
    primary: '#3B82F6',
    primaryDark: '#2563EB',
    primaryLight: '#DBEAFE',
    success: '#10B981',
    successLight: '#D1FAE5',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    purple: '#8B5CF6',
    purpleLight: '#EDE9FE',
    orange: '#F97316',
    orangeLight: '#FFEDD5',
    teal: '#14B8A6',
    tealLight: '#CCFBF1',
    glass: 'rgba(255, 255, 255, 0.9)',
};

const SENSOR_ORDER = [
    'temperature', 'tp4_temperature', 'humidity', 'lux', 'water_temp',
    'ph', 'ec', 'water_level', 'ec_a', 'ec_b',
    'ph_up', 'ph_down'
];

const STATUS_ORDER = [
    'valve_status', 'water_pump_status', 'eca_pump_status', 'ecb_pump_status',
    'ph_up_pump_status', 'ph_down_pump_status', 'fan_status', 'curtain_status',
    'fogger_status', 'light_status', 'micro_status', 'macro_status'
];

const SENSOR_FRIENDLY_NAMES: Record<string, string> = {
    temperature: 'Air Temp 1', tp4_temperature: 'Air Temp 2', humidity: 'Humidity',
    lux: 'Light', water_temp: 'Water Temp', ph: 'pH',
    ec: 'EC', ec_a: 'Tank A', ec_b: 'Tank B',
    ph_up: 'pH Up', ph_down: 'pH Down', water_level: 'Water Lvl'
};

const SETPOINT_CONFIGS: SetpointConfig[] = [
    // Environment Section
    { label: 'Total Soil Sensors', key: 'totalSoilSensors', unit: 'count', min: 0, max: 10, section: 'Environment', icon: '🌱' },
    { label: 'Lux Minimum', key: 'luxMinimum', unit: 'lux', min: 0, max: 10000, section: 'Environment', icon: '☀️' },
    { label: 'Lux Maximum', key: 'luxMaximum', unit: 'lux', min: 0, max: 10000, section: 'Environment', icon: '🌞' },
    { label: 'Circulation Fan', key: 'circulationFanSetpoint', unit: '°C', min: 0, max: 100, section: 'Environment', icon: '💨' },
    { label: 'Fogging Humidity Min', key: 'foggingHumidityMin', unit: '%', min: 0, max: 100, section: 'Environment', icon: '💧' },
    { label: 'Fogging Humidity Max', key: 'foggingHumidityMax', unit: '%', min: 0, max: 100, section: 'Environment', icon: '💦' },
    { label: 'Fogging Wait Time', key: 'foggingWaitTime', unit: 'min', min: 0, max: 100, section: 'Environment', icon: '⏱️' },

    // Irrigation Section
    { label: 'EC Setpoint', key: 'ecSetpoint', unit: '', min: 0, max: 2, section: 'Irrigation', icon: '⚡' },
    { label: 'EC Dose Seconds', key: 'ecDoseSeconds', unit: 'sec', min: 0, max: 500, section: 'Irrigation', icon: '⏲️' },
    { label: 'EC Dose Cycle', key: 'ecDoseCycle', unit: 'cycle', min: 0, max: 500, section: 'Irrigation', icon: '🔄' },
    { label: 'pH Min', key: 'phMin', unit: 'pH', min: 0, max: 14, section: 'Irrigation', icon: '🧪' },
    { label: 'pH Max', key: 'phMax', unit: 'pH', min: 0, max: 14, section: 'Irrigation', icon: '🧬' },
    { label: 'pH Dose Seconds', key: 'phDoseSeconds', unit: 'sec', min: 0, max: 100, section: 'Irrigation', icon: '⏲️' },
    { label: 'pH Dose Cycle', key: 'phDoseCycle', unit: 'cycle', min: 0, max: 500, section: 'Irrigation', icon: '🔄' },
    { label: 'Pump ON Setpoint', key: 'pumpOnSetpoint', unit: '', min: 0, max: 100, section: 'Irrigation', icon: '🚰' },
    { label: 'Pump OFF Setpoint', key: 'pumpOffSetpoint', unit: '', min: 0, max: 100, section: 'Irrigation', icon: '🚱' },
    { label: 'Irrigation Type', key: 'irrigationType', unit: '', min: 0, max: 1, section: 'Irrigation', icon: '💧' },

    // Nutrients Section
    { label: 'Nutrient Pump Time', key: 'nutrientPumpTime', unit: 'sec', min: 0, max: 500, section: 'Nutrients', icon: '💉' },
    { label: 'Nutrient On Hour', key: 'nutrientOnHour', unit: 'hr', min: 0, max: 23, section: 'Nutrients', icon: '🕐' },
    { label: 'EC Pump Error', key: 'ecPumpErrorSetpoint', unit: 'mS/cm', min: 0, max: 5, section: 'Nutrients', icon: '⚠️' },
    { label: 'pH Pump Error', key: 'phPumpErrorSetpoint', unit: '', min: 0, max: 5, section: 'Nutrients', icon: '⚠️' },

    // Lighting Section
    { label: 'Grow Light ON', key: 'growLightON', unit: 'hr', min: 0, max: 23, section: 'Lighting', icon: '💡' },
    { label: 'Grow Light OFF', key: 'growLightOFF', unit: 'hr', min: 0, max: 23, section: 'Lighting', icon: '🌙' },
];

// --- Helper Functions ---
const formatValue = (key: string, value: any) => {
    if (typeof value === 'string' && isNaN(parseFloat(value))) return value;
    const num = parseFloat(value);
    if (isNaN(num)) return "--";

    if (key.includes('temp')) return `${num.toFixed(1)}°C`;
    if (key === 'humidity') return `${num.toFixed(0)}%`;
    if (key === 'lux') return `${num} lx`;
    if (key === 'ec') return num.toFixed(1);
    if (key === 'ph') return num.toFixed(1);
    return value;
};

const isFresh = (ts: number) => {
    if (!ts) return false;
    const now = Date.now() / 1000;
    return (now - ts) < 300;
};

// --- Animated Button Component ---
const AnimatedButton = ({ onPress, style, children, disabled }: any) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.95,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
        }).start();
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
            disabled={disabled}
        >
            <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
                {children}
            </Animated.View>
        </TouchableOpacity>
    );
};

// --- Toast Component ---
const Toast = ({ message, type, visible, onHide }: any) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.sequence([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.delay(2000),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start(() => onHide());
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Animated.View style={[
            styles.toast,
            type === 'success' && styles.toastSuccess,
            type === 'error' && styles.toastError,
            { opacity: fadeAnim }
        ]}>
            <Text style={styles.toastText}>{type === 'success' ? '✓' : '✕'} {message}</Text>
        </Animated.View>
    );
};

// --- Components ---

const StatCard = ({ name, value, isError, isLow }: { name: string, value: string | number, isError: boolean, isLow: boolean }) => {
    return (
        <View style={[styles.card, isError ? styles.cardError : null]}>
            <Text style={styles.cardLabel} numberOfLines={1}>{name}</Text>
            <Text style={[
                styles.cardValue,
                isError || isLow ? styles.textError : styles.textMain
            ]}>
                {value}
            </Text>
        </View>
    );
};

const StatusPill = ({ name, status }: { name: string, status: number }) => {
    const isOn = status === 1;
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

const Header = ({ zoneId, lastUpdated, fresh, onSettingsPress, onExit }: { zoneId: string, lastUpdated: string, fresh: boolean, onSettingsPress: () => void, onExit?: () => void }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (fresh) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [fresh]);


    return (
        <View style={styles.header}>
            {onExit && (
                <TouchableOpacity onPress={onExit} style={{ position: 'absolute', left: 16, top: 16, zIndex: 10 }}>
                    <Text style={{ color: 'red', fontWeight: 'bold', fontSize: 16 }}>EXIT</Text>
                </TouchableOpacity>
            )}
            <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Zone {zoneId}</Text>
                <Text style={styles.headerSubtitle}>{lastUpdated}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.statusBadge, fresh ? styles.bgSuccessLight : styles.bgErrorLight]}>
                    <Animated.View style={[
                        styles.statusDot,
                        fresh ? styles.statusDotSuccess : styles.statusDotError,
                        { transform: [{ scale: pulseAnim }] }
                    ]} />
                    <Text style={[styles.statusText, fresh ? styles.textSuccess : styles.textError]}>
                        {fresh ? 'ONLINE' : 'OFFLINE'}
                    </Text>
                </View>
                <AnimatedButton onPress={onSettingsPress} style={styles.settingsButton}>
                    <View style={styles.settingsGlass}>
                        <Text style={styles.settingsIconText}>⚙️</Text>
                    </View>
                </AnimatedButton>
            </View>
        </View>
    );
};

// PIN Entry Modal
const PINModal = ({ visible, onSuccess, onCancel }: { visible: boolean, onSuccess: () => void, onCancel: () => void }) => {
    const [pin, setPin] = useState('');
    const [dots, setDots] = useState<boolean[]>([false, false, false, false]);
    const [error, setError] = useState(false);
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            setPin('');
            setDots([false, false, false, false]);
            setError(false);
        }
    }, [visible]);

    const shake = () => {
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
    };

    const handleNumberPress = (num: string) => {
        if (pin.length < 4) {
            const newPin = pin + num;
            setPin(newPin);
            const newDots = [...dots];
            newDots[pin.length] = true;
            setDots(newDots);

            if (newPin.length === 4) {
                setTimeout(() => {
                    if (newPin === CORRECT_PIN) {
                        Animated.timing(fadeAnim, {
                            toValue: 0,
                            duration: 200,
                            useNativeDriver: true,
                        }).start(() => {
                            onSuccess();
                        });
                    } else {
                        setError(true);
                        shake();
                        setTimeout(() => {
                            setPin('');
                            setDots([false, false, false, false]);
                            setError(false);
                        }, 800);
                    }
                }, 100);
            }
        }
    };

    const handleClear = () => {
        setPin('');
        setDots([false, false, false, false]);
        setError(false);
    };

    const handleBackspace = () => {
        if (pin.length > 0) {
            setPin(pin.slice(0, -1));
            const newDots = [...dots];
            newDots[pin.length - 1] = false;
            setDots(newDots);
            setError(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onCancel}
        >
            <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
                <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onCancel} />
                <Animated.View style={[
                    styles.pinCard,
                    error && styles.pinCardError,
                    { transform: [{ translateX: shakeAnim }], opacity: fadeAnim }
                ]}>
                    <View style={styles.pinHeader}>
                        <Text style={styles.pinTitle}>Enter PIN</Text>
                        <Text style={styles.pinSubtitle}>Enter 4-digit code to access settings</Text>
                    </View>

                    <View style={styles.dotsContainer}>
                        {dots.map((filled, idx) => (
                            <View key={idx} style={[
                                styles.pinDot,
                                filled && styles.pinDotFilled,
                                error && styles.pinDotError
                            ]} />
                        ))}
                    </View>

                    {error && (
                        <Text style={styles.pinErrorText}>Incorrect PIN. Try again.</Text>
                    )}

                    <View style={styles.keypad}>
                        {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['Clr', '0', '←']].map((row, rowIdx) => (
                            <View key={rowIdx} style={styles.keypadRow}>
                                {row.map((key) => (
                                    <AnimatedButton
                                        key={key}
                                        onPress={() => {
                                            if (key === 'Clr') handleClear();
                                            else if (key === '←') handleBackspace();
                                            else handleNumberPress(key);
                                        }}
                                        style={styles.keypadButton}
                                    >
                                        <Text style={styles.keypadText}>{key}</Text>
                                    </AnimatedButton>
                                ))}
                            </View>
                        ))}
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

// Settings Menu Screen
const SettingsScreen = ({ onNavigate, onBack }: { onNavigate: (screen: Screen) => void, onBack: () => void }) => {
    const getCurrentTime = () => {
        const now = new Date();
        return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    return (
        <View style={styles.fullScreen}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
            <View style={styles.settingsTopBar}>
                <AnimatedButton onPress={onBack} style={styles.backButtonTop}>
                    <Text style={styles.backArrow}>←</Text>
                    <Text style={styles.backText}>Back</Text>
                </AnimatedButton>
            </View>

            <View style={styles.settingsContainer}>
                <View style={styles.settingsHeader}>
                    <Text style={styles.settingsTitle}>Zone Settings</Text>
                    <Text style={styles.settingsTime}>{getCurrentTime()}</Text>
                </View>

                <View style={styles.settingsGrid}>
                    <AnimatedButton
                        style={[styles.settingsCard, { backgroundColor: COLORS.primaryLight }]}
                        onPress={() => onNavigate('setpoints')}
                    >
                        <View style={[styles.settingsIconCircle, { backgroundColor: COLORS.primary }]}>
                            <Text style={styles.settingsIconEmoji}>🎯</Text>
                        </View>
                        <Text style={styles.settingsCardText}>Setpoints</Text>
                        <Text style={styles.settingsCardSubtext}>Configure system values</Text>
                    </AnimatedButton>

                    <AnimatedButton
                        style={[styles.settingsCard, { backgroundColor: COLORS.purpleLight }]}
                        onPress={() => onNavigate('schedule')}
                    >
                        <View style={[styles.settingsIconCircle, { backgroundColor: COLORS.purple }]}>
                            <Text style={styles.settingsIconEmoji}>📅</Text>
                        </View>
                        <Text style={styles.settingsCardText}>Schedule</Text>
                        <Text style={styles.settingsCardSubtext}>Manage irrigation times</Text>
                    </AnimatedButton>

                    <AnimatedButton
                        style={[styles.settingsCard, { backgroundColor: COLORS.orangeLight }]}
                        onPress={() => onNavigate('zoneinfo')}
                    >
                        <View style={[styles.settingsIconCircle, { backgroundColor: COLORS.orange }]}>
                            <Text style={styles.settingsIconEmoji}>ℹ️</Text>
                        </View>
                        <Text style={styles.settingsCardText}>Zone Info</Text>
                        <Text style={styles.settingsCardSubtext}>View statistics</Text>
                    </AnimatedButton>
                </View>

                <AnimatedButton style={styles.exitButton} onPress={onBack}>
                    <Text style={styles.exitButtonText}>Exit Settings</Text>
                </AnimatedButton>
            </View>
        </View>
    );
};

// Enhanced Setpoint Card with Stepper
const SetpointCardEnhanced = ({ config, value, onChange, hasChanges }: any) => {
    const [localValue, setLocalValue] = useState(value);

    const increment = () => {
        const newVal = Math.min(localValue + 1, config.max);
        setLocalValue(newVal);
        onChange(config.key, newVal);
    };

    const decrement = () => {
        const newVal = Math.max(localValue - 1, config.min);
        setLocalValue(newVal);
        onChange(config.key, newVal);
    };

    const handleTextChange = (text: string) => {
        const num = parseFloat(text);
        if (!isNaN(num) && num >= config.min && num <= config.max) {
            setLocalValue(num);
            onChange(config.key, num);
        }
    };

    return (
        <View style={[styles.setpointCardEnhanced, hasChanges && styles.setpointCardModified]}>
            <View style={styles.setpointCardLeft}>
                <Text style={styles.setpointIcon}>{config.icon}</Text>
                <View>
                    <Text style={styles.setpointLabel}>{config.label}</Text>
                    <Text style={styles.setpointRange}>{config.min} - {config.max} {config.unit}</Text>
                </View>
            </View>
            <View style={styles.setpointCardRight}>
                <AnimatedButton onPress={decrement} style={styles.stepperButton}>
                    <Text style={styles.stepperButtonText}>−</Text>
                </AnimatedButton>
                <TextInput
                    style={styles.setpointValueInput}
                    value={localValue.toString()}
                    onChangeText={handleTextChange}
                    keyboardType="numeric"
                />
                <AnimatedButton onPress={increment} style={styles.stepperButton}>
                    <Text style={styles.stepperButtonText}>+</Text>
                </AnimatedButton>
            </View>
        </View>
    );
};

// Setpoints Screen with Sections
const SetpointsScreen = ({ zoneId, onBack }: { zoneId: string, onBack: () => void }) => {
    const [setpoints, setSetpoints] = useState<any>({
        totalSoilSensors: 7, ecSetpoint: 0.80, ecDoseSeconds: 50, ecDoseCycle: 220,
        phMin: 5.50, phMax: 6.50, phDoseSeconds: 30, phDoseCycle: 220,
        pumpOnSetpoint: 40, pumpOffSetpoint: 50, ecPumpErrorSetpoint: 1.40,
        phPumpErrorSetpoint: 4.00, luxMinimum: 100, luxMaximum: 500,
        foggingHumidityMin: 60, foggingHumidityMax: 80, foggingWaitTime: 5,
        circulationFanSetpoint: 30, irrigationType: 0, nutrientPumpTime: 15,
        nutrientOnHour: 11, growLightON: 9, growLightOFF: 18
    });

    const [originalSetpoints, setOriginalSetpoints] = useState(setpoints);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

    const hasChanges = JSON.stringify(setpoints) !== JSON.stringify(originalSetpoints);

    const handleSetpointChange = (key: string, value: number) => {
        setSetpoints((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        setOriginalSetpoints(setpoints);
        setSaving(false);
        setToast({ visible: true, message: 'Setpoints saved successfully!', type: 'success' });
    };

    const handleReset = () => {
        Alert.alert('Reset Setpoints', 'Are you sure you want to reset all changes?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reset', style: 'destructive', onPress: () => setSetpoints(originalSetpoints) }
        ]);
    };

    const sections = ['Environment', 'Irrigation', 'Nutrients', 'Lighting'];

    return (
        <View style={styles.fullScreen}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            <View style={styles.stickyHeader}>
                <AnimatedButton onPress={onBack} style={styles.backButtonTop}>
                    <Text style={styles.backArrow}>←</Text>
                    <Text style={styles.backText}>Back</Text>
                </AnimatedButton>
                <View style={styles.pageHeaderCenter}>
                    <Text style={styles.pageTitle}>Setpoints</Text>
                    <Text style={styles.pageSubtitle}>Zone {zoneId}</Text>
                </View>
                <View style={styles.pageHeaderRight}>
                    {hasChanges && (
                        <View style={styles.changesBadge}>
                            <Text style={styles.changesBadgeText}>●</Text>
                        </View>
                    )}
                </View>
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.contentPadded}>
                {sections.map(section => (
                    <View key={section}>
                        <Text style={styles.sectionTitleEnhanced}>{section}</Text>
                        {SETPOINT_CONFIGS.filter(c => c.section === section).map((config) => (
                            <SetpointCardEnhanced
                                key={config.key}
                                config={config}
                                value={setpoints[config.key]}
                                onChange={handleSetpointChange}
                                hasChanges={setpoints[config.key] !== originalSetpoints[config.key]}
                            />
                        ))}
                    </View>
                ))}

                <View style={styles.actionButtonsRow}>
                    <AnimatedButton
                        style={[styles.secondaryButton, { flex: 1 }]}
                        onPress={handleReset}
                        disabled={!hasChanges}
                    >
                        <Text style={[styles.secondaryButtonText, !hasChanges && styles.disabledText]}>
                            Reset
                        </Text>
                    </AnimatedButton>
                    <AnimatedButton
                        style={[styles.primaryButton, { flex: 2 }, !hasChanges && styles.disabledButton]}
                        onPress={handleSave}
                        disabled={!hasChanges || saving}
                    >
                        {saving ? (
                            <ActivityIndicator color={COLORS.card} />
                        ) : (
                            <Text style={styles.primaryButtonText}>
                                💾 Save Changes
                            </Text>
                        )}
                    </AnimatedButton>
                </View>

                <View style={{ height: 20 }} />
            </ScrollView>

            <Toast
                message={toast.message}
                type={toast.type}
                visible={toast.visible}
                onHide={() => setToast({ ...toast, visible: false })}
            />
        </View>
    );
};

// Editable Schedule Screen
const ScheduleScreen = ({ zoneId, onBack }: { zoneId: string, onBack: () => void }) => {
    const [schedules, setSchedules] = useState<Schedule[]>([
        { id: 1, active: true, startHour: 6, startMinute: 0, endHour: 8, endMinute: 30 },
        { id: 2, active: true, startHour: 10, startMinute: 0, endHour: 12, endMinute: 0 },
        { id: 3, active: true, startHour: 14, startMinute: 15, endHour: 16, endMinute: 45 },
        { id: 4, active: true, startHour: 18, startMinute: 0, endHour: 20, endMinute: 0 },
        { id: 5, active: false, startHour: 23, startMinute: 0, endHour: 20, endMinute: 0 },
    ]);

    const [originalSchedules, setOriginalSchedules] = useState(schedules);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

    const hasChanges = JSON.stringify(schedules) !== JSON.stringify(originalSchedules);

    const updateSchedule = (id: number, field: keyof Schedule, value: any) => {
        setSchedules(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleSave = async () => {
        setSaving(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setOriginalSchedules(schedules);
        setSaving(false);
        setToast({ visible: true, message: 'Schedule saved successfully!', type: 'success' });
    };

    const handleReset = () => {
        setSchedules(originalSchedules);
    };

    const EditableScheduleCard = ({ schedule }: { schedule: Schedule }) => {
        const isModified = JSON.stringify(schedule) !== JSON.stringify(
            originalSchedules.find(s => s.id === schedule.id)
        );

        return (
            <View style={[styles.editableScheduleCard, isModified && styles.scheduleCardModified]}>
                <View style={styles.scheduleCardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={styles.scheduleTitle}>Schedule {schedule.id}</Text>
                        {isModified && (
                            <View style={styles.modifiedBadge}>
                                <Text style={styles.modifiedBadgeText}>Modified</Text>
                            </View>
                        )}
                    </View>
                    <Switch
                        value={schedule.active}
                        onValueChange={(val) => updateSchedule(schedule.id, 'active', val)}
                        trackColor={{ false: COLORS.border, true: COLORS.success }}
                        thumbColor={COLORS.card}
                    />
                </View>

                <View style={styles.timePickerRow}>
                    <View style={styles.timePickerSection}>
                        <Text style={styles.timePickerLabel}>Start Time</Text>
                        <View style={styles.timePickerInputs}>
                            <View style={styles.timeInputGroup}>
                                <AnimatedButton
                                    onPress={() => updateSchedule(schedule.id, 'startHour', Math.max(0, schedule.startHour - 1))}
                                    style={styles.timeButton}
                                >
                                    <Text style={styles.timeButtonText}>▲</Text>
                                </AnimatedButton>
                                <TextInput
                                    style={styles.timeInput}
                                    value={String(schedule.startHour).padStart(2, '0')}
                                    keyboardType="numeric"
                                    maxLength={2}
                                    onChangeText={(text) => {
                                        const num = parseInt(text) || 0;
                                        if (num >= 0 && num <= 23) updateSchedule(schedule.id, 'startHour', num);
                                    }}
                                />
                                <AnimatedButton
                                    onPress={() => updateSchedule(schedule.id, 'startHour', Math.min(23, schedule.startHour + 1))}
                                    style={styles.timeButton}
                                >
                                    <Text style={styles.timeButtonText}>▼</Text>
                                </AnimatedButton>
                            </View>
                            <Text style={styles.timeSeparator}>:</Text>
                            <View style={styles.timeInputGroup}>
                                <AnimatedButton
                                    onPress={() => updateSchedule(schedule.id, 'startMinute', Math.max(0, schedule.startMinute - 15))}
                                    style={styles.timeButton}
                                >
                                    <Text style={styles.timeButtonText}>▲</Text>
                                </AnimatedButton>
                                <TextInput
                                    style={styles.timeInput}
                                    value={String(schedule.startMinute).padStart(2, '0')}
                                    keyboardType="numeric"
                                    maxLength={2}
                                    onChangeText={(text) => {
                                        const num = parseInt(text) || 0;
                                        if (num >= 0 && num <= 59) updateSchedule(schedule.id, 'startMinute', num);
                                    }}
                                />
                                <AnimatedButton
                                    onPress={() => updateSchedule(schedule.id, 'startMinute', Math.min(59, schedule.startMinute + 15))}
                                    style={styles.timeButton}
                                >
                                    <Text style={styles.timeButtonText}>▼</Text>
                                </AnimatedButton>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.timeArrow}>→</Text>

                    <View style={styles.timePickerSection}>
                        <Text style={styles.timePickerLabel}>End Time</Text>
                        <View style={styles.timePickerInputs}>
                            <View style={styles.timeInputGroup}>
                                <AnimatedButton
                                    onPress={() => updateSchedule(schedule.id, 'endHour', Math.max(0, schedule.endHour - 1))}
                                    style={styles.timeButton}
                                >
                                    <Text style={styles.timeButtonText}>▲</Text>
                                </AnimatedButton>
                                <TextInput
                                    style={styles.timeInput}
                                    value={String(schedule.endHour).padStart(2, '0')}
                                    keyboardType="numeric"
                                    maxLength={2}
                                    onChangeText={(text) => {
                                        const num = parseInt(text) || 0;
                                        if (num >= 0 && num <= 23) updateSchedule(schedule.id, 'endHour', num);
                                    }}
                                />
                                <AnimatedButton
                                    onPress={() => updateSchedule(schedule.id, 'endHour', Math.min(23, schedule.endHour + 1))}
                                    style={styles.timeButton}
                                >
                                    <Text style={styles.timeButtonText}>▼</Text>
                                </AnimatedButton>
                            </View>
                            <Text style={styles.timeSeparator}>:</Text>
                            <View style={styles.timeInputGroup}>
                                <AnimatedButton
                                    onPress={() => updateSchedule(schedule.id, 'endMinute', Math.max(0, schedule.endMinute - 15))}
                                    style={styles.timeButton}
                                >
                                    <Text style={styles.timeButtonText}>▲</Text>
                                </AnimatedButton>
                                <TextInput
                                    style={styles.timeInput}
                                    value={String(schedule.endMinute).padStart(2, '0')}
                                    keyboardType="numeric"
                                    maxLength={2}
                                    onChangeText={(text) => {
                                        const num = parseInt(text) || 0;
                                        if (num >= 0 && num <= 59) updateSchedule(schedule.id, 'endMinute', num);
                                    }}
                                />
                                <AnimatedButton
                                    onPress={() => updateSchedule(schedule.id, 'endMinute', Math.min(59, schedule.endMinute + 15))}
                                    style={styles.timeButton}
                                >
                                    <Text style={styles.timeButtonText}>▼</Text>
                                </AnimatedButton>
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.fullScreen}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            <View style={styles.stickyHeader}>
                <AnimatedButton onPress={onBack} style={styles.backButtonTop}>
                    <Text style={styles.backArrow}>←</Text>
                    <Text style={styles.backText}>Back</Text>
                </AnimatedButton>
                <View style={styles.pageHeaderCenter}>
                    <Text style={styles.pageTitle}>Schedule</Text>
                    <Text style={styles.pageSubtitle}>Zone {zoneId}</Text>
                </View>
                <View style={styles.pageHeaderRight}>
                    {hasChanges && (
                        <View style={styles.changesBadge}>
                            <Text style={styles.changesBadgeText}>●</Text>
                        </View>
                    )}
                </View>
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.contentPadded}>
                {schedules.map((schedule) => (
                    <EditableScheduleCard key={schedule.id} schedule={schedule} />
                ))}

                <View style={styles.actionButtonsRow}>
                    <AnimatedButton
                        style={[styles.secondaryButton, { flex: 1 }]}
                        onPress={handleReset}
                        disabled={!hasChanges}
                    >
                        <Text style={[styles.secondaryButtonText, !hasChanges && styles.disabledText]}>
                            Reset
                        </Text>
                    </AnimatedButton>
                    <AnimatedButton
                        style={[styles.primaryButton, { flex: 2 }, !hasChanges && styles.disabledButton]}
                        onPress={handleSave}
                        disabled={!hasChanges || saving}
                    >
                        {saving ? (
                            <ActivityIndicator color={COLORS.card} />
                        ) : (
                            <Text style={styles.primaryButtonText}>
                                💾 Save Schedule
                            </Text>
                        )}
                    </AnimatedButton>
                </View>

                <View style={{ height: 20 }} />
            </ScrollView>

            <Toast
                message={toast.message}
                type={toast.type}
                visible={toast.visible}
                onHide={() => setToast({ ...toast, visible: false })}
            />
        </View>
    );
};

// Zone Info Screen
const ZoneInfoScreen = ({ zoneId, onBack }: { zoneId: string, onBack: () => void }) => {
    const [info] = useState({
        pumpOnCount: 58, nutrient1Count: 0, nutrient2Count: 0,
        nutrient3Count: 0, nutrient4Count: 0, tankFillCount: 1,
        ecDoCount: 5, phDownDoCount: 34, phUpDoCount: 1, pumpOnHours: 4,
    });

    const InfoCard = ({ label, value, color, icon }: any) => (
        <View style={styles.infoCardEnhanced}>
            <View style={styles.infoCardHeader}>
                <Text style={styles.infoIcon}>{icon}</Text>
                <Text style={styles.infoLabel}>{label}</Text>
            </View>
            <Text style={[styles.infoValue, { color }]}>{value}</Text>
        </View>
    );

    return (
        <View style={styles.fullScreen}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            <View style={styles.stickyHeader}>
                <AnimatedButton onPress={onBack} style={styles.backButtonTop}>
                    <Text style={styles.backArrow}>←</Text>
                    <Text style={styles.backText}>Back</Text>
                </AnimatedButton>
                <View style={styles.pageHeaderCenter}>
                    <Text style={styles.pageTitle}>Zone Info</Text>
                    <Text style={styles.pageSubtitle}>Zone {zoneId}</Text>
                </View>
                <View style={styles.pageHeaderRight} />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.contentPadded}>
                <View style={styles.infoGrid}>
                    <InfoCard label="Pump On Count" value={info.pumpOnCount} color={COLORS.primary} icon="🚰" />
                    <InfoCard label="Nutrient 1" value={info.nutrient1Count} color={COLORS.success} icon="💉" />
                    <InfoCard label="Nutrient 2" value={info.nutrient2Count} color={COLORS.success} icon="💉" />
                    <InfoCard label="Nutrient 3" value={info.nutrient3Count} color={COLORS.success} icon="💉" />
                    <InfoCard label="Nutrient 4" value={info.nutrient4Count} color={COLORS.success} icon="💉" />
                    <InfoCard label="Tank Fill" value={info.tankFillCount} color={COLORS.purple} icon="🪣" />
                    <InfoCard label="EC Dosing" value={info.ecDoCount} color={COLORS.orange} icon="⚡" />
                    <InfoCard label="pH Down" value={info.phDownDoCount} color={COLORS.warning} icon="🔽" />
                    <InfoCard label="pH Up" value={info.phUpDoCount} color={COLORS.warning} icon="🔼" />
                    <InfoCard label="Pump Hours" value={info.pumpOnHours} color={COLORS.teal} icon="⏱️" />
                </View>

                <View style={{ height: 20 }} />
            </ScrollView>
        </View>
    );
};

// Main Zone Screen
const ZoneScreen = ({ zoneId, apiBase, onExit }: { zoneId: string, apiBase: string, onExit: () => void }) => {
    const [screen, setScreen] = useState<Screen>('zone');
    const [refreshing, setRefreshing] = useState(false);
    const [zoneData, setZoneData] = useState<ZoneData | null>(null);
    const [smData, setSmData] = useState<SMData | null>(null);
    const [setpointData, setSetpointData] = useState<SetpointData | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string>('Loading...');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
    try {
        console.log("API BASE:", apiBase);

        const url1 = `${apiBase}/data`;
        const url2 = `${apiBase}/data/${zoneId}/sm`;
        const url3 = `${apiBase}/data/${zoneId}/setpoints`;

        console.log("URL1:", url1);
        console.log("URL2:", url2);
        console.log("URL3:", url3);

        const [zRes, sRes, spRes] = await Promise.all([
            fetch(url1),
            fetch(url2),
            fetch(url3)
        ]);

        console.log("zRes status:", zRes.status);

        if (!zRes.ok || !sRes.ok || !spRes.ok)
            throw new Error("Request failed");

        const zData = await zRes.json();
        setZoneData(zData);
        setSmData(await sRes.json());
        setSetpointData(await spRes.json());

    } catch (err) {
        console.log("FETCH ERROR:", err);
        setErrorMsg("Connection failed");
    }
}, [apiBase, zoneId]);


    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const renderSensors = () => {
        if (!zoneData || !setpointData) return null;
        const payload = zoneData.payload || {};

        return SENSOR_ORDER.map(key => {
            if (payload[key] === undefined) return null;
            let val = payload[key];
            let displayVal: string | number = val;

            if (key === 'water_level') {
                if (val == 0) displayVal = 'Low';
                else if (val == 1) displayVal = 'Mid';
                else if (val == 2) displayVal = 'High';
            }

            const isError = (key !== 'lux' && val >= 6500);
            const isLow = (displayVal === 'Low');

            displayVal = isError ? "ERR" : formatValue(key, displayVal);

            return (
                <View key={key} style={styles.gridItemSensor}>
                    <StatCard
                        name={SENSOR_FRIENDLY_NAMES[key] || key}
                        value={displayVal}
                        isError={isError}
                        isLow={isLow}
                    />
                </View>
            );
        });
    };

    const renderSoil = () => {
        if (!smData) return null;
        const payload = smData.payload || {};
        const keys = Object.keys(payload).filter(k => k.startsWith('soil_moisture_'));

        return keys.map(k => {
            const index = k.split('_')[2];
            const isError = payload[k] >= 6500;
            return (
                <View key={k} style={styles.gridItemSoil}>
                    <StatCard
                        name={`Soil ${index}`}
                        value={isError ? "ERR" : `${payload[k]}%`}
                        isError={isError}
                        isLow={false}
                    />
                </View>
            );
        });
    };

    const renderStatus = () => {
        if (!zoneData) return null;
        const payload = zoneData.payload || {};

        return (
            <View style={styles.statusGrid}>
                {STATUS_ORDER.map(key => {
                    if (payload[key] === undefined) return null;
                    return <StatusPill key={key} name={key} status={Number(payload[key])} />;
                })}
            </View>
        );
    };

    const fresh = zoneData ? isFresh(zoneData.timestamp) : false;

    // ================= SCREEN ROUTER =================

    // PIN
    if (screen === 'pin') {
        return (
            <PINModal
                visible={true}
                onSuccess={() => setScreen('settings')}
                onCancel={() => setScreen('zone')}
            />
        );
    }

    // SETTINGS MENU
    if (screen === 'settings') {
        return (
            <SettingsScreen
                onNavigate={setScreen}
                onBack={() => setScreen('zone')}
            />
        );
    }

    // SETPOINTS
    if (screen === 'setpoints') {
        return (
            <SetpointsScreen
                zoneId={zoneId}
                onBack={() => setScreen('settings')}
            />
        );
    }

    // SCHEDULE
    if (screen === 'schedule') {
        return (
            <ScheduleScreen
                zoneId={zoneId}
                onBack={() => setScreen('settings')}
            />
        );
    }

    // ZONE INFO
    if (screen === 'zoneinfo') {
        return (
            <ZoneInfoScreen
                zoneId={zoneId}
                onBack={() => setScreen('settings')}
            />
        );
    }

    // MAIN ZONE DASHBOARD (screen === 'zone')
    return (
        <View style={styles.fullScreen}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
            >
                <Header
                    zoneId={zoneId}
                    lastUpdated={lastUpdated}
                    fresh={fresh}
                    onSettingsPress={() => setScreen('pin')}
                    onExit={onExit}
                />

                {errorMsg && (
                    <View style={styles.errorBanner}>
                        <Text style={styles.errorIcon}>⚠️</Text>
                        <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                )}

                <Text style={styles.sectionTitle}>Environment</Text>
                <View style={styles.grid}>
                    {renderSensors()}
                </View>

                {smData && smData.no_of_soil_sensors > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>Soil Moisture</Text>
                        <View style={styles.grid}>
                            {renderSoil()}
                        </View>
                    </>
                )}

                <Text style={styles.sectionTitle}>System Status</Text>
                {renderStatus()}

                <View style={{ height: 30 }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    fullScreen: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
    },
    contentPadded: {
        padding: 16,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        marginTop: 4,
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: COLORS.textMain,
        letterSpacing: -1,
    },
    headerSubtitle: {
        fontSize: 14,
        color: COLORS.textSub,
        fontWeight: '500',
        marginTop: 4,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusDotSuccess: {
        backgroundColor: COLORS.success,
    },
    statusDotError: {
        backgroundColor: COLORS.error,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    bgSuccessLight: {
        backgroundColor: COLORS.successLight,
        borderWidth: 1,
        borderColor: '#86EFAC',
    },
    bgErrorLight: {
        backgroundColor: COLORS.errorLight,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    textSuccess: { color: COLORS.success },
    textError: { color: COLORS.error },
    settingsButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    settingsGlass: {
        width: '100%',
        height: '100%',
        borderRadius: 24,
        backgroundColor: COLORS.glass,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    settingsIconText: {
        fontSize: 24,
    },

    // Grid
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -6,
    },
    gridItemSensor: {
        width: '33.33%',
        padding: 6,
    },
    gridItemSoil: {
        width: '20%',
        padding: 6,
    },

    // Cards
    card: {
        backgroundColor: COLORS.card,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 70,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
    },
    cardError: {
        borderColor: COLORS.error,
        backgroundColor: COLORS.errorLight,
    },
    cardLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textSub,
        textAlign: 'center',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    cardValue: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textMain,
        textAlign: 'center',
    },
    textMain: { color: COLORS.textMain },

    // Status Pills
    statusGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        gap: 8,
    },
    pillActive: {
        backgroundColor: COLORS.successLight,
        borderColor: COLORS.success,
    },
    pillInactive: {
        backgroundColor: COLORS.card,
        borderColor: COLORS.border,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    dotActive: {
        backgroundColor: COLORS.success,
    },
    dotInactive: { backgroundColor: COLORS.textSub },
    pillText: {
        fontSize: 13,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    pillTextActive: { color: COLORS.textMain },
    pillTextInactive: { color: COLORS.textSub },

    // Section
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textMain,
        marginTop: 28,
        marginBottom: 14,
        marginLeft: 4,
        letterSpacing: -0.5,
    },
    sectionTitleEnhanced: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textMain,
        marginTop: 24,
        marginBottom: 12,
        marginLeft: 4,
        letterSpacing: -0.3,
        textTransform: 'uppercase',
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.errorLight,
        padding: 14,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FEE2E2',
        gap: 8,
    },
    errorIcon: {
        fontSize: 18,
    },
    errorText: {
        color: COLORS.error,
        fontSize: 14,
        fontWeight: '600',
    },

    // PIN Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    pinCard: {
        backgroundColor: COLORS.card,
        borderRadius: 24,
        padding: 32,
        width: width - 48,
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    pinCardError: {
        borderWidth: 2,
        borderColor: COLORS.error,
    },
    pinHeader: {
        alignItems: 'center',
        marginBottom: 32,
    },
    pinTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: COLORS.textMain,
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    pinSubtitle: {
        fontSize: 15,
        color: COLORS.textSub,
        textAlign: 'center',
        lineHeight: 22,
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        marginBottom: 24,
    },
    pinDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: COLORS.borderLight,
        borderWidth: 2,
        borderColor: COLORS.border,
    },
    pinDotFilled: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
        transform: [{ scale: 1.1 }],
    },
    pinDotError: {
        backgroundColor: COLORS.error,
        borderColor: COLORS.error,
    },
    pinErrorText: {
        color: COLORS.error,
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 16,
    },
    keypad: {
        gap: 14,
    },
    keypadRow: {
        flexDirection: 'row',
        gap: 14,
        justifyContent: 'center',
    },
    keypadButton: {
        width: 75,
        height: 75,
        borderRadius: 16,
        backgroundColor: COLORS.bg,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    keypadText: {
        fontSize: 26,
        fontWeight: '700',
        color: COLORS.textMain,
    },

    // Settings Screen
    settingsTopBar: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 50 : 16,
        paddingBottom: 12,
        backgroundColor: COLORS.bg,
    },
    backButtonTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    backArrow: {
        fontSize: 24,
        color: COLORS.textMain,
        fontWeight: '600',
    },
    backText: {
        fontSize: 17,
        color: COLORS.textMain,
        fontWeight: '600',
    },
    settingsContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    settingsHeader: {
        alignItems: 'center',
        marginBottom: 48,
    },
    settingsTitle: {
        fontSize: 36,
        fontWeight: '900',
        color: COLORS.textMain,
        marginBottom: 8,
        letterSpacing: -1,
    },
    settingsTime: {
        fontSize: 16,
        color: COLORS.textSub,
        fontWeight: '600',
    },
    settingsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 16,
        marginBottom: 48,
        width: '100%',
    },
    settingsCard: {
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        width: (width - 72) / 2,
        minHeight: 180,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
        justifyContent: 'center',
    },
    settingsIconCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    settingsIconEmoji: {
        fontSize: 34,
    },
    settingsCardText: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textMain,
        marginBottom: 4,
    },
    settingsCardSubtext: {
        fontSize: 12,
        color: COLORS.textSub,
        fontWeight: '500',
        textAlign: 'center',
    },
    exitButton: {
        backgroundColor: COLORS.textMain,
        borderRadius: 16,
        paddingVertical: 18,
        paddingHorizontal: 48,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    exitButtonText: {
        color: COLORS.card,
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.5,
    },

    // Sticky Header
    stickyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 50 : 16,
        paddingBottom: 16,
        backgroundColor: COLORS.card,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 3,
    },
    pageHeaderCenter: {
        flex: 1,
        alignItems: 'center',
    },
    pageTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: COLORS.textMain,
        letterSpacing: -0.5,
    },
    pageSubtitle: {
        fontSize: 13,
        color: COLORS.textSub,
        fontWeight: '600',
        marginTop: 2,
    },
    pageHeaderRight: {
        width: 80,
        alignItems: 'flex-end',
    },
    changesBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.warning,
        justifyContent: 'center',
        alignItems: 'center',
    },
    changesBadgeText: {
        color: COLORS.card,
        fontSize: 20,
        fontWeight: '700',
    },

    // Enhanced Setpoints
    setpointCardEnhanced: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    setpointCardModified: {
        borderColor: COLORS.warning,
        borderWidth: 2,
        backgroundColor: COLORS.warningLight,
    },
    setpointCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    setpointIcon: {
        fontSize: 28,
    },
    setpointLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textMain,
        marginBottom: 2,
    },
    setpointRange: {
        fontSize: 11,
        color: COLORS.textSub,
        fontWeight: '500',
    },
    setpointCardRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    stepperButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stepperButtonText: {
        color: COLORS.card,
        fontSize: 20,
        fontWeight: '700',
    },
    setpointValueInput: {
        width: 60,
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textMain,
        textAlign: 'center',
        borderBottomWidth: 2,
        borderBottomColor: COLORS.primary,
        paddingVertical: 4,
    },

    // Action Buttons
    actionButtonsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    primaryButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    primaryButtonText: {
        color: COLORS.card,
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    secondaryButton: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.border,
    },
    secondaryButtonText: {
        color: COLORS.textMain,
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    disabledButton: {
        backgroundColor: COLORS.border,
        opacity: 0.5,
    },
    disabledText: {
        color: COLORS.textSub,
    },

    // Editable Schedule
    editableScheduleCard: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    scheduleCardModified: {
        borderColor: COLORS.warning,
        borderWidth: 2,
        backgroundColor: COLORS.warningLight,
    },
    scheduleCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    scheduleTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textMain,
        letterSpacing: -0.3,
    },
    modifiedBadge: {
        backgroundColor: COLORS.warning,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    modifiedBadgeText: {
        color: COLORS.card,
        fontSize: 11,
        fontWeight: '700',
    },
    timePickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    timePickerSection: {
        flex: 1,
    },
    timePickerLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textSub,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    timePickerInputs: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    timeInputGroup: {
        alignItems: 'center',
        gap: 4,
    },
    timeButton: {
        width: 32,
        height: 24,
        borderRadius: 8,
        backgroundColor: COLORS.bg,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    timeButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textMain,
    },
    timeInput: {
        width: 50,
        fontSize: 24,
        fontWeight: '900',
        color: COLORS.textMain,
        textAlign: 'center',
        borderBottomWidth: 2,
        borderBottomColor: COLORS.primary,
        paddingVertical: 4,
    },
    timeSeparator: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.textSub,
        marginHorizontal: 4,
    },
    timeArrow: {
        fontSize: 24,
        color: COLORS.textSub,
        marginHorizontal: 8,
    },

    // Info Cards
    infoGrid: {
        gap: 12,
    },
    infoCardEnhanced: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    infoCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    infoIcon: {
        fontSize: 24,
    },
    infoLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textSub,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    infoValue: {
        fontSize: 36,
        fontWeight: '900',
        letterSpacing: -1,
    },

    // Toast
    toast: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 20,
        alignSelf: 'center',
        backgroundColor: COLORS.card,
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 9999,
    },
    toastSuccess: {
        borderLeftWidth: 4,
        borderLeftColor: COLORS.success,
    },
    toastError: {
        borderLeftWidth: 4,
        borderLeftColor: COLORS.error,
    },
    toastText: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textMain,
    },
});

export default ZoneScreen;