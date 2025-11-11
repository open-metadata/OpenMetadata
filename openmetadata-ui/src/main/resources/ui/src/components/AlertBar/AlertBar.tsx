/*
 *  Copyright 2024 Collate.
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
import { Alert, AlertProps } from 'antd';
import classNames from 'classnames';
import { useMemo, useState } from 'react';
import { ReactComponent as CrossIcon } from '../../assets/svg/ic-cross.svg';
import { useAlertStore } from '../../hooks/useAlertStore';
import { getIconAndClassName } from '../../utils/ToastUtils';
import './alert-bar.style.less';
import { AlertBarProps } from './AlertBar.interface';

const AlertBar = ({
  type,
  message,
  defafultExpand,
  className: alertClassName,
}: AlertBarProps): JSX.Element => {
  const { resetAlert, animationClass } = useAlertStore();
  const [expanded, setExpanded] = useState(defafultExpand);

  const {
    icon: AlertIcon,
    className,
    type: alertType,
  } = useMemo(() => {
    return getIconAndClassName(type);
  }, [type]);

  return (
    <Alert
      closable
      showIcon
      afterClose={resetAlert}
      className={classNames(
        'alert-container',
        className,
        animationClass,
        alertClassName
      )}
      closeIcon={
        <CrossIcon
          className="alert-close-icon"
          color="currentColor"
          data-testid="alert-icon-close"
        />
      }
      data-testid="alert-bar"
      description={
        <>
          <span
            className={classNames('alert-message', { expanded })}
            data-testid="alert-message">
            {message}
          </span>
          {typeof message === 'string' && message.length > 400 && (
            <button
              className="alert-toggle-btn"
              data-testid="alert-toggle-btn"
              onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Show Less' : 'Show More'}
            </button>
          )}
        </>
      }
      icon={
        AlertIcon && (
          <AlertIcon
            data-testid="alert-icon"
            id={type !== 'success' ? 'alert-icon' : ''}
          />
        )
      }
      type={alertType as AlertProps['type']}
    />
  );
};

export default AlertBar;
