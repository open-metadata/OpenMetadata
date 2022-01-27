/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

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
        <div
          className={`tw-notification ${position} ${variantStyle}`}
          data-testid="toast">
          <div className="tw-font-semibold tw-flex-shrink-0">
            <SVGIcons
              alt={variant}
              icon={variant}
              title={variant.toUpperCase()}
              width="24px"
            />
          </div>

          <div className="tw-font-semibold tw-self-center tw-px-1 tw-break-words">
            {body}
          </div>
          <button
            className="tw-font-semibold"
            data-testid="dismiss"
            onClick={() => setShow(false)}>
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
