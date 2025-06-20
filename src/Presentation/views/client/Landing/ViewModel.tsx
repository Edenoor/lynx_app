import React, { useContext } from 'react'
import { UserContext } from '../../../context/UserContext'

const ClientViewModel = () => {
  const {user, removeUserSession} = useContext(UserContext)
  return {
    user,
    removeUserSession
  }
}

export default ClientViewModel