import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Modal,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import useViewModel from './ViewModel';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigator/SellerStackNavigator';

import global from '../../../theme/global';

interface Props extends StackScreenProps<RootStackParamList, 'ClientScreen'> {}

export const ClientScreen = ({ navigation }: Props) => {
  const { user, removeUserSession } = useViewModel();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const removeSession = async () => {
    await removeUserSession();
    // Volvemos al stack padre donde existe HomeScreen
    navigation.getParent()?.reset({
      index: 0,
      routes: [{ name: 'HomeScreen' as never }],
    });
  };

  const navigateTo = (screenName: keyof RootStackParamList) => {
    navigation.navigate(screenName);
    setIsSidebarOpen(false);
  };

  const handleOptionPress = (type: 'EnvioTradicionalScreen' | 'EnvioTurboScreen') => {
    setModalVisible(false);
    navigation.navigate(type);
  };

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

      {/* Mensaje flotante y botón */}
      <View style={styles.panel}>
        <Image source={require('../../../../../assets/logo_envio.png')} style={styles.panelIcon} />
        <Text style={styles.panelText}>Hola {user?.name || 'usuario'}, todo listo para tu envío</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.sendButton}>
          <Text style={styles.sendButtonText}>Solicitar envío</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de selección */}
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>¿Qué tipo de envío querés hacer?</Text>
            <TouchableOpacity style={styles.modalOption} onPress={() => handleOptionPress('EnvioTradicionalScreen')}>
              <Text style={styles.modalOptionText}>🚚 Envío tradicional</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} onPress={() => handleOptionPress('EnvioTurboScreen')}>
              <Text style={styles.modalOptionText}>⚡ Envío Turbo</Text>
            </TouchableOpacity>
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
            <Text style={styles.name}>{user?.name || 'Nombre del usuario'}</Text>
            <Text style={styles.email}>{user?.email || 'correo@email.com'}</Text>
          </View>

          <TouchableOpacity onPress={() => navigateTo('ClientScreen')}>
            <Text style={styles.sidebarItem}>Perfil</Text>
          </TouchableOpacity>
          {/* Viajes ahora va a EnviosScreen */}
          <TouchableOpacity onPress={() => navigateTo('EnviosScreen')}>
            <Text style={styles.sidebarItem}>Viajes</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateTo('TiendasScreen')}>
            <Text style={styles.sidebarItem}>Tiendas</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigateTo('ClientScreen')}>
            <Text style={styles.sidebarItem}>Configuración</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateTo('ClientScreen')}>
            <Text style={styles.sidebarItem}>Medios de pago</Text>
          </TouchableOpacity>
          {/* Esta ruta vive en el stack padre; navegamos por el padre */}
          <TouchableOpacity
            onPress={() => {
              setIsSidebarOpen(false);
              navigation.getParent()?.navigate('RecuperarScreen' as never);
            }}
          >
            <Text style={styles.sidebarItem}>Códigos descuento</Text>
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
    padding: global.SPACING.lg,
    alignItems: 'center',
    elevation: 6,
  },
  panelIcon: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    marginBottom: global.SPACING.sm,
  },
  panelText: {
    fontSize: global.FONT.size.md,
    color: global.COLORS.text,
    textAlign: 'center',
    marginBottom: global.SPACING.sm,
  },
  sendButton: {
    backgroundColor: '#EEE6FF',
    paddingVertical: global.SPACING.sm,
    paddingHorizontal: global.SPACING.xl,
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
  modalOption: {
    paddingVertical: global.SPACING.md,
  },
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
    zIndex: 10,
  },
  closeButton: {
    alignSelf: 'flex-end',
  },
  closeText: {
    fontSize: 22,
    color: global.COLORS.text,
  },
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
  email: {
    fontSize: global.FONT.size.sm,
    color: global.COLORS.gray,
  },
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
