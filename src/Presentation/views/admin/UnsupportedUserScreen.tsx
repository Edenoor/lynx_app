// src/Presentation/views/admin/UnsupportedUserScreen.tsx
// Un usuario que no es chofer, vendedor ni interno (por ejemplo, un proveedor)
// no tiene operación en la app: se le avisa en vez de mostrarle las pantallas
// de vendedor llenas de errores (auditoría 19-nov, APP-06).

import React, { useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import AppTheme from "../../theme/AppTheme";
import { SafeScreen } from "../../components/SafeScreen";
import { UserContext } from "../../context/UserContext";

export function UnsupportedUserScreen() {
  const { user, removeUserSession } = useContext(UserContext);

  return (
    <SafeScreen style={styles.screen}>
      <View style={styles.content}>
        <Text style={AppTheme.typography.kicker}>LYNX</Text>
        <Text style={styles.title}>La app no tiene operación para tu usuario</Text>
        <Text style={styles.body}>
          {user?.first_name ? `${user.first_name}, tu` : "Tu"} usuario no es de chofer, vendedor ni interno. Si creés que es un
          error, consultá con quien te dio el acceso.
        </Text>
      </View>

      <Pressable style={styles.logout} onPress={removeUserSession}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "space-between" },
  content: { padding: AppTheme.spacing.md, paddingTop: 48, gap: 12 },
  title: { color: AppTheme.text.primary, fontSize: 24, fontWeight: "800" },
  body: { color: AppTheme.text.secondary, fontSize: 15, lineHeight: 22 },
  logout: { margin: AppTheme.spacing.md, padding: 14, borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.colors.danger, alignItems: "center" },
  logoutText: { color: AppTheme.colors.danger, fontWeight: "700" },
});
