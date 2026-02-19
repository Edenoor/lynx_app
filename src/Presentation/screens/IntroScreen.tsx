import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardingStackParamList } from "../navigator/OnboardingStackNavigator";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Intro">;

export function IntroScreen({ navigation }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Bienvenido a Lynx Driver</Text>
      <Text style={styles.p}>
        Antes de empezar necesitamos validar tu identidad y documentación para habilitarte viajes.
      </Text>

      <View style={styles.card}>
        <Text style={styles.li}>• Selfie</Text>
        <Text style={styles.li}>• DNI (frente/dorso)</Text>
        <Text style={styles.li}>• Registro (frente/dorso)</Text>
        <Text style={styles.li}>• Cédula (frente/dorso)</Text>
      </View>

      <Pressable style={styles.btn} onPress={() => navigation.navigate("Terms")}>
        <Text style={styles.btnText}>Continuar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 14, justifyContent: "center" },
  h1: { fontSize: 22, fontWeight: "800" },
  p: { fontSize: 14, opacity: 0.8 },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, opacity: 0.9, gap: 6 },
  li: { fontSize: 14 },
  btn: { backgroundColor: "black", padding: 14, borderRadius: 12, alignItems: "center", marginTop: 10 },
  btnText: { color: "white", fontWeight: "800" },
});
