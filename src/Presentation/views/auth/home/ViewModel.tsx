import { useContext, useState } from "react";
import { UserContext } from "../../../context/UserContext";
// import { LoginAuthUseCase } from "../../../../Domain/useCases/auth/LoginAuth";

const HomeViewModel = () => {
    const [errorMessage, setErrorMessage] = useState('');
    const [values, setValues] = useState({
        email: '',
        password: '',
    });
    const { user, saveUserSession, removeUserSession } = useContext(UserContext);
    console.log('USUARIO DE SESION: ' + JSON.stringify(user));

    const onChange = (property: string, value: any) => {
        setValues({ ...values, [property]: value });
    };

    // ✅ Login HARDCODEADO para pruebas
    const login = async () => {
        if (!isValidForm()) return;

        const { email, password } = values;

        if (email === 'seller@test.com' && password === '1234') {
            saveUserSession({ id: '1', email, rol: 'SELLER' });
            return;
        }

        if (email === 'driver@test.com' && password === '1234') {
            saveUserSession({ id: '2', email, rol: 'DRIVER' });
            return;
        }

        setErrorMessage('Credenciales incorrectas');
    };

    /*
    // 🔁 Método original con LoginAuthUseCase
    const login = async () => {
        if (isValidForm()) {
            const response = await LoginAuthUseCase(values.email, values.password);
            console.log('RESPONSE: ' + JSON.stringify(response));
            if (!response.success) {
                setErrorMessage(response.message);
            } else {
                saveUserSession(response.data);
            }
        }
    };
    */

    const isValidForm = (): boolean => {
        if (values.email === '') {
            setErrorMessage('Ingresa el correo electrónico');
            return false;
        }
        if (values.password === '') {
            setErrorMessage('Ingresa la contraseña');
            return false;
        }
        return true;
    };

    return {
        ...values,
        user,
        onChange,
        login,
        errorMessage,
        removeUserSession
    };
};

export default HomeViewModel;
