import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Image,
  ImageSourcePropType,
  View,
} from "react-native";
import { useThemedStyles } from "../theme/ThemeContext";
import type { Theme } from "../theme/createTheme";

interface Props {
  text: string;
  onPress: () => void;
  foto?: ImageSourcePropType;
  disabled?: boolean;
}

export const RoundedButton = ({
  text,
  onPress,
  foto,
  disabled = false,
}: Props) => {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={disabled}
      style={[
        styles.button,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
    >
      <View style={styles.content}>
        {foto && (
          <Image
            source={foto}
            style={styles.icon}
            resizeMode="contain"
          />
        )}

        <Text style={styles.text}>{text}</Text>

        <Text style={styles.arrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
};

const makeStyles = (t: Theme) => StyleSheet.create({
  button: {
    width: "100%",
    height: 58,
    borderRadius: t.radius.lg,
    backgroundColor: t.colors.primary,
    justifyContent: "center",
    ...t.shadows.glow,
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
  },

  icon: {
    width: 22,
    height: 22,
    marginRight: 12,
  },

  text: {
    flex: 1,
    textAlign: "center",

    color: t.text.onPrimary,

    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  arrow: {
    color: t.text.onPrimary,
    fontSize: 26,
    fontWeight: "400",
  },
});