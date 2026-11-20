// src/Presentation/views/picker/PickerBaulScreen.tsx
// Baúl de los choferes, para el Picker: quién tiene algo pendiente en SU
// depósito (lo filtra el servidor). Se abre un chofer para recibir lo suyo, o
// se escanea la etiqueta original de un envío para ir directo a lo que trae.

import React, { useCallback, useContext } from "react";
import { FlatList, Pressable, RefreshControl, Text } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { driverName, fetchBaulDrivers, BaulDriverRow } from "./baulApi";
import { pesos } from "./baulPicker";
import { ListMessage, listStyles, PickerHeader, StaleBanner, useFocusQuery } from "./pickerUi";
import AppTheme from "../../theme/AppTheme";
import { UserContext } from "../../context/UserContext";
import { baulSoloConsulta } from "../../navigator/appArea";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerBaulScreen">;

function summary(d: BaulDriverRow): string {
  const parts = [
    d.parcels ? `${d.parcels} paquete${d.parcels === 1 ? "" : "s"}` : null,
    d.items ? `${d.items} cambio${d.items === 1 ? "" : "s"} o retiro${d.items === 1 ? "" : "s"}` : null,
    d.to_verify ? `${d.to_verify} a verificar` : null,
    d.cash_count ? `efectivo ${pesos(d.cash_amount)} (${d.cash_count})` : null,
    d.transfer_count ? `transferencias ${pesos(d.transfer_amount)} (${d.transfer_count})` : null,
  ];
  return parts.filter(Boolean).join(" · ");
}

export default function PickerBaulScreen({ navigation }: Props) {
  const fetcher = useCallback(fetchBaulDrivers, []);
  const { data, error, loading, refreshing, refresh } = useFocusQuery(fetcher);
  const drivers = data?.drivers ?? [];
  const { user } = useContext(UserContext);
  const soloConsulta = baulSoloConsulta(user);

  return (
    <SafeScreen>
      <PickerHeader
        title="Baúl de choferes"
        subtitle="Lo que tienen que entregar en tu depósito"
        onBack={() => navigation.goBack()}
        onScan={soloConsulta ? undefined : () => navigation.navigate("PickerBaulScanScreen", {})}
      />
      {soloConsulta ? <Text style={[listStyles.rowMeta, { paddingHorizontal: AppTheme.spacing.md, paddingTop: 8 }]}>Solo consulta: cobrar y recibir lo hace quien opera el baúl.</Text> : null}
      {data ? <StaleBanner error={error} /> : null}
      <FlatList
        data={drivers}
        keyExtractor={(d) => String(d.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={AppTheme.text.accent} />}
        ListEmptyComponent={<ListMessage loading={loading} error={data ? null : error} empty="Ningún chofer tiene nada pendiente en tu depósito." />}
        renderItem={({ item }) => (
          <Pressable style={listStyles.row} onPress={() => navigation.navigate("PickerBaulDriverScreen", { driverId: item.id, name: driverName(item) })}>
            <Text style={listStyles.rowTitle}>{driverName(item)}</Text>
            <Text style={listStyles.rowMeta}>{summary(item)}</Text>
          </Pressable>
        )}
      />
    </SafeScreen>
  );
}
