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
import { Alert } from 'antd';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { ReactComponent as ErrorIcon } from '../../assets/svg/ic-error.svg';
import { ReactComponent as InfoIcon } from '../../assets/svg/ic-info-tag.svg';
import { ReactComponent as SuccessIcon } from '../../assets/svg/ic-success.svg';
import { ReactComponent as WarningIcon } from '../../assets/svg/ic-warning-tag.svg';
import { useAlertStore } from '../../hooks/useAlertBar';
import './alert-bar.style.less';
import { AlertBarProps } from './AlertBar.interface';
import CrossIcon from './CrossIcon';

const AlertBar = ({ type, message }: AlertBarProps): JSX.Element => {
  const { resetAlert } = useAlertStore();

  const { icon, className, crossIconColor } = useMemo(() => {
    switch (type) {
      case 'info':
        return {
          icon: <InfoIcon />,
          className: 'info',
          crossIconColor: '#0950c5',
        };

      case 'success':
        return {
          icon: <SuccessIcon />,
          className: 'success',
          crossIconColor: '#1D7C4D',
        };

      case 'warning':
        return {
          icon: <WarningIcon />,
          className: 'warning',
          crossIconColor: '#F59638',
        };

      case 'error':
        return {
          icon: <ErrorIcon />,
          className: 'error',
          crossIconColor: '#CB2531',
        };

      default:
        return {
          icon: null,
          className: '',
          crossIconColor: null,
        };
    }
  }, [type]);

  return (
    <Alert
      closable
      showIcon
      className={classNames(className, 'alert-container')}
      closeIcon={crossIconColor && <CrossIcon iconColor={crossIconColor} />}
      description={message}
      icon={icon}
      type={type}
      onClose={resetAlert}
    />
  );
};

export default AlertBar;
