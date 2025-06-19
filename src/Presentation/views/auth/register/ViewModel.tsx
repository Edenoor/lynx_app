import React, { useState } from 'react'
import { useUserLocal } from '../../../hooks/useUserLocal';
import { SaveUserLocalUseCase } from '../../../../Domain/useCases/userLocal/SaveUserLocal';
import { RegisterAuthUseCase } from '../../../../Domain/useCases/auth/RegisterAuth';

const RegisterViewModel = () => {
  const [errorMessage, setErrorMessage] = useState('');
    const [values, setValues] = useState({
        email: '',
        password: '',
        rol: '',
        confirmPassword: '',
    });
    const [loading, setLoading] = useState(false)
    const {user, getUserSession} = useUserLocal();

    const onChange = (property: string, value: any) => {
        setValues({ ...values, [property]: value })
    }

    const register = async () => {
        if (isValidForm()) {
            setLoading(true)
            const response = await RegisterAuthUseCase(values);
            setLoading(false)
            console.log('RESULT: ' + JSON.stringify(response)); 
            if(response.success){
                await SaveUserLocalUseCase(response.data)
                getUserSession()
            }
            else{
                setErrorMessage(response.message)
            }   
        }
    }

    const isValidForm = (): boolean => {
        if (values.email === '') {
            setErrorMessage('Ingresa tu correo electronico');
            return false;
        }
        if (values.password === '') {
            setErrorMessage('Ingresa la contraseña');
            return false;
        }
        if (values.confirmPassword === '') {
            setErrorMessage('Ingresa la confirmacion de la contraseña');
            return false;
        }
        if (values.rol === '') {
            setErrorMessage('Ingresa la confirmacion de la contraseña');
            return false;
        }
        if (values.password !== values.confirmPassword) {
            setErrorMessage('Las contraseñas no coinciden');
            return false;
        }
        return true;
    }

    return {
        ...values,
        onChange,
        register,
        errorMessage,
        user,
        loading,
        getUserSession
    }
}

export default RegisterViewModel;
