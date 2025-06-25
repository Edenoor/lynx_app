import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, StatusBar } from 'react-native';
import { MainStackNavigator } from './src/Presentation/navigator/MainStackNavigator';
import global from './src/Presentation/theme/global';

const App = () => {
  return (
    <View style={{ flex: 1, backgroundColor: global.COLORS.background, padding: global.SPACING.md }}>
      <StatusBar backgroundColor={global.COLORS.primary} barStyle="dark-content" />
      <NavigationContainer>
        <MainStackNavigator />
      </NavigationContainer>
    </View>
  );
};

export default App;
