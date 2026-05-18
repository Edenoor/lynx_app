import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Switch,
  Alert,
  AppState,
  Pressable
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import useViewModel from './ViewModel';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigator/DriverStackNavigator';
import global from '../../../theme/global';
import { postJson } from '../../../config/Api';
import { useOnboarding } from "./../../../onboarding/OnboardingContext"; 

// 🔔 helpers de notificaciones/heartbeat
import { setupPushAndRegisterDevice, attachNotificationListeners } from '../../../config/Push';
import { startDriverHeartbeat, stopDriverHeartbeat } from '../../../config/HeartBeat';

// 🔔 campanita visual
import Bell from '../../../components/Bell';
import { useNotifications } from '../../../context/NotificationContext';

interface Props extends StackScreenProps<RootStackParamList, 'DriverScreen'> {}

const VEHICLE_KEYS_GUESS = ['vehicle', 'vehiculo', 'vehicleType', 'tipo_vehiculo', 'vehicle_type'];

const getVehicleEmoji = (user: any): string => {
  const raw =
    VEHICLE_KEYS_GUESS.map((k) => (user && user[k] ? String(user[k]) : '')).find(Boolean) || '';
  const s = raw.toLowerCase();
  if (s.includes('moto') || s.includes('moped') || s.includes('bike')) return '🏍️';
  return '🚚'; // default
};

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';



async function acceptShipmentInline(tracking: string, driverUsername: string) {
  const res = await fetch(`${API_BASE}/envios/${tracking}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driverUsername }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || 'Error al aceptar envío');
  }
}

export const DriverScreen = ({ navigation }: Props) => {
  const { user, removeUserSession } = useViewModel();
  const { add } = useNotifications();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [turboOn, setTurboOn] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [available] = useState<boolean>(true);

  const username = (user as any)?.username || user?.email || user?.name || '';

  const defaultVehicleType = useMemo(() => {
    const raw =
      VEHICLE_KEYS_GUESS.map((k) => (user && (user as any)[k] ? String((user as any)[k]) : '')).find(
        Boolean
      ) || '';
    const s = raw.toLowerCase();
    if (s.includes('moto') || s.includes('bike') || s.includes('moped')) return 'moto';
    if (s.includes('auto') || s.includes('car')) return 'auto';
    return 'camioneta';
  }, [user]);

  // 🧲 setup push + listeners + heartbeat
  const detachNotiRef = useRef<null | (() => void)>(null);
  useEffect(() => {
    if (!username) return;

    let mounted = true;

    (async () => {
      try {
        await setupPushAndRegisterDevice({
          username,
          rol: 'driver',
          vehicleType: defaultVehicleType,
        });

        detachNotiRef.current = attachNotificationListeners({
          currentUser: { username, rol: 'driver' },
          onNewTrad: (tracking) => {
            if (!tracking) return;
            Alert.alert(
              'Nuevo envío cercano',
              `Tracking: ${tracking}`,
              [
                { text: 'Más tarde' },
                {
                  text: 'Aceptar ahora',
                  onPress: async () => {
                    try {
                      await acceptShipmentInline(tracking, username);
                      Alert.alert('Listo ✅', `Tomaste el envío ${tracking}`);
                    } catch (e: any) {
                      Alert.alert('Error', e?.message || 'No se pudo aceptar');
                    }
                  },
                },
              ],
              { cancelable: true }
            );
          },
          onAny: ({ kind, title, body, data }) => {
            add({ title, body, kind, data });
          },
        });

        startDriverHeartbeat(username, available, defaultVehicleType);
      } catch (e) {
        // silencioso
      }
    })();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        startDriverHeartbeat(username, available, defaultVehicleType);
      } else {
        stopDriverHeartbeat();
      }
    });

    return () => {
      mounted = false;
      sub.remove();
      stopDriverHeartbeat();
      if (detachNotiRef.current) detachNotiRef.current();
    };
  }, [username, available, defaultVehicleType]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!username) return;
      try {
        const r = await postJson('/driver/availability/get', { username });
        if (mounted && r?.ok !== false) {
          setTurboOn(Boolean(r?.turbo_active ?? false));
        }
      } catch (_e) {}
    })();
    return () => {
      mounted = false;
    };
  }, [username]);

  const toggleTurbo = async (val: boolean) => {
    if (!username) return;
    setTurboOn(val);
    setSaving(true);
    try {
      await postJson('/driver/availability/set', { username, turbo_active: val });
    } catch (_e) {
      setTurboOn(!val);
    } finally {
      setSaving(false);
    }
  };

  const removeSession = async () => {
    await removeUserSession();
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: 'HomeScreen' as never }],
    });
  };

  const navigateTo = (screenName: keyof RootStackParamList) => {
    navigation.navigate(screenName);
    setIsSidebarOpen(false);
  };

  const handleOptionPress = () => {
    setModalVisible(false);
    navigation.navigate('EnviosScreen');
  };

  const vehicleEmoji = useMemo(() => getVehicleEmoji(user), [user]);
  const turboColor = turboOn ? '#16a34a' : '#ef4444';
const { resetForCurrentUser } = useOnboarding();
  return (
    <View style={styles.container}>
      {/* Mapa */}
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: -34.6037,
          longitude: -58.3816,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        <Marker coordinate={{ latitude: -34.6037, longitude: -58.3816 }} />
      </MapView>

      {/* Botón de menú */}
      <TouchableOpacity onPress={() => setIsSidebarOpen(true)} style={styles.menuIcon}>
        <Image source={require('../../../../../assets/user.png')} style={styles.icon} />
      </TouchableOpacity>

      {/* Campanita (alineada al menú) */}
      <View style={styles.bellWrapper}>
        <Bell />
      </View>

      {/* Panel inferior */}
      <View style={styles.panel}>
        <View style={styles.panelHeaderRow}>
          <View style={styles.vehicleBadge}>
            <Text style={styles.vehicleEmoji}>{vehicleEmoji}</Text>
          </View>

          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.panelText}>
              Hola {user?.name || 'driver'}, todo listo para tus viajes
            </Text>
          </View>

          <View style={styles.turboWrap}>
            <View style={[styles.turboDot, { backgroundColor: turboColor }]} />
            <Text style={[styles.turboLabel, { color: turboColor }]}>Turbo</Text>
            <Switch value={turboOn} onValueChange={toggleTurbo} disabled={saving} />
          </View>
        </View>

        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.sendButton}>
          <Text style={styles.sendButtonText}>Ver opciones</Text>
        </TouchableOpacity>
      </View>

      {/* Modal */}
    <Modal
  animationType="slide"
  transparent
  visible={modalVisible}
  onRequestClose={() => setModalVisible(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>

      <Text style={styles.modalTitle}>¿Qué querés hacer?</Text>

      {/* Ver mis viajes */}
      <TouchableOpacity
        style={styles.modalOption}
        onPress={handleOptionPress}
      >
        <Text style={styles.modalOptionText}>📋 Ver mis viajes</Text>
      </TouchableOpacity>

      {/* NUEVO — COLECTA */}
      <TouchableOpacity
        style={styles.modalOption}
        onPress={() => {
          setModalVisible(false);
          navigation.navigate("DriverScanScreen", { mode: "colecta" });
        }}
      >
        <Text style={styles.modalOptionText}>📦 Colectar envíos (retiro)</Text>
      </TouchableOpacity>

      {/* NUEVO — EN PLANTA */}
      <TouchableOpacity
        style={styles.modalOption}
        onPress={() => {
          setModalVisible(false);
          navigation.navigate("DriverScanScreen", { mode: "planta" });
        }}
      >
        <Text style={styles.modalOptionText}>🏭 Descargar en depósito</Text>
      </TouchableOpacity>

      {/* NUEVO — ASIGNARME */}
      <TouchableOpacity
        style={styles.modalOption}
        onPress={() => {
          setModalVisible(false);
          navigation.navigate("DriverScanScreen", { mode: "asignarme" });
        }}
      >
        <Text style={styles.modalOptionText}>✅ Asignarme envíos</Text>
      </TouchableOpacity>


      {/* Pendientes cerca */}
      <TouchableOpacity
        style={styles.modalOption}
        onPress={() => setModalVisible(false)}
        >
        <Text style={styles.modalOptionText}>📍 Ver pendientes cerca</Text>
      </TouchableOpacity>
        {/* Debug onboarding */}
        {__DEV__ && (
          <Pressable
            onPress={resetForCurrentUser}
            style={{
              marginTop: 12,
              backgroundColor: "black",
              padding: 12,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>
              Rehacer onboarding (test)
            </Text>
          </Pressable>
        )}

      {/* Cancelar */}
      <TouchableOpacity onPress={() => setModalVisible(false)}>
        <Text style={styles.modalCancel}>Cancelar</Text>
      </TouchableOpacity>

    </View>
  </View>
</Modal>

      {/* Sidebar */}
      {isSidebarOpen && (
        <View style={styles.sidebar}>
          <TouchableOpacity onPress={() => setIsSidebarOpen(false)} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.profile}>
            <Image source={require('../../../../../assets/user.png')} style={styles.avatar} />
            <Text style={styles.name}>{user?.name || 'Nombre del driver'}</Text>
            <Text style={styles.email}>{user?.email || 'correo@email.com'}</Text>
          </View>

          <TouchableOpacity onPress={() => navigateTo('DriverScreen')}>
            <Text style={styles.sidebarItem}>Perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalOption}
            onPress={() => {
              setModalVisible(false);
              navigation.navigate('EnviosScreen');
            }}
          >
            <Text style={styles.modalOptionText}>Viajes</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateTo('DriverScreen')}>
            <Text style={styles.sidebarItem}>Configuración</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateTo('DriverScreen')}>
            <Text style={styles.sidebarItem}>Medios de pago</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.sidebarItem}>Ayuda</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={removeSession}>
            <Text style={styles.logout}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const PANEL_PADDING = global.SPACING.lg;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: global.COLORS.background,
  },
  map: {
    flex: 1,
  },
  menuIcon: {
    position: 'absolute',
    top: global.SIZES.statusBarHeight + 10,
    left: 20,
    backgroundColor: global.COLORS.white,
    borderRadius: 25,
    padding: 10,
    elevation: 3,
    zIndex: 20,
  },
  bellWrapper: {
    position: 'absolute',
    top: global.SIZES.statusBarHeight + 10,
    right: 20,
    zIndex: 20,
  },
  icon: {
    width: 24,
    height: 24,
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: global.COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: PANEL_PADDING,
    elevation: 6,
  },
  panelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: global.SPACING.sm,
  },
  vehicleBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E6E6E6',
  },
  vehicleEmoji: { fontSize: 22 },
  panelText: {
    fontSize: global.FONT.size.md,
    color: global.COLORS.text,
    fontWeight: '700',
  },
  turboWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: global.COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E6E6E6',
  },
  turboDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  turboLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sendButton: {
    marginTop: global.SPACING.md,
    backgroundColor: '#EEE6FF',
    paddingVertical: global.SPACING.sm,
    paddingHorizontal: global.SPACING.xl,
    alignSelf: 'center',
    borderRadius: global.BORDER_RADIUS.md,
  },
  sendButtonText: {
    color: '#7A40F2',
    fontWeight: 'bold',
    fontSize: global.FONT.size.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: global.COLORS.white,
    padding: global.SPACING.lg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: global.FONT.size.lg,
    fontWeight: 'bold',
    marginBottom: global.SPACING.md,
  },
  modalOption: { paddingVertical: global.SPACING.md },
  modalOptionText: {
    fontSize: global.FONT.size.md,
    color: global.COLORS.text,
  },
  modalCancel: {
    fontSize: global.FONT.size.md,
    color: global.COLORS.blue,
    marginTop: global.SPACING.lg,
    textAlign: 'center',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 280,
    height: '100%',
    backgroundColor: global.COLORS.white,
    padding: global.SPACING.lg,
    elevation: 10,
    zIndex: 30,
  },
  closeButton: { alignSelf: 'flex-end' },
  closeText: { fontSize: 22, color: global.COLORS.text },
  profile: {
    alignItems: 'center',
    marginVertical: global.SPACING.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: global.COLORS.gray,
    marginBottom: global.SPACING.sm,
  },
  name: {
    fontSize: global.FONT.size.lg,
    fontWeight: 'bold',
    color: global.COLORS.text,
  },
  email: { fontSize: global.FONT.size.sm, color: global.COLORS.gray },
  sidebarItem: {
    fontSize: global.FONT.size.md,
    paddingVertical: global.SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: global.COLORS.background,
    color: global.COLORS.text,
  },
  logout: {
    fontSize: global.FONT.size.md,
    marginTop: global.SPACING.lg,
    color: global.COLORS.gray,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});

export default DriverScreen;
