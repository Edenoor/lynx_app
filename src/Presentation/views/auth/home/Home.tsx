import React, { useEffect } from 'react'
import { View, Text, ToastAndroid, TouchableOpacity } from 'react-native';
import { RoundedButton } from '../../../components/RoundedButton';
import { StackScreenProps } from '@react-navigation/stack';
import useViewModel from './ViewModel';
import { CustomTextInput } from '../../../components/CustomTextInput';
import { RootStackParamList } from '../../../navigator/MainStackNavigator';

interface Props extends StackScreenProps<RootStackParamList, 'HomeScreen'>{};

export const HomeScreen = ({navigation, route}: Props) => {
    const { email, password, errorMessage, onChange, login, user, removeUserSession } = useViewModel();

    useEffect(() => {
        if (errorMessage !== '') {
            ToastAndroid.show(errorMessage, ToastAndroid.LONG);
        }
    }, [errorMessage])

    useEffect(() => {      
        if (user?.id !== null && user?.id !== undefined && user?.id !== '') {
            
            if(user.rol === 'SELLER'){
                navigation.replace('SellerStackNavigator')
            }
            else if(user.rol === 'DRIVER'){
                navigation.replace('DriverStackNavigator')
            }
        }
    }, [user])

    return(
    <View style={{top:60}}>
        <Text >HOME</Text>
        <CustomTextInput 
                image={ require('../../../../assets/email.png') }
                placeholder='Correo electronico'
                keyboardType='email-address'
                property='email'
                onChangeText={ onChange }
                value={ email }
            />
        
            <CustomTextInput 
                image={ require('../../../../assets/password.png') }
                placeholder='Contraseña'
                keyboardType='default'
                property='password'
                onChangeText={ onChange }
                value={ password }
                secureTextEntry={ true }
            />
            <RoundedButton text='LOGIN' onPress={ () => login()} />

                <TouchableOpacity onPress={ login }>
            <Text>entrada</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={ () => navigation.navigate('RegisterScreen') }>
            <Text>Registrate</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={ () => navigation.navigate('RecuperarScreen')}>
            <Text>Recuperar Contraseña</Text>
        </TouchableOpacity>

        <View style={{top:100}}>
            <TouchableOpacity onPress={ () =>  removeUserSession()}>
                <Text>remover sesion</Text>
            </TouchableOpacity>
        </View>
    </View>
    )
    
}



    