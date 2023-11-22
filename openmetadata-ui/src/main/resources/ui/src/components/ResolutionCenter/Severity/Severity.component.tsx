/*
 *  Copyright 2023 Collate.
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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Space } from 'antd';
import classNames from 'classnames';
import { capitalize } from 'lodash';
import React, { useCallback, useState } from 'react';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import AppBadge from '../../common/Badge/Badge.component';
import { SeverityProps } from './Severity.interface';
import SeverityModal from './SeverityModal.component';

const Severity = ({ severity, onSubmit }: SeverityProps) => {
  const label = severity || 'severity_3';
  const [isEditSeverity, setIsEditSeverity] = useState<boolean>(false);

  const onEditSeverity = useCallback(() => setIsEditSeverity(true), []);
  const onCancel = useCallback(() => setIsEditSeverity(false), []);

  const handleSubmit = useCallback(
    async (data) => {
      await onSubmit(data);
      onCancel();
    },
    [onCancel, onSubmit]
  );

  return (
    <>
      <Space align="center">
        <AppBadge
          className={classNames('severity', label)}
          label={capitalize(label)}
        />
        <Icon
          component={EditIcon}
          data-testid="edit-description-icon"
          style={{ color: DE_ACTIVE_COLOR }}
          onClick={onEditSeverity}
        />
      </Space>

      {isEditSeverity && (
        <SeverityModal
          initialSeverity={label}
          onCancel={onCancel}
          onSubmit={handleSubmit}
        />
      )}
    </>
  );
};

export default Severity;
