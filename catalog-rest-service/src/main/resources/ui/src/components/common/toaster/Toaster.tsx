import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { TIMEOUT } from '../../../constants/constants';
import Toast from '../Toast/Toast';
import { ToastProp } from './ToasterTypes';
const Toaster = ({ toastList }: { toastList: Array<ToastProp> }) => {
  const [list, setList] = useState<Array<ToastProp>>(toastList);
  useEffect(() => {
    setList(toastList);
  }, [toastList]);

  return (
    <>
      {list.map((toast: ToastProp, id: number) => {
        return (
          <Toast
            autoDelete={toast.variant !== 'error'}
            body={toast.body}
            dismissTime={TIMEOUT.TOAST_DELAY}
            key={id}
            position="top-right"
            variant={toast.variant}
          />
        );
      })}
    </>
  );
};

Toaster.propTypes = {
  toastList: PropTypes.array.isRequired,
};

export default Toaster;
