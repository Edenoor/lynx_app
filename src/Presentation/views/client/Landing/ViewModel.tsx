import { useContext } from 'react';
import { UserContext } from '../../../context/UserContext';

const useViewModel = () => {
  const { user, removeUserSession } = useContext(UserContext);

  return {
    user,
    removeUserSession,
  };
};

export default useViewModel;