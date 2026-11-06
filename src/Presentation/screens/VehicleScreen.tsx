import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TextInput,
  SafeAreaView,
  StatusBar,
  ImageBackground,
  Pressable,
  Platform,
} from "react-native";
import { useOnboarding } from "../onboarding/OnboardingContext";
import {
  aMano,
  BUSCADOR_DESDE,
  filtrar,
  limpiarTexto,
  marcasDe,
  MAX_MARCA,
  MAX_MODELO,
  modelosDe,
  vehiculoCompleto,
} from "../onboarding/vehicleOptions";
import type { VehicleType } from "../onboarding/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "../navigator/OnboardingStackNavigator";
import { RoundedButton } from "../components/RoundedButton";
import { SelectableCard } from "../components/SelectableCard";
import { KeyboardScreen } from "../components/KeyboardScreen";
import { useAppTheme, useThemedStyles } from "../theme/ThemeContext";
import type { Theme } from "../theme/createTheme";
import { ThemedStatusBar } from "../theme/ThemedStatusBar";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Vehicle">;

const VEHICLE_TYPES: { label: string; value: VehicleType }[] = [
  { label: "Moto", value: "moto" },
  { label: "Auto", value: "auto" },
  { label: "Utilitario", value: "utilitario" },
  { label: "Furgón", value: "furgon" },
];

export function VehicleScreen({ navigation }: Props) {
  const theme = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { state, dispatch } = useOnboarding();

  const [type, setType] = useState<VehicleType | "">(
    (state.vehicle.type ?? "") as VehicleType | ""
  );
  const [brand, setBrand] = useState<string>(state.vehicle.brand ?? "");
  const [model, setModel] = useState<string>(state.vehicle.model ?? "");
  const [plate, setPlate] = useState<string>(state.vehicle.plate ?? "");
const [dni, setDni] = useState<string>(state.vehicle.dni ?? "");
const [cuil, setCuil] = useState<string>(state.vehicle.cuil ?? "");
  // «Otra marca» / «Otro modelo»: escritos a mano. Al volver con lo ya cargado,
  // lo que no está en el catálogo se muestra así.
  const [inicioAMano] = useState(() =>
    aMano(state.vehicle.type ?? "", state.vehicle.brand ?? null, state.vehicle.model ?? null)
  );
  const [brandOtra, setBrandOtra] = useState<boolean>(inicioAMano.marca);
  const [modelOtro, setModelOtro] = useState<boolean>(inicioAMano.modelo);
  const [buscarMarca, setBuscarMarca] = useState<string>("");
  const [buscarModelo, setBuscarModelo] = useState<string>("");

  const selectedVehicleLabel =
    VEHICLE_TYPES.find((item) => item.value === type)?.label ?? "";

  const brands = useMemo(() => marcasDe(type), [type]);

  const models = useMemo(
    () => (brandOtra ? [] : modelosDe(type, brand)),
    [type, brand, brandOtra]
  );

  const brandsVisibles = useMemo(() => filtrar(brands, buscarMarca), [brands, buscarMarca]);
  const modelsVisibles = useMemo(() => filtrar(models, buscarModelo), [models, buscarModelo]);

const canContinue = Boolean(
  type &&
    vehiculoCompleto(brand, model) &&
    plate.trim().length >= 5 &&
    dni.trim().length >= 7 &&
    cuil.trim().length >= 10
);

  const onChangeType = (value: VehicleType) => {
    setType(value);
    resetBrand();
  };

  const onChangeBrand = (value: string) => {
    setBrand(value);
    setModel("");
    setModelOtro(false);
    setBuscarModelo("");
  };

  const resetType = () => {
    setType("");
    resetBrand();
  };

  const resetBrand = () => {
    setBrand("");
    setModel("");
    setBrandOtra(false);
    setModelOtro(false);
    setBuscarMarca("");
    setBuscarModelo("");
  };

  // Una marca escrita a mano no tiene modelos en la lista: el modelo también.
  const onOtraMarca = () => {
    resetBrand();
    setBrandOtra(true);
    setModelOtro(true);
  };

  const resetModel = () => {
    setModel("");
    setModelOtro(brandOtra);
    setBuscarModelo("");
  };

  const onOtroModelo = () => {
    setModel("");
    setModelOtro(true);
  };

  const onContinue = () => {
    if (!canContinue) {
      Alert.alert(
        "Falta información",
        "Elegí tipo, marca, modelo y completá la patente para continuar."
      );
      return;
    }

dispatch({
  type: "SET_VEHICLE",
  value: {
    type: type as VehicleType,
    brand: limpiarTexto(brand, MAX_MARCA),
    model: limpiarTexto(model, MAX_MODELO),
    plate: plate.trim().toUpperCase(),
    dni: dni.trim(),
    cuil: cuil.trim(),
  },
});

    navigation.navigate("Home");
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

        {/* Patente, DNI y CUIL quedan abajo: con el teclado abierto la pantalla
            se desplaza y «Continuar» sigue a la vista (ver KeyboardScreen). */}
        <KeyboardScreen
          contentContainerStyle={styles.content}
          scrollProps={{ showsVerticalScrollIndicator: false }}
          footer={
            <View style={styles.footer}>
              <View style={!canContinue && styles.disabledButton}>
                <RoundedButton
                  text="Continuar"
                  onPress={onContinue}
                  disabled={!canContinue}
                />
              </View>
            </View>
          }
        >
            <View style={styles.header}>
              <Text style={styles.kicker}>VEHÍCULO</Text>
              <Text style={styles.title}>Registrá tu vehículo</Text>
              <Text style={styles.subtitle}>
                Estos datos nos ayudan a asignarte viajes compatibles.
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.section}>
                <Text style={styles.label}>Tipo</Text>

                {type ? (
                  <SelectedValueCard
                    value={selectedVehicleLabel}
                    onChange={resetType}
                  />
                ) : (
                  <View style={styles.optionsGrid}>
{VEHICLE_TYPES.map((item) => (
  <View key={item.value} style={styles.gridItem}>
    <SelectableCard
      title={item.label}
      onPress={() => onChangeType(item.value)}
    />
  </View>
))}
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Marca</Text>

                {!type ? (
                  <Text style={styles.emptyText}>
                    Primero seleccioná el tipo.
                  </Text>
                ) : brandOtra ? (
                  <View style={styles.optionsList}>
                    <TextInput
                      value={brand}
                      onChangeText={setBrand}
                      placeholder="Escribí la marca"
                      placeholderTextColor={theme.colors.placeholder}
                      autoCapitalize="words"
                      autoCorrect={false}
                      maxLength={MAX_MARCA}
                      style={styles.input}
                    />
                    <Pressable onPress={resetBrand} hitSlop={10}>
                      <Text style={styles.changeText}>Elegir de la lista</Text>
                    </Pressable>
                  </View>
                ) : brand ? (
                  <SelectedValueCard value={brand} onChange={resetBrand} />
                ) : (
                  <View style={styles.optionsList}>
                    {brands.length > BUSCADOR_DESDE ? (
                      <TextInput
                        value={buscarMarca}
                        onChangeText={setBuscarMarca}
                        placeholder="Buscar marca"
                        placeholderTextColor={theme.colors.placeholder}
                        autoCorrect={false}
                        style={styles.searchInput}
                      />
                    ) : null}
                    {brandsVisibles.map((item) => (
                      <SelectableCard
                        key={item}
                        title={item}
                        selected={brand === item}
                        onPress={() => onChangeBrand(item)}
                      />
                    ))}
                    {brandsVisibles.length === 0 ? (
                      <Text style={styles.emptyText}>
                        No está en la lista: elegí «Otra marca».
                      </Text>
                    ) : null}
                    <SelectableCard title="Otra marca" onPress={onOtraMarca} />
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Modelo</Text>

                {!(type && (brand || brandOtra)) ? (
                  <Text style={styles.emptyText}>
                    Primero seleccioná una marca.
                  </Text>
                ) : modelOtro ? (
                  <View style={styles.optionsList}>
                    <TextInput
                      value={model}
                      onChangeText={setModel}
                      placeholder="Escribí el modelo"
                      placeholderTextColor={theme.colors.placeholder}
                      autoCapitalize="words"
                      autoCorrect={false}
                      maxLength={MAX_MODELO}
                      style={styles.input}
                    />
                    {!brandOtra ? (
                      <Pressable onPress={resetModel} hitSlop={10}>
                        <Text style={styles.changeText}>Elegir de la lista</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : model ? (
                  <SelectedValueCard value={model} onChange={resetModel} />
                ) : (
                  <View style={styles.optionsList}>
                    {models.length > BUSCADOR_DESDE ? (
                      <TextInput
                        value={buscarModelo}
                        onChangeText={setBuscarModelo}
                        placeholder="Buscar modelo"
                        placeholderTextColor={theme.colors.placeholder}
                        autoCorrect={false}
                        style={styles.searchInput}
                      />
                    ) : null}
                    {modelsVisibles.map((item) => (
                      <SelectableCard
                        key={item}
                        title={item}
                        selected={model === item}
                        onPress={() => setModel(item)}
                      />
                    ))}
                    {modelsVisibles.length === 0 ? (
                      <Text style={styles.emptyText}>
                        No está en la lista: elegí «Otro modelo».
                      </Text>
                    ) : null}
                    <SelectableCard title="Otro modelo" onPress={onOtroModelo} />
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.label}>Patente</Text>

                <TextInput
                  value={plate}
                  onChangeText={(text) => setPlate(text.toUpperCase())}
                  placeholder="Ej: AA123BB"
                  placeholderTextColor={theme.colors.placeholder}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>
            </View>
            <View style={styles.section}>
  <Text style={styles.label}>DNI</Text>

  <TextInput
    value={dni}
    onChangeText={(text) => setDni(text.replace(/\D/g, ""))}
    placeholder="Ej: 30123456"
    placeholderTextColor={theme.colors.placeholder}
    keyboardType="number-pad"
    style={styles.input}
  />
</View>

<View style={styles.section}>
  <Text style={styles.label}>CUIL</Text>

  <TextInput
    value={cuil}
    onChangeText={(text) => setCuil(text.replace(/\D/g, ""))}
    placeholder="Ej: 20301234567"
    placeholderTextColor={theme.colors.placeholder}
    keyboardType="number-pad"
    style={styles.input}
  />
</View>
        </KeyboardScreen>
      </SafeAreaView>
    </ImageBackground>
  );
}

type SelectedValueCardProps = {
  value: string;
  onChange: () => void;
};

function SelectedValueCard({ value, onChange }: SelectedValueCardProps) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.selectedCard}>
      <View style={styles.selectedDot} />

      <Text style={styles.selectedText}>{value}</Text>

      <Pressable onPress={onChange} hitSlop={10}>
        <Text style={styles.changeText}>Cambiar</Text>
      </Pressable>
    </View>
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
content: {
  paddingHorizontal: t.spacing.md,
  paddingTop:
    Platform.OS === "android"
      ? (StatusBar.currentHeight ?? 24) + 28
      : 32,
  paddingBottom: 18,
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
  fontSize: 24,
  lineHeight: 28,
  fontWeight: "900",
  letterSpacing: -1,
},
  subtitle: {
    color: t.text.secondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    maxWidth: 320,
  },

  card: {
    borderRadius: 22,
    backgroundColor: t.surfaces.cardStrong,
    borderWidth: 1,
    borderColor: t.borders.strong,
    padding: 14,
    gap: 14,
  },
  section: {
    gap: 8,
  },
  label: {
    color: t.text.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  optionsList: {
    gap: 8,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gridItem: {
    width: "48.5%",
  },
  emptyText: {
    color: t.text.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    paddingVertical: 4,
  },

  selectedCard: {
    minHeight: 46,
    borderRadius: t.radius.md,
    paddingHorizontal: t.spacing.md,
    paddingVertical: 8,
    backgroundColor: t.status.inTransit.background,
    borderWidth: 1,
    borderColor: t.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selectedDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: t.colors.primary,
  },
  selectedText: {
    flex: 1,
    color: t.text.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  changeText: {
    color: t.text.accent,
    fontSize: 12,
    fontWeight: "900",
  },

  input: {
    height: 48,
    borderRadius: 15,
    backgroundColor: t.surfaces.footer,
    borderWidth: 1,
    borderColor: t.borders.default,
    paddingHorizontal: 14,
    color: t.text.primary,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
  searchInput: {
    height: 44,
    borderRadius: 15,
    backgroundColor: t.surfaces.footer,
    borderWidth: 1,
    borderColor: t.borders.default,
    paddingHorizontal: 14,
    color: t.text.primary,
    fontSize: 14,
    fontWeight: "600",
  },

  footer: {
    paddingHorizontal: t.spacing.md,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: t.surfaces.footer,
    borderTopWidth: 1,
    borderTopColor: t.borders.muted,
  },
  disabledButton: {
    opacity: 0.45,
  },
});