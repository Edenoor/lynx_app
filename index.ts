import 'react-native-gesture-handler';
import 'react-native-reanimated'; // Add this line
// Define la tarea de ubicacion en segundo plano antes de montar la app
// (Android puede relanzar la app en background sin pasar por pantallas).
import './src/Presentation/config/DriverLocation';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
