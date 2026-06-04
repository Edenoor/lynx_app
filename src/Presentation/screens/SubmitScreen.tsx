import React, { useContext, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { UserContext } from "../context/UserContext";
import { useOnboarding } from "../onboarding/OnboardingContext";
import { uploadDriverDocuments } from "../onboarding/UploadDriverDocuments";

export function SubmitScreen() {
  const { state, dispatch, userKey } = useOnboarding();
  const { user } = useContext(UserContext);
  const [busy, setBusy] = useState(false);

  const driverId = String(user?.id || userKey || user?.username || "").trim();

  const submit = async () => {
    setBusy(true);

    try {
      const res = await uploadDriverDocuments({
        driverId,
        acceptedTerms: state.acceptedTerms,
        files: state.files,
        mode: "real",
      });

      if (!res.ok) throw new Error(res.error ?? "Upload failed");

      console.log("DRIVER DOCUMENTS UPLOADED:", res.documents);

      dispatch({ type: "SET_COMPLETED_LOCAL", value: true });

      Alert.alert(
        "Listo",
        "Documentación enviada correctamente a Firebase Storage."
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Enviando documentación…</Text>
      <Text style={styles.p}>
        La app subirá los documentos del conductor a Firebase Storage.
      </Text>

      {driverId ? (
        <Text style={styles.meta}>Driver ID: {driverId}</Text>
      ) : (
        <Text style={styles.error}>
          No se pudo identificar el driver autenticado.
        </Text>
      )}

      {busy ? (
        <ActivityIndicator />
      ) : (
        <Pressable
          style={[styles.btn, !driverId && styles.btnDisabled]}
          onPress={submit}
          disabled={!driverId}
        >
          <Text style={styles.btnText}>Enviar ahora</Text>
        </Pressable>
      )}

      <Pressable
        style={styles.btnSecondary}
        onPress={() => dispatch({ type: "RESET" })}
      >
        <Text style={styles.btnTextSecondary}>Reset onboarding</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 12, justifyContent: "center" },
  h1: { fontSize: 20, fontWeight: "800" },
  p: { fontSize: 14, opacity: 0.8 },
  meta: { fontSize: 13, opacity: 0.7 },
  error: { fontSize: 13, color: "#B00020", fontWeight: "700" },
  btn: {
    backgroundColor: "black",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.35,
  },
  btnText: { color: "white", fontWeight: "800" },
  btnSecondary: {
    borderWidth: 1,
    borderColor: "black",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnTextSecondary: { color: "black", fontWeight: "800" },
});
