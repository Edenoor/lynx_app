import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ClientScreen } from '../views/client/Client';
import { createStaticNavigation, NavigationContainer } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { RecuperarScreen } from "../views/recuperar/Recuperar";


const Drawer = createDrawerNavigator({
  screens: {
    ClientScreen: ClientScreen,
    RecuperarScreen: RecuperarScreen,
  },
});

const Navigation = createStaticNavigation(Drawer);
export const DrawerStackNavigator = () => {
  return (
    <Navigation />
  )
}