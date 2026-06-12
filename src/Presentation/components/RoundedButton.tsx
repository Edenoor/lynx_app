import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Image,
  ImageSourcePropType,
  View,
} from "react-native";
import global from "../theme/global";

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

const styles = StyleSheet.create({
  button: {
    width: "100%",
    height: 58,
    borderRadius: 18,
    backgroundColor: "#00B8FF",
    justifyContent: "center",

    shadowColor: "#00B8FF",
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 6,
    },

    elevation: 3,
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

    color: "#031018",

    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  arrow: {
    color: "#031018",
    fontSize: 26,
    fontWeight: "400",
  },
});