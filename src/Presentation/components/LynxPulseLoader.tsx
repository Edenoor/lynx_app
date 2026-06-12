// src/Presentation/components/LynxLoader.tsx

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import AppTheme from "../theme/AppTheme";

type LynxLoaderProps = {
  message?: string;
  compact?: boolean;
  style?: ViewStyle;
  showLogo?: boolean;
};

export function LynxPulseLoader({
  message = "Cargando...",
  compact = false,
  style,
  showLogo = true,
}: LynxLoaderProps) {
  const pulseAnim = useRef(new Animated.Value(0.86)).current;
  const dotOne = useRef(new Animated.Value(1)).current;
  const dotTwo = useRef(new Animated.Value(0.32)).current;
  const dotThree = useRef(new Animated.Value(0.32)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.86,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const dotsLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(dotOne, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.timing(dotTwo, { toValue: 0.32, duration: 180, useNativeDriver: true }),
          Animated.timing(dotThree, { toValue: 0.32, duration: 180, useNativeDriver: true }),
        ]),
        Animated.delay(220),
        Animated.parallel([
          Animated.timing(dotOne, { toValue: 0.32, duration: 180, useNativeDriver: true }),
          Animated.timing(dotTwo, { toValue: 1, duration: 180, useNativeDriver: true }),
          Animated.timing(dotThree, { toValue: 0.32, duration: 180, useNativeDriver: true }),
        ]),
        Animated.delay(220),
        Animated.parallel([
          Animated.timing(dotOne, { toValue: 0.32, duration: 180, useNativeDriver: true }),
          Animated.timing(dotTwo, { toValue: 0.32, duration: 180, useNativeDriver: true }),
          Animated.timing(dotThree, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]),
        Animated.delay(260),
      ])
    );

    pulseLoop.start();
    dotsLoop.start();

    return () => {
      pulseLoop.stop();
      dotsLoop.stop();
    };
  }, [dotOne, dotThree, dotTwo, pulseAnim]);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, style]}>
      {showLogo && (
        <Animated.View
          style={[
            styles.logoBox,
            compact && styles.logoBoxCompact,
            { opacity: pulseAnim, transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Image
            source={require("../../../assets/adaptive-icon-white.png")}
            style={[styles.logo, compact && styles.logoCompact]}
            resizeMode="contain"
          />
        </Animated.View>
      )}

      <Text style={[styles.message, compact && styles.messageCompact]}>
        {message}
      </Text>

      <View style={styles.dots}>
        <Animated.View style={[styles.dot, { opacity: dotOne }]} />
        <Animated.View style={[styles.dot, { opacity: dotTwo }]} />
        <Animated.View style={[styles.dot, { opacity: dotThree }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  wrapCompact: {
    gap: 10,
  },
  logoBox: {
    width: 96,
    height: 96,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.surfaces.card,
    borderWidth: 1,
    borderColor: AppTheme.borders.default,
  },
  logoBoxCompact: {
    width: 64,
    height: 64,
    borderRadius: 22,
  },
  logo: {
    width: 64,
    height: 64,
  },
  logoCompact: {
    width: 40,
    height: 40,
  },
  message: {
    color: AppTheme.text.primary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
    textAlign: "center",
  },
  messageCompact: {
    fontSize: 13,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: AppTheme.colors.primary,
  },
});