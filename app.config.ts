import 'dotenv/config';

export default {
  expo: {
    name: 'WynFlex',
    slug: 'wynflex',
    extra: {
      EXPO_PUBLIC_GOOGLE_MAPS_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY,
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
    },
  },
};