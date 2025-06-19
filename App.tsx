import 'react-native-gesture-handler';
import * as React from 'react';
import {useState} from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View} from 'react-native';
import { UserTypeSelectionScreen } from './src/Presentation/views/auth/userSelect/UserSelect';
import { RemoveUserLocalUseCase } from './src/Domain/useCases/userLocal/RemoveUserLocal';
import { MainStackNavigator } from './src/Presentation/navigator/MainStackNavigator';

const App = () => {
  return (
    <NavigationContainer >
      <MainStackNavigator/>
    </NavigationContainer>
  );
};

export default App;