import React, { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import useViewModel from './ViewModel';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigator/DriverStackNavigator';

type Props = StackScreenProps<RootStackParamList, 'DriverScreen'>;

export const DriverScreen: React.FC<Props> = ({ navigation }) => {
  const { user, removeUserSession } = useViewModel();

  useEffect(() => {
    if (user && user.rol !== 'DRIVER') {
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: 'HomeScreen' as never }],
      });
    }
  }, [user]);

  return (
    <View style={{ flex: 1, paddingTop: 60 }}>
      <Text>Driver</Text>

      <View style={{ marginTop: 100 }}>
        <TouchableOpacity onPress={removeUserSession}>
          <Text>Remover sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

