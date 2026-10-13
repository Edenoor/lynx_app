// src/Presentation/views/admin/AdminWebScreen.tsx
// Un ADMIN sin perfil de depósito todavía no tiene operación en Mobile: se le
// avisa en vez de mandarlo a las pantallas de vendedor.

import React, { useContext } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import AppTheme from "../../theme/AppTheme";
import { UserContext } from "../../context/UserContext";

export function AdminWebScreen() {
  const { user, removeUserSession } = useContext(UserContext);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={AppTheme.typography.kicker}>LYNX · ADMINISTRACIÓN</Text>
        <Text style={styles.title}>Tu operación está en la Web</Text>
        <Text style={styles.body}>
          {user?.first_name ? `${user.first_name}, la` : "La"} app todavía no tiene pantallas para tu perfil. Entrá a Lynx
          desde la computadora con tu mismo usuario.
        </Text>
      </View>

      <Pressable style={styles.logout} onPress={removeUserSession}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppTheme.surfaces.screen, justifyContent: "space-between" },
  content: { padding: AppTheme.spacing.md, paddingTop: 48, gap: 12 },
  title: { color: AppTheme.text.primary, fontSize: 24, fontWeight: "800" },
  body: { color: AppTheme.text.secondary, fontSize: 15, lineHeight: 22 },
  logout: { margin: AppTheme.spacing.md, padding: 14, borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.colors.danger, alignItems: "center" },
  logoutText: { color: AppTheme.colors.danger, fontWeight: "700" },
});
