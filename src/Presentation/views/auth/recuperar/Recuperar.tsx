import React, { useEffect } from 'react'
import { Text, ToastAndroid, TouchableOpacity, View, Image, ScrollView } from 'react-native';
import { CustomTextInput } from '../../../components/CustomTextInput'
import useViewModel from './ViewModel';
import { RoundedButton } from '../../../components/RoundedButton';

export const RecuperarScreen = () => {

  const {email, errorMessage, onChange, sendEmail} = useViewModel()
  useEffect(() => {
      if (errorMessage != '') {
        ToastAndroid.show(errorMessage, ToastAndroid.LONG);
      }
    }, [errorMessage])

  return (
        <View >
              
    
            <View >
    
              <ScrollView>
    
                <Text >RECUPERAR</Text>
                
                
                <CustomTextInput 
                  placeholder='Correo electronico'
                  keyboardType='email-address'
                  image={ require('../../../../assets/email.png') }
                  property='email'
                  onChangeText={ onChange }
                  value={ email }
                  />
    
                <View style={{ marginTop: 30 }}>
                    
                    <RoundedButton text='Recuperar contraseña' onPress={ sendEmail} />
    
                </View>
    
              </ScrollView>
    
            </View>
            
            
        </View>
    
  )
}
