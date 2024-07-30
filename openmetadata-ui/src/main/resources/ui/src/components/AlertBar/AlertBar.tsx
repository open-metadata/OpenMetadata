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
import Icon from '@ant-design/icons';
import React, { useState } from 'react';
import { ReactComponent as CrossIcon } from '../../assets/svg/cross-icon.svg';
import { ReactComponent as ErrorCross } from '../../assets/svg/error-cross.svg';
import { ReactComponent as ErrorIcon } from '../../assets/svg/error-icon.svg';
import { ReactComponent as GeneralIcon } from '../../assets/svg/general-icon.svg';
import { ReactComponent as InfoCross } from '../../assets/svg/info-cross.svg';
import { ReactComponent as InfoIcon } from '../../assets/svg/info-icon.svg';
import { ReactComponent as SuccessCross } from '../../assets/svg/success-cross.svg';
import { ReactComponent as SuccessIcon } from '../../assets/svg/success-icon.svg';
import { ReactComponent as WarningCross } from '../../assets/svg/warning-cross.svg';
import { ReactComponent as WarningIcon } from '../../assets/svg/warning-icon.svg';
import './alert-bar.style.less';

const AlertBar = ({
  type = 'general',
  message = '',
}: AlertBarProps): JSX.Element => {
  const [isAlertVisible, setIsAlertVisible] = useState(true);
  let alertComponent = {
    icon: GeneralIcon,
    color: '#292929',
    bgColor: '#f6f7f9',
    crossIcon: CrossIcon,
  };

  switch (type) {
    case 'general':
      alertComponent = {
        icon: GeneralIcon,
        color: '#292929',
        bgColor: '#f6f7f9',
        crossIcon: CrossIcon,
      };

      break;
    case 'info':
      alertComponent = {
        icon: InfoIcon,
        color: '#0950C5',
        bgColor: '#f6f8ff',
        crossIcon: InfoCross,
      };

      break;
    case 'success':
      alertComponent = {
        icon: SuccessIcon,
        color: '#1D7C4D',
        bgColor: '#f5fbf8',
        crossIcon: SuccessCross,
      };

      break;
    case 'warning':
      alertComponent = {
        icon: WarningIcon,
        color: '#F59638',
        bgColor: '#fff5eb',
        crossIcon: WarningCross,
      };

      break;
    case 'error':
      alertComponent = {
        icon: ErrorIcon,
        color: '#CB2531',
        bgColor: '#fcf0f1',
        crossIcon: ErrorCross,
      };

      break;
  }

  const handleCrossClick = () => setIsAlertVisible(false);

  return (
    <>
      <div
        className="alert-container"
        style={{
          backgroundColor: alertComponent.bgColor,
          display: isAlertVisible ? 'flex' : 'none',
        }}>
        <div className="alert-content">
          <Icon
            className="align-middle"
            component={alertComponent.icon}
            style={{ fontSize: '25px' }}
          />
          <p style={{ color: alertComponent.color }}>{message}</p>
        </div>
        <button className="cross-icon" onClick={handleCrossClick}>
          <Icon
            className="align-middle"
            component={alertComponent.crossIcon}
            style={{ fontSize: '14px' }}
          />
        </button>
      </div>
    </>
  );
};

export default AlertBar;
