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
import global from "../theme/global";

type LynxLoaderProps = {
  message?: string;
  compact?: boolean;
  style?: ViewStyle;
};

export function LynxLoader({
  message = "Preparando Lynx...",
  compact = false,
  style,
}: LynxLoaderProps) {
  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.85)).current;

  const dotOne = useRef(new Animated.Value(1)).current;
  const dotTwo = useRef(new Animated.Value(0.32)).current;
  const dotThree = useRef(new Animated.Value(0.32)).current;

  useEffect(() => {
    const scanLoop = Animated.loop(
      Animated.timing(scanAnim, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      })
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const dotsLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(dotOne, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(dotTwo, {
            toValue: 0.32,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(dotThree, {
            toValue: 0.32,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(220),
        Animated.parallel([
          Animated.timing(dotOne, {
            toValue: 0.32,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(dotTwo, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(dotThree, {
            toValue: 0.32,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(220),
        Animated.parallel([
          Animated.timing(dotOne, {
            toValue: 0.32,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(dotTwo, {
            toValue: 0.32,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(dotThree, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(260),
      ])
    );

    scanLoop.start();
    pulseLoop.start();
    dotsLoop.start();

    return () => {
      scanLoop.stop();
      pulseLoop.stop();
      dotsLoop.stop();
    };
  }, [dotOne, dotThree, dotTwo, pulseAnim, scanAnim]);

  const scanTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-52, 52],
  });

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact, style]}>
      <Animated.View
        style={[
          styles.logoBox,
          compact && styles.logoBoxCompact,
          { opacity: pulseAnim },
        ]}
      >
        <Image
          source={require("../../../assets/adaptive-icon-white.png")}
          style={[styles.logo, compact && styles.logoCompact]}
          resizeMode="contain"
        />

        <Animated.View
          style={[
            styles.scanLine,
            {
              transform: [{ translateY: scanTranslateY }],
            },
          ]}
        />
      </Animated.View>

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
    width: 112,
    height: 112,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(13,22,35,0.62)",
    borderWidth: 1,
    borderColor: "rgba(248,250,252,0.14)",
  },
  logoBoxCompact: {
    width: 74,
    height: 74,
    borderRadius: 24,
  },

  logo: {
    width: 76,
    height: 76,
  },
  logoCompact: {
    width: 48,
    height: 48,
  },

  scanLine: {
    position: "absolute",
    left: 12,
    right: 12,
    height: 2,
    borderRadius: 999,
    backgroundColor: global.COLORS.blue,
    shadowColor: global.COLORS.blue,
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    elevation: 8,
  },

  message: {
    color: "#F8FAFC",
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
    backgroundColor: global.COLORS.blue,
  },
});