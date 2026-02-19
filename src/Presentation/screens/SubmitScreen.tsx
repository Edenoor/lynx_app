import React, { useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Alert } from "react-native";
import { useOnboarding } from "../onboarding/OnboardingContext";
import { uploadDriverDocuments } from "../onboarding/UploadDriverDocuments";

export function SubmitScreen() {
  const { state, dispatch } = useOnboarding();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      // driverId: por ahora placeholder (luego lo tomás del user/auth)
      const res = await uploadDriverDocuments({
        driverId: "mock-driver-id",
        acceptedTerms: state.acceptedTerms,
        files: state.files,
        mode: "mock", // <- cuando exista backend: "real"
      });

      if (!res.ok) throw new Error(res.error ?? "Upload failed");
      dispatch({ type: "SET_COMPLETED_LOCAL", value: true });

      Alert.alert("Listo", "Documentación enviada (mock).");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Enviando documentación…</Text>
      <Text style={styles.p}>Por ahora es mock. Cuando exista el endpoint, cambiamos a modo real.</Text>

      {busy ? (
        <ActivityIndicator />
      ) : (
        <Pressable style={styles.btn} onPress={submit}>
          <Text style={styles.btnText}>Enviar ahora</Text>
        </Pressable>
      )}

      <Pressable style={styles.btnSecondary} onPress={() => dispatch({ type: "RESET" })}>
        <Text style={styles.btnTextSecondary}>Reset onboarding</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 12, justifyContent: "center" },
  h1: { fontSize: 20, fontWeight: "800" },
  p: { fontSize: 14, opacity: 0.8 },
  btn: { backgroundColor: "black", padding: 14, borderRadius: 12, alignItems: "center" },
  btnText: { color: "white", fontWeight: "800" },
  btnSecondary: { borderWidth: 1, borderColor: "black", padding: 14, borderRadius: 12, alignItems: "center" },
  btnTextSecondary: { color: "black", fontWeight: "800" },
});
