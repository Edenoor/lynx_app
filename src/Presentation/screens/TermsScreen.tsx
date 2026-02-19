import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardingStackParamList } from "../navigator/OnboardingStackNavigator";
import { useOnboarding } from "../onboarding/OnboardingContext";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Terms">;

export function TermsScreen({ navigation }: Props) {
  const { dispatch } = useOnboarding();

  const accept = () => {
    dispatch({ type: "ACCEPT_TERMS", value: true });
    navigation.navigate("Selfie");
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.h1}>Términos y condiciones</Text>
        <Text style={styles.p}>
          (Placeholder) Aquí van los términos. Por ahora el objetivo es que el front guarde la aceptación
          y deje continuar.
        </Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.btn} onPress={accept}>
          <Text style={styles.btnText}>Acepto y continúo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 12 },
  h1: { fontSize: 20, fontWeight: "800" },
  p: { fontSize: 14, opacity: 0.8, lineHeight: 20 },
  footer: { padding: 20, borderTopWidth: 1, opacity: 0.9 },
  btn: { backgroundColor: "black", padding: 14, borderRadius: 12, alignItems: "center" },
  btnText: { color: "white", fontWeight: "800" },
});
