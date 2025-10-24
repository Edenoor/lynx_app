// src/Presentation/components/Bell.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import global from '../../Presentation/theme/global';

type Props = { onPress?: () => void };

const Bell: React.FC<Props> = ({ onPress }) => {
  const { unreadCount } = useNotifications();
  const nav = useNavigation<any>();

  const handlePress = () => {
    if (onPress) return onPress();
    nav.navigate('NotificationsScreen');
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.wrap} activeOpacity={0.8}>
      <Ionicons
        name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
        size={24}
        color="#111827"
      />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: global.COLORS.white,
    borderRadius: 25,
    padding: 10,
    elevation: 3,
  },
  badge: {
    position: 'absolute',
    right: 4,
    bottom: 4, // numerito pegado abajo a la derecha del ícono
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeTxt: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default Bell;
