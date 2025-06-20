import React, { useEffect, useState } from 'react'
import * as Location from 'expo-location'

const QrGeneratorViewModel = () => {
  const [errorMessage, setErrorMessage] = useState('');
    const [values, setValues] = useState({
        lat: 0.0,
        long: 0.0,
        street: '',
        address: '',
        neighbourhood: ''
    });
    const [messagePermissions, setMessagePermissions] = useState('')
    const [position, setPosition] = useState<Location.LocationObjectCoords>()
    useEffect(() => {
      const requestPermissions = async () => {
        const foreground = await Location.requestForegroundPermissionsAsync()

        if(foreground.granted){

        }
      }
    
      
    }, [])
    
    const startForegroundUpdate = async () => {
      const { granted } = await Location.getForegroundPermissionsAsync()

      if(!granted){
        setMessagePermissions('Permiso de ubicacion denegado')
        return;
      }

      const location = await Location.getLastKnownPositionAsync()
    }

    return {
        ...values,
    }
}

export default QrGeneratorViewModel;
