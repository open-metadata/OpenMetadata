import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import SVGIcons from '../../../utils/SvgUtils';
import './Toast.css';
import { ToastBg } from './Toast.styles';
import { ToastProps } from './ToastTypes';
const Toast = (props: ToastProps) => {
  const { body, position, autoDelete, dismissTime, variant } = props;
  const [show, setShow] = useState<boolean>(true);
  const variantStyle = ToastBg[variant as keyof typeof ToastBg];

  useEffect(() => {
    const interval = setInterval(() => {
      if (autoDelete) {
        setShow(false);
      }
    }, dismissTime);

    return () => {
      clearInterval(interval);
    };
  }, [body, autoDelete, dismissTime]);

  return (
    <>
      {show && (
        <div className={`tw-notification ${position} ${variantStyle}`}>
          <div className="tw-font-semibold tw-flex-shrink-0">
            <SVGIcons
              alt={variant}
              icon={variant}
              title={variant.toUpperCase()}
              width="24px"
            />
          </div>

          <div className="tw-font-semibold tw-self-center tw-px-1">{body}</div>
          <button className="tw-font-semibold" onClick={() => setShow(false)}>
            <i aria-hidden="true" className="fa fa-times" />
          </button>
        </div>
      )}
    </>
  );
};

Toast.propTypes = {
  body: PropTypes.string,
  position: PropTypes.string,
  autoDelete: PropTypes.bool,
  dismissTime: PropTypes.number,
  variant: PropTypes.string,
};

export default Toast;
