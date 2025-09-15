import React, { useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import useViewModel from './ViewModel';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigator/MainStackNavigator';

type Props = StackScreenProps<RootStackParamList>;

export const AdminScreen: React.FC<Props> = ({ navigation }) => {
  const { user, removeUserSession } = useViewModel();

  useEffect(() => {
    if (user?.rol !== 'ADMIN') {
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: 'HomeScreen' as never }],
      });
    }
  }, [user]);

  return (
    <View style={{ top: 60 }}>
      <Text>Admin</Text>
      <View style={{ top: 100 }}>
        <TouchableOpacity onPress={removeUserSession}>
          <Text>remover sesion</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
