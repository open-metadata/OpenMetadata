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
import React, { useMemo, useState } from 'react';
import { ReactComponent as ErrorCross } from '../../assets/svg/error-cross.svg';
import { ReactComponent as CrossIcon } from '../../assets/svg/ic-cross.svg';
import { ReactComponent as ErrorIcon } from '../../assets/svg/ic-error.svg';
import { ReactComponent as GeneralIcon } from '../../assets/svg/ic-general.svg';
import { ReactComponent as InfoIcon } from '../../assets/svg/ic-info-tag.svg';
import { ReactComponent as SuccessIcon } from '../../assets/svg/ic-success.svg';
import { ReactComponent as WarningIcon } from '../../assets/svg/ic-warning-tag.svg';
import { ReactComponent as InfoCross } from '../../assets/svg/info-cross.svg';
import { ReactComponent as SuccessCross } from '../../assets/svg/success-cross.svg';
import { ReactComponent as WarningCross } from '../../assets/svg/warning-cross.svg';
import './alert-bar.style.less';

const AlertBar = ({
  type = 'general',
  message = '',
}: AlertBarProps): JSX.Element => {
  const [isAlertVisible, setIsAlertVisible] = useState(true);

  const alertComponent = useMemo(() => {
    switch (type) {
      case 'general':
        return {
          icon: GeneralIcon,
          className: 'general',
          crossIcon: CrossIcon,
        };

      case 'info':
        return {
          icon: InfoIcon,
          className: 'info',
          crossIcon: InfoCross,
        };

      case 'success':
        return {
          icon: SuccessIcon,
          className: 'success',
          crossIcon: SuccessCross,
        };

      case 'warning':
        return {
          icon: WarningIcon,
          className: 'warning',
          crossIcon: WarningCross,
        };

      case 'error':
        return {
          icon: ErrorIcon,
          className: 'error',
          crossIcon: ErrorCross,
        };

      default:
        return {
          icon: GeneralIcon,
          className: 'general',
          crossIcon: CrossIcon,
        };
    }
  }, [type]);

  const handleCrossClick = () => setIsAlertVisible(false);

  return (
    <>
      <div
        className={`alert-container ${alertComponent.className}`}
        style={{ display: isAlertVisible ? 'flex' : 'none' }}>
        <div className="alert-content">
          <Icon
            className="align-middle"
            component={alertComponent.icon}
            style={{ fontSize: '25px' }}
          />
          <p>{message}</p>
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
