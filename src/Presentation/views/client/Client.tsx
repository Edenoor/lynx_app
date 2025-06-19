import React, { useEffect, useState }  from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useUserLocal } from '../../hooks/useUserLocal';
import useViewModel from './ViewModel';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigator/SellerStackNavigator';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { RecuperarScreen } from '../recuperar/Recuperar';
interface Props extends StackScreenProps<RootStackParamList, 'ClientScreen'>{};

export const ClientScreen = ({navigation, route}: Props) => {
  const { user, removeUserSession } = useViewModel();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const removeSession = () => {
    removeUserSession()
    navigation.replace('HomeScreen')
  }

  const navigateTo = (screenName: keyof RootStackParamList) => {
    navigation.navigate(screenName);
    setIsSidebarOpen(false);
  };

  return (
    <View style={styles.container}>
      {isSidebarOpen && (
        <View style={styles.sidebar}>
          <TouchableOpacity onPress={() => navigateTo('ClientScreen')}>
            <Text style={styles.sidebarItem}>Client Screen</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigateTo('RecuperarScreen')}>
            <Text style={styles.sidebarItem}>RECUPERAR</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Main Content */}
      <View style={styles.content}>
        <TouchableOpacity onPress={() => setIsSidebarOpen(!isSidebarOpen)}>
          <Text>Menu</Text>
        </TouchableOpacity>
        <Text>TEXTO</Text>
        <TouchableOpacity onPress={() => removeSession()}>
          <Text>CERRAR SESION</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 250,
    backgroundColor: '#f8f8f8',
    padding: 20,
  },
  sidebarItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  content: {
    flex: 1,
    padding: 20,
    top:100
  },
});