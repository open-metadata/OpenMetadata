import propTypes from 'prop-types';
import React, { createContext, useCallback, useState } from 'react';
import Toaster from '../components/common/toaster/Toaster';

const ToastContext = createContext();

export default ToastContext;

export const ToastContextProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(
    function (toast) {
      setToasts((toasts) => [...toasts, toast]);
    },
    [setToasts]
  );

  return (
    <ToastContext.Provider value={addToast}>
      <div className="tw-notification-container">
        <Toaster toastList={toasts} />
      </div>
      {children}
    </ToastContext.Provider>
  );
};

ToastContextProvider.propTypes = {
  children: propTypes.object,
};
