import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Image,
  ImageSourcePropType,
  View,
} from 'react-native';
import global from '../theme/global';

interface Props {
  text: string;
  onPress: () => void;
  foto?: ImageSourcePropType;
}

export const RoundedButton = ({ text, onPress, foto }: Props) => {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      {foto && (
        <Image source={foto} style={styles.icon} resizeMode="contain" />
      )}
      <Text style={styles.text}>{text}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 50,
    backgroundColor: global.COLORS.blue,
    borderRadius: global.BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: global.SPACING.md,
  },
  icon: {
    width: 24,
    height: 24,
    marginRight: global.SPACING.sm,
  },
  text: {
    color: global.COLORS.white,
    fontSize: global.FONT.size.md,
    fontWeight: 'bold',
  },
});
