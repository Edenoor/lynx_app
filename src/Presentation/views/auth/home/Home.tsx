// src/Presentation/views/auth/home/Home.tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  ToastAndroid,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
} from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../../../navigator/MainStackNavigator';
import useViewModel from './ViewModel';
import { CustomTextInput } from '../../../components/CustomTextInput';
import { RoundedButton } from '../../../components/RoundedButton';
import global from '../../../theme/global';

type Props = StackScreenProps<RootStackParamList, 'HomeScreen'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { values, onChange, login, errorMessage, clearError } = useViewModel();

  useEffect(() => {
    if (errorMessage) {
      ToastAndroid.show(errorMessage, ToastAndroid.LONG);
      clearError();
    }
  }, [errorMessage]);

  const onPressLogin = async () => {
    const res = await login();
    if (!res.ok) return;

    if (res.rol === 'DRIVER') {
      navigation.reset({ index: 0, routes: [{ name: 'DriverStackNavigator' }] });
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'SellerStackNavigator' }] });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require('../../../../../assets/icon.png')}
          style={styles.logo}
        />
        <Text style={styles.title}>Bienvenido</Text>
        <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
      </View>

      <View style={styles.form}>
        <CustomTextInput
          image={require('../../../../../assets/user.png')}
          placeholder="Usuario"
          value={values.username}
          keyboardType="default"
          property="username"
          onChangeText={onChange}
        />
        <CustomTextInput
          image={require('../../../../../assets/password.png')}
          placeholder="Contraseña"
          value={values.password}
          keyboardType="default"
          secureTextEntry
          property="password"
          onChangeText={onChange}
        />

        <RoundedButton text="Ingresar" onPress={onPressLogin} />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => navigation.navigate('RecuperarScreen')}>
          <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('RegisterScreen')}>
          <Text style={styles.link}>Crear cuenta</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: global.COLORS.background, padding: global.SPACING.lg, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: global.SPACING.xl },
  logo: { width: 72, height: 72, marginBottom: global.SPACING.md },
  title: { fontSize: global.SIZES.h1, color: global.COLORS.text, fontWeight: '600' },
  subtitle: { fontSize: global.FONT.size.md, color: global.COLORS.gray, marginTop: 4 },
  form: { gap: 16 },
  footer: { marginTop: global.SPACING.xl, alignItems: 'center', gap: 8 },
  link: { color: global.COLORS.blue, fontSize: global.FONT.size.md },
});
