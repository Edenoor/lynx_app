import React, { useState } from 'react'
import { recoveryAuthUseCase } from '../../../../Domain/useCases/auth/RecoveryAuth';

const RecuperarViewModel = () => {

  const [errorMessage, setErrorMessage] = useState('');
  const [values, setValues] = useState({
    email: ''
});

  const onChange = (property: string, value: any) => {
  setValues({ ...values, [property]: value })
  }

  const isValidForm = (): boolean => {
    if (values.email === '') {
      setErrorMessage('Ingresa tu correo electronico');
      return false;
    }
    return true
  }

  const sendEmail = async() => {
    if(isValidForm()){
      console.log(values.email)
      const response = await recoveryAuthUseCase(values.email);
      if(response.success){
        setErrorMessage(response.message)
      }
      else{
        setErrorMessage(response.message)
      }
    }
  }

  return {
    ...values,
    errorMessage,
    onChange,
    sendEmail
  }
}

export default RecuperarViewModel