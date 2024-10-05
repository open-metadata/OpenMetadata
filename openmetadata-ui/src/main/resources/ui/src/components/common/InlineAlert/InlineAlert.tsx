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
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { Alert, Typography } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import React, { useEffect, useMemo } from 'react';
import { ReactComponent as AlertIcon } from '../../../assets/svg/alert.svg';
import { ReactComponent as ErrorExclamationIcon } from '../../../assets/svg/error-exclamation.svg';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import './inline-alert.less';
import { InlineAlertProps } from './InlineAlert.interface';

function InlineAlert({
  alertClassName = '',
  type,
  heading,
  description,
  onClose,
}: Readonly<InlineAlertProps>) {
  const { inlineAlertDetails, setInlineAlertDetails } = useApplicationStore();
  const { alertContainerClass, alertIconClass } = useMemo(
    () => ({
      alertContainerClass: `${type ?? 'default'}-alert`,
      alertIconClass: `${type ?? 'default'}-icon`,
    }),
    [type]
  );

  const alertIcon = useMemo(() => {
    switch (type) {
      case 'error':
        return (
          <ErrorExclamationIcon
            className={classNames('alert-icon', alertIconClass)}
          />
        );
      case 'warning':
        return (
          <AlertIcon className={classNames('alert-icon', alertIconClass)} />
        );

      case 'success':
        return (
          <CheckCircleOutlined
            className={classNames('alert-icon', alertIconClass)}
          />
        );
      case 'info':
      default:
        return (
          <ExclamationCircleOutlined
            className={classNames('alert-icon', alertIconClass)}
          />
        );
    }
  }, [type, alertIconClass]);

  useEffect(() => {
    // Clear the inline alert details when the component is unmounted
    return () => {
      if (!isUndefined(inlineAlertDetails)) {
        setInlineAlertDetails(undefined);
      }
    };
  }, []);

  return (
    <Alert
      closable
      className={classNames(
        'inline-error-container',
        alertContainerClass,
        alertClassName
      )}
      description={
        <div className="d-flex items-start gap-3">
          {alertIcon}
          <div className="d-flex flex-col gap-2">
            <Typography.Text className="font-semibold text-sm">
              {heading}
            </Typography.Text>
            <Typography.Paragraph className="m-b-0 text-sm">
              {description}
            </Typography.Paragraph>
          </div>
        </div>
      }
      type={type}
      onClose={onClose}
    />
  );
}

export default InlineAlert;
