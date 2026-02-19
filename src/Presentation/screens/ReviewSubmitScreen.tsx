import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Image, ScrollView, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardingStackParamList } from "../navigator/OnboardingStackNavigator";
import { useOnboarding } from "../onboarding/OnboardingContext";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Review">;

const ORDER = [
  "selfie",
  "dni_front",
  "dni_back",
  "registro_front",
  "registro_back",
  "cedula_front",
  "cedula_back",
] as const;

export function ReviewSubmitScreen({ navigation }: Props) {
  const { state } = useOnboarding();

  const missing = useMemo(() => {
    return ORDER.filter((k) => !state.files[k]);
  }, [state.files]);

  const canSubmit = state.acceptedTerms && missing.length === 0;

  const goFix = () => {
    if (!state.files.selfie) return navigation.replace("Selfie");
    const firstMissing = missing[0];
    if (firstMissing) navigation.replace("Doc", { docKey: firstMissing as any });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.h1}>Revisá antes de enviar</Text>

        {!state.acceptedTerms && (
          <Text style={styles.warn}>⚠️ Falta aceptar términos y condiciones.</Text>
        )}

        {missing.length > 0 && (
          <Text style={styles.warn}>⚠️ Faltan: {missing.join(", ")}</Text>
        )}

        {ORDER.map((k) => {
          const f = state.files[k];
          return (
            <View key={k} style={styles.row}>
              <Text style={styles.key}>{k}</Text>
              {f ? (
                <Image source={{ uri: f.uri }} style={styles.thumb} />
              ) : (
                <Text style={styles.missing}>Falta</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        {missing.length > 0 && (
          <Pressable style={styles.btnSecondary} onPress={goFix}>
            <Text style={styles.btnTextSecondary}>Completar faltantes</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.btn, !canSubmit && { opacity: 0.5 }]}
          onPress={() => {
            if (!canSubmit) return Alert.alert("Onboarding incompleto", "Completá todo antes de enviar.");
            navigation.navigate("Submit");
          }}
        >
          <Text style={styles.btnText}>Enviar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 10 },
  h1: { fontSize: 20, fontWeight: "800" },
  warn: { fontSize: 13, opacity: 0.8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, opacity: 0.9 },
  key: { fontSize: 13, fontWeight: "700" },
  thumb: { width: 60, height: 90, borderRadius: 10, borderWidth: 1 },
  missing: { fontSize: 13, opacity: 0.7 },
  footer: { padding: 20, gap: 10, borderTopWidth: 1, opacity: 0.9 },
  btn: { backgroundColor: "black", padding: 14, borderRadius: 12, alignItems: "center" },
  btnText: { color: "white", fontWeight: "800" },
  btnSecondary: { borderWidth: 1, borderColor: "black", padding: 14, borderRadius: 12, alignItems: "center" },
  btnTextSecondary: { color: "black", fontWeight: "800" },
});
