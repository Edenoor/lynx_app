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

interface Props extends StackScreenProps<RootStackParamList, 'HomeScreen'> {}

export const HomeScreen = ({ navigation }: Props) => {
  const {
    email,
    password,
    errorMessage,
    onChange,
    login,
    user,
    removeUserSession,
  } = useViewModel();

  removeUserSession()
  useEffect(() => {
    if (errorMessage !== '') {
      ToastAndroid.show(errorMessage, ToastAndroid.LONG);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (user?.id) {
      if (user.rol === 'SELLER') navigation.replace('SellerStackNavigator');
      else if (user.rol === 'DRIVER') navigation.replace('DriverStackNavigator');
    }
  }, [user]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Image
          source={require('../../../../../assets/logo.png')}
          style={styles.logo}
        />
        <Text style={styles.title}>Lynx</Text>
      </View>

      <View style={styles.form}>
        <CustomTextInput
          image={require('../../../../../assets/email.png')}
          placeholder="Correo electrónico"
          keyboardType="email-address"
          property="email"
          onChangeText={onChange}
          value={email}
        />

        <CustomTextInput
          image={require('../../../../../assets/password.png')}
          placeholder="Contraseña"
          keyboardType="default"
          property="password"
          onChangeText={onChange}
          value={password}
          secureTextEntry={true}
        />

        <View style={styles.buttonWrapper}>
          <RoundedButton
            text="Entrar"
            onPress={login}
            backgroundColor={global.COLORS.blue}
          />
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('RegisterScreen')}>
          <Text style={styles.link}>Registrate</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('RecuperarScreen')}>
          <Text style={styles.link}>Recuperar contraseña</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={removeUserSession}>
        <Text style={styles.devLink}>Remover sesión</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© Lynx 2025</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: global.COLORS.background,
    paddingHorizontal: global.SPACING.lg,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: global.SPACING.xxxl, // ← Ajustado
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: global.SPACING.sm,
    resizeMode: 'contain',
  },
  title: {
    fontSize: global.FONT.size.xl,
    fontWeight: 'bold',
    color: global.COLORS.text,
  },
  form: {
    gap: global.SPACING.md,
    alignItems: 'center',
  },
  buttonWrapper: {
    marginTop: global.SPACING.md,
    width: '100%',
  },
  link: {
    color: global.COLORS.blue,
    fontSize: global.FONT.size.md,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginTop: global.SPACING.sm,
  },
  devLink: {
    color: global.COLORS.gray,
    fontSize: global.FONT.size.sm,
    textAlign: 'center',
    marginVertical: global.SPACING.lg,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: global.SPACING.md,
  },
  footerText: {
    color: global.COLORS.gray,
    fontSize: global.FONT.size.sm,
  },
});

