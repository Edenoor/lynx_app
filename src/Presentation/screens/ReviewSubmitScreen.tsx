import React, { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
  ImageBackground,
  Platform,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { OnboardingStackParamList } from "../navigator/OnboardingStackNavigator";
import { useOnboarding } from "../onboarding/OnboardingContext";
import { RoundedButton } from "../components/RoundedButton";
import global from "../theme/global";

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

const DOCUMENT_GROUPS = [
  {
    key: "selfie",
    title: "Selfie",
    files: ["selfie"],
  },
  {
    key: "dni",
    title: "DNI",
    files: ["dni_front", "dni_back"],
  },
  {
    key: "registro",
    title: "Registro",
    files: ["registro_front", "registro_back"],
  },
  {
    key: "cedula",
    title: "Cédula",
    files: ["cedula_front", "cedula_back"],
  },
] as const;

type FileKey = (typeof ORDER)[number];

export function ReviewSubmitScreen({ navigation }: Props) {
  const { state } = useOnboarding();

  const missing = useMemo(() => {
    return ORDER.filter((key) => !state.files[key]);
  }, [state.files]);

  const canSubmit = state.acceptedTerms && missing.length === 0;

  const goFix = () => {
    if (!state.files.selfie) {
      navigation.replace("Selfie");
      return;
    }

    const firstMissing = missing[0];

    if (firstMissing) {
      navigation.replace("Doc", { docKey: firstMissing });
    }
  };

  const submit = () => {
    if (!canSubmit) {
      Alert.alert(
        "Onboarding incompleto",
        "Completá todos los documentos antes de enviar la solicitud."
      );
      return;
    }

    navigation.navigate("Submit");
  };

  return (
    <ImageBackground
      source={require("../../../assets/background-1.png")}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#05080E" />

        <View style={styles.screen}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.kicker}>TODO LISTO</Text>

              <Text style={styles.title}>Tu solicitud está lista</Text>

              <Text style={styles.subtitle}>
                Recibimos toda la documentación necesaria para procesar tu alta.
              </Text>
            </View>

            {canSubmit ? (
              <View style={styles.successBox}>
                <View style={styles.successIcon}>
                  <Text style={styles.successIconText}>✓</Text>
                </View>

                <View style={styles.successTextBlock}>
                  <Text style={styles.successTitle}>Todo listo</Text>
                  <Text style={styles.successText}>
                    Tu documentación está cargada y lista para validación.
                  </Text>
                </View>
              </View>
            ) : (
              <>
                {!state.acceptedTerms && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningTitle}>
                      Falta aceptar términos
                    </Text>
                    <Text style={styles.warningText}>
                      Volvé a la pantalla de términos para aceptar las
                      condiciones de uso.
                    </Text>
                  </View>
                )}

                {missing.length > 0 && (
                  <View style={styles.warningBox}>
                    <Text style={styles.warningTitle}>
                      Faltan {missing.length} documento
                      {missing.length > 1 ? "s" : ""}
                    </Text>

                    <Text style={styles.warningText}>
                      Completá los faltantes para poder enviar tu solicitud.
                    </Text>
                  </View>
                )}
              </>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Documentación recibida</Text>

              {DOCUMENT_GROUPS.map((group, index) => {
                const groupFiles = group.files as readonly FileKey[];
                const files = groupFiles
                  .map((key) => state.files[key])
                  .filter(Boolean);

                const isComplete = groupFiles.every((key) => state.files[key]);

                return (
                  <View
                    key={group.key}
                    style={[
                      styles.groupRow,
                      index !== DOCUMENT_GROUPS.length - 1 &&
                        styles.rowBorder,
                    ]}
                  >
                    <View
                      style={[
                        styles.groupStatusIcon,
                        isComplete
                          ? styles.groupStatusIconComplete
                          : styles.groupStatusIconMissing,
                      ]}
                    >
                      <Text
                        style={[
                          styles.groupStatusText,
                          isComplete
                            ? styles.groupStatusTextComplete
                            : styles.groupStatusTextMissing,
                        ]}
                      >
                        {isComplete ? "✓" : "!"}
                      </Text>
                    </View>

                    <View style={styles.groupText}>
                      <Text style={styles.groupTitle}>{group.title}</Text>
                      <Text
                        style={[
                          styles.groupSubtitle,
                          !isComplete && styles.groupSubtitleMissing,
                        ]}
                      >
                        {isComplete
                          ? "Documento cargado"
                          : "Documento pendiente"}
                      </Text>
                    </View>

                    <View style={styles.thumbs}>
                      {files.slice(0, 2).map((file, thumbIndex) => (
                        <Image
                          key={`${group.key}-${thumbIndex}`}
                          source={{ uri: file?.uri }}
                          style={[
                            styles.thumb,
                            thumbIndex > 0 && styles.thumbOverlap,
                          ]}
                        />
                      ))}

                      {!isComplete && (
                        <View style={styles.missingBadge}>
                          <Text style={styles.missingBadgeText}>Falta</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {missing.length > 0 && (
              <Pressable style={styles.secondaryButton} onPress={goFix}>
                <Text style={styles.secondaryButtonText}>
                  Completar faltantes
                </Text>
              </Pressable>
            )}

            <View style={!canSubmit && styles.disabledButton}>
              <RoundedButton
                text="Enviar solicitud"
                onPress={submit}
                disabled={!canSubmit}
              />
            </View>

            <Text style={styles.footerText}>
              Nuestro equipo revisará tu documentación para habilitar tu cuenta.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#05080E",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,8,14,0.42)",
  },
  safe: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },

  content: {
    paddingHorizontal: global.SPACING.md,
    paddingTop:
      Platform.OS === "android"
        ? (StatusBar.currentHeight ?? 24) + 28
        : 32,
    paddingBottom: 20,
    gap: 16,
  },

  header: {
    gap: 8,
    marginTop: 8,
  },
  kicker: {
    color: global.COLORS.blue,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -1,
  },
  subtitle: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    maxWidth: 330,
  },

  successBox: {
    borderRadius: 20,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.24)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  successIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.18)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.34)",
    alignItems: "center",
    justifyContent: "center",
  },
  successIconText: {
    color: "#22C55E",
    fontSize: 18,
    fontWeight: "900",
  },
  successTextBlock: {
    flex: 1,
    gap: 3,
  },
  successTitle: {
    color: "#DCFCE7",
    fontSize: 14,
    fontWeight: "900",
  },
  successText: {
    color: "#BBF7D0",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  warningBox: {
    borderRadius: 18,
    backgroundColor: "rgba(251,191,36,0.12)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
    padding: 14,
    gap: 4,
  },
  warningTitle: {
    color: "#FBBF24",
    fontSize: 14,
    fontWeight: "900",
  },
  warningText: {
    color: "#FDE68A",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  card: {
    borderRadius: 22,
    backgroundColor: "rgba(13,22,35,0.72)",
    borderWidth: 1,
    borderColor: "rgba(248,250,252,0.18)",
    overflow: "hidden",
  },
  cardTitle: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "900",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
  },

  groupRow: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(248,250,252,0.09)",
  },
  groupStatusIcon: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  groupStatusIconComplete: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderColor: "rgba(34,197,94,0.25)",
  },
  groupStatusIconMissing: {
    backgroundColor: "rgba(251,191,36,0.12)",
    borderColor: "rgba(251,191,36,0.25)",
  },
  groupStatusText: {
    fontSize: 14,
    fontWeight: "900",
  },
  groupStatusTextComplete: {
    color: "#22C55E",
  },
  groupStatusTextMissing: {
    color: "#FBBF24",
  },
  groupText: {
    flex: 1,
    gap: 3,
  },
  groupTitle: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "900",
  },
  groupSubtitle: {
    color: "#22C55E",
    fontSize: 12,
    fontWeight: "700",
  },
  groupSubtitleMissing: {
    color: "#FBBF24",
  },

  thumbs: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumb: {
    width: 42,
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(248,250,252,0.24)",
    backgroundColor: "#020617",
  },
  thumbOverlap: {
    marginLeft: -14,
  },
  missingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(251,191,36,0.12)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
  },
  missingBadgeText: {
    color: "#FBBF24",
    fontSize: 11,
    fontWeight: "900",
  },

  footer: {
    paddingHorizontal: global.SPACING.md,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 10,
    backgroundColor: "rgba(5,8,14,0.72)",
    borderTopWidth: 1,
    borderTopColor: "rgba(248,250,252,0.08)",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(248,250,252,0.16)",
    backgroundColor: "rgba(13,22,35,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.45,
  },
  footerText: {
    color: "#94A3B8",
    fontSize: 12,
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 17,
  },
});