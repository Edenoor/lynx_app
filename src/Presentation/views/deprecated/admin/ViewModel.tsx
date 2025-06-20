import React, { useContext } from 'react'
import { UserContext } from '../../../context/UserContext'

const AdminViewModel = () => {
    const {user, removeUserSession} = useContext(UserContext)
  return {
    user,
    removeUserSession
  }
}

export default AdminViewModel