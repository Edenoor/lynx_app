// global.ts
import { Dimensions, Platform, StatusBar } from 'react-native';

const { width, height } = Dimensions.get('window');

export const COLORS = {
  primary:    '#FFE600',   // Amarillo ML
  background: '#F7F6F3',   // Blanco perlado (fondo de la app)
  card:       '#FFFFFF',   // Color de las tarjetas
  border:     '#EAEAEA',   // Bordes sutiles de tarjetas/listas
  mutedBg:    '#F2F2F4',   // Chips, inputs, tags suaves
  blue:       '#3483FA',   // Botón ML
  white:      '#FFFFFF',
  black:      '#000000',
  gray:       '#A1A1AA',
  text:       '#1F1F1F',
  placeholder:'#757575',
};

export const FONT = {
  family: { regular: 'System', bold: 'System' },
  size:   { xs: 12, sm: 14, md: 16, lg: 20, xl: 28 },
};

export const SPACING = {
  xs: 4, sm: 8, md: 6, lg: 24, xl: 32, xxl: 48, xxxl: 56
};

export const BORDER_RADIUS = { sm: 4, md: 8, lg: 12, full: 999 };

export const SIZES = {
  screenWidth: width,
  screenHeight: height,
  statusBarHeight: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 44,
};

const theme = { COLORS, FONT, SPACING, BORDER_RADIUS, SIZES };
export default theme;
