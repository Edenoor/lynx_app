import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useOnboarding } from "../onboarding/OnboardingContext";
import { VEHICLE_CATALOG } from "../onboarding/VehicleCatalog";
import type { VehicleType } from "../onboarding/types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingStackParamList } from "../navigator/OnboardingStackNavigator";

type Props = NativeStackScreenProps<OnboardingStackParamList, "Vehicle">;

const VEHICLE_TYPES: { label: string; value: VehicleType }[] = [
  { label: "Moto", value: "moto" },
  { label: "Auto", value: "auto" },
  { label: "Utilitario", value: "utilitario" },
  { label: "Furgón", value: "furgon" },
];

export function VehicleScreen({ navigation }: Props) {
  const { state, dispatch } = useOnboarding();

  const [type, setType] = useState<VehicleType | "">(
    (state.vehicle.type ?? "") as any
  );
  const [brand, setBrand] = useState<string>(state.vehicle.brand ?? "");
  const [model, setModel] = useState<string>(state.vehicle.model ?? "");
  const [plate, setPlate] = useState<string>(state.vehicle.plate ?? "");

  const brands = useMemo(() => {
    if (!type) return [];
    return Object.keys(VEHICLE_CATALOG[type]);
  }, [type]);

  const models = useMemo(() => {
    if (!type || !brand) return [];
    return VEHICLE_CATALOG[type][brand] ?? [];
  }, [type, brand]);

  const onChangeType = (v: VehicleType | "") => {
    setType(v);
    setBrand("");
    setModel("");
  };

  const onChangeBrand = (v: string) => {
    setBrand(v);
    setModel("");
  };

  const canContinue = Boolean(type && brand && model && plate.trim().length >= 5);

  const onContinue = () => {
    if (!canContinue) {
      Alert.alert(
        "Falta info",
        "Elegí tipo, marca, modelo y completá la patente para continuar."
      );
      return;
    }

    dispatch({
      type: "SET_VEHICLE",
      value: {
        type: type as VehicleType,
        brand,
        model,
        plate: plate.trim().toUpperCase(),
      },
    });

    navigation.navigate("Selfie");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tu vehículo</Text>
      <Text style={styles.subtitle}>
        Elegí el tipo, marca y modelo para completar tu perfil.
      </Text>

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.pickerBox}>
        <Picker selectedValue={type} onValueChange={(v) => onChangeType(v)}>
          <Picker.Item label="Seleccionar tipo…" value="" />
          {VEHICLE_TYPES.map((t) => (
            <Picker.Item key={t.value} label={t.label} value={t.value} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Marca</Text>
      <View style={[styles.pickerBox, !type && styles.disabled]}>
        <Picker
          enabled={Boolean(type)}
          selectedValue={brand}
          onValueChange={(v) => onChangeBrand(v)}
        >
          <Picker.Item
            label={type ? "Seleccionar marca…" : "Seleccioná tipo primero"}
            value=""
          />
          {brands.map((b) => (
            <Picker.Item key={b} label={b} value={b} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Modelo</Text>
      <View style={[styles.pickerBox, !(type && brand) && styles.disabled]}>
        <Picker
          enabled={Boolean(type && brand)}
          selectedValue={model}
          onValueChange={(v) => setModel(v)}
        >
          <Picker.Item
            label={
              type && brand ? "Seleccionar modelo…" : "Seleccioná marca primero"
            }
            value=""
          />
          {models.map((m) => (
            <Picker.Item key={m} label={m} value={m} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Patente</Text>
      <TextInput
        value={plate}
        onChangeText={(t) => setPlate(t.toUpperCase())}
        placeholder="Ej: AA123BB"
        autoCapitalize="characters"
        style={styles.input}
      />

      <TouchableOpacity
        style={[styles.button, !canContinue && styles.buttonDisabled]}
        onPress={onContinue}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Continuar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 18, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "800", marginTop: 8 },
  subtitle: { marginTop: 6, color: "#666", marginBottom: 18 },
  label: { marginTop: 10, marginBottom: 6, fontWeight: "700" },
  pickerBox: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    overflow: "hidden",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  disabled: { opacity: 0.55 },
  button: {
    marginTop: 18,
    backgroundColor: "#111",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontWeight: "800" },
});
