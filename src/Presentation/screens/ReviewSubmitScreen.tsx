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
import { useThemedStyles } from "../theme/ThemeContext";
import type { Theme } from "../theme/createTheme";
import { ThemedStatusBar } from "../theme/ThemedStatusBar";

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
  const styles = useThemedStyles(makeStyles);
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
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.overlay} />

      <SafeAreaView style={styles.safe}>
        <ThemedStatusBar />

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

const makeStyles = (t: Theme) => StyleSheet.create({
  // Imagen de fondo como en las pantallas del chofer: tenue y solo en Classic.
  backgroundImage: {
    opacity: t.backdrop.imageOpacity,
  },
  background: {
    flex: 1,
    backgroundColor: t.surfaces.screen,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: t.overlays.background,
  },
  safe: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },

  content: {
    paddingHorizontal: t.spacing.md,
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
    color: t.text.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },
  title: {
    color: t.text.primary,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -1,
  },
  subtitle: {
    color: t.text.secondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    maxWidth: 330,
  },

  successBox: {
    borderRadius: 20,
    backgroundColor: t.status.confirmed.background,
    borderWidth: 1,
    borderColor: t.status.confirmed.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  successIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: t.status.confirmed.background,
    borderWidth: 1,
    borderColor: t.status.confirmed.border,
    alignItems: "center",
    justifyContent: "center",
  },
  successIconText: {
    color: t.status.confirmed.text,
    fontSize: 18,
    fontWeight: "900",
  },
  successTextBlock: {
    flex: 1,
    gap: 3,
  },
  successTitle: {
    color: t.status.confirmed.text,
    fontSize: 14,
    fontWeight: "900",
  },
  successText: {
    color: t.status.confirmed.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  warningBox: {
    borderRadius: 18,
    backgroundColor: t.status.pending.background,
    borderWidth: 1,
    borderColor: t.status.pending.border,
    padding: 14,
    gap: 4,
  },
  warningTitle: {
    color: t.status.pending.text,
    fontSize: 14,
    fontWeight: "900",
  },
  warningText: {
    color: t.status.pending.text,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  card: {
    borderRadius: 22,
    backgroundColor: t.surfaces.cardStrong,
    borderWidth: 1,
    borderColor: t.borders.strong,
    overflow: "hidden",
  },
  cardTitle: {
    color: t.text.primary,
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
    borderBottomColor: t.borders.muted,
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
    backgroundColor: t.status.confirmed.background,
    borderColor: t.status.confirmed.border,
  },
  groupStatusIconMissing: {
    backgroundColor: t.status.pending.background,
    borderColor: t.status.pending.border,
  },
  groupStatusText: {
    fontSize: 14,
    fontWeight: "900",
  },
  groupStatusTextComplete: {
    color: t.status.confirmed.text,
  },
  groupStatusTextMissing: {
    color: t.status.pending.text,
  },
  groupText: {
    flex: 1,
    gap: 3,
  },
  groupTitle: {
    color: t.text.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  groupSubtitle: {
    color: t.status.confirmed.text,
    fontSize: 12,
    fontWeight: "700",
  },
  groupSubtitleMissing: {
    color: t.status.pending.text,
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
    borderColor: t.borders.strong,
    backgroundColor: t.surfaces.screenDeep,
  },
  thumbOverlap: {
    marginLeft: -14,
  },
  missingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: t.status.pending.background,
    borderWidth: 1,
    borderColor: t.status.pending.border,
  },
  missingBadgeText: {
    color: t.status.pending.text,
    fontSize: 11,
    fontWeight: "900",
  },

  footer: {
    paddingHorizontal: t.spacing.md,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 10,
    backgroundColor: t.surfaces.footer,
    borderTopWidth: 1,
    borderTopColor: t.borders.muted,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.borders.default,
    backgroundColor: t.surfaces.cardStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: t.text.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.45,
  },
  footerText: {
    color: t.text.muted,
    fontSize: 12,
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 17,
  },
});