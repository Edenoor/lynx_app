// src/Presentation/views/picker/PickerBaulDriverScreen.tsx
// Lo que un chofer tiene que entregar en el depósito del Picker: paquetes,
// cambios y retiros, retornos a verificar y cobranzas. Cada cosa se confirma
// por separado; lo que no se confirma sigue pendiente. Después de cada
// confirmación se vuelve a pedir el detalle al servidor (única fuente).

import React, { useCallback, useContext, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import type { PickerStackParamList } from "../../navigator/PickerStackNavigator";
import { fetchBaulDriver } from "./baulApi";
import { obligationsOf } from "./baulPicker";
import { BaulObligationCard } from "./BaulObligationCard";
import { ListMessage, PickerHeader, StaleBanner, useFocusQuery } from "./pickerUi";
import { UserContext } from "../../context/UserContext";
import { baulSoloConsulta } from "../../navigator/appArea";

type Props = NativeStackScreenProps<PickerStackParamList, "PickerBaulDriverScreen">;

export default function PickerBaulDriverScreen({ navigation, route }: Props) {
  const { driverId, name } = route.params;
  const fetcher = useCallback(() => fetchBaulDriver(driverId), [driverId]);
  const { data, error, loading, refreshing, refresh } = useFocusQuery(fetcher);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const obligations = data ? obligationsOf(data, driverId) : [];
  const { user } = useContext(UserContext);
  const soloConsulta = baulSoloConsulta(user);

  return (
    <SafeScreen>
      <PickerHeader
        title={name}
        subtitle={soloConsulta ? "Lo que tiene pendiente en tu depósito" : "Confirmá cada cosa que te entrega"}
        onBack={() => navigation.goBack()}
        onScan={soloConsulta ? undefined : () => navigation.navigate("PickerBaulScanScreen", { driverId, name })}
      />
      {data ? <StaleBanner error={error} /> : null}
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={AppTheme.text.accent} />}
      >
        {soloConsulta ? <Text style={styles.consulta}>Solo consulta: cobrar y recibir lo hace quien opera el baúl.</Text> : null}
        {notice ? <Text style={[styles.notice, { color: notice.ok ? AppTheme.colors.success : AppTheme.colors.danger }]}>{notice.text}</Text> : null}
        {!obligations.length ? (
          <ListMessage loading={loading} error={data ? null : error} empty="No le queda nada pendiente en tu depósito." />
        ) : (
          <View style={styles.list}>
            {obligations.map((o) => (
              <BaulObligationCard
                key={o.key}
                obligation={o}
                soloConsulta={soloConsulta}
                onResult={(r) => { setNotice({ ok: r.ok, text: r.text }); if (r.reload) refresh(); }}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: { padding: AppTheme.spacing.md, gap: 12, paddingBottom: 48 },
  list: { gap: 12 },
  notice: { fontSize: 14, fontWeight: "700" },
  consulta: { fontSize: 13, color: AppTheme.text.muted },
});
