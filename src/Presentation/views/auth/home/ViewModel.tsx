import { useContext, useState } from "react";
import { UserContext } from "../../../context/UserContext";
import { LoginAuthUseCase } from "../../../../Domain/useCases/auth/LoginAuth";

const HomeViewModel = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const [values, setValues] = useState({
        email: '',
        password: '',
    });
    const {user, saveUserSession, removeUserSession} = useContext(UserContext)
    console.log('USUARIO DE SESION: ' + JSON.stringify(user));
    

    const onChange = (property: string, value: any) => {
        setValues({ ...values, [property]: value });
    }

    const login = async () => {
        if (isValidForm()) {
            const response =  await LoginAuthUseCase(values.email, values.password);
            console.log('RESPONSE: ' + JSON.stringify(response));
            if (!response.success) {
                setErrorMessage(response.message);
            }
            else {
                saveUserSession(response.data);
            }
        }
    }

    const isValidForm = (): boolean => {
        if (values.email === '') {
            setErrorMessage('Ingresa el correo electronico');
            return false;
        }
        if (values.password === '') {
            setErrorMessage('Ingresa la contraseña');
            return false;
        }

        return true;
    }

    return {
        ...values,
        user,
        onChange,
        login,
        errorMessage,
        removeUserSession
    }
}

export default HomeViewModel;