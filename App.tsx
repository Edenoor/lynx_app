import * as React from 'react';
import {useState} from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View} from 'react-native';
import { DriverStackNavigator } from './src/Presentation/navigator/DriverStackNavigator';
import { SellerStackNavigator } from './src/Presentation/navigator/SellerStackNavigator';
import { UserTypeSelectionScreen } from './src/Presentation/views/auth/userSelect/UserSelect';
import { RemoveUserLocalUseCase } from './src/Domain/useCases/userLocal/RemoveUserLocal';

type UserType = 'DRIVER' | 'SELLER' | null;

const App = () => {
   const [userType, setUserType] = useState<UserType>(null);

   const handleUserTypeSelect = (type: UserType) => {
    setUserType(type);
  };
   RemoveUserLocalUseCase()

  if (!userType) {
    return <UserTypeSelectionScreen onSelect={handleUserTypeSelect} />;
  }
  return (
    
    <NavigationContainer >
      <SellerStackNavigator/>
    </NavigationContainer>
  );
};

export default App;