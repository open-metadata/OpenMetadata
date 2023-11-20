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
import { Space, Typography } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as NoAccessPlaceHolderIcon } from '../../../assets/svg/no-access-placeholder.svg';
import { SIZE } from '../../../enums/common.enum';
import { PermissionPlaceholderProps } from './placeholder.interface';

const PermissionErrorPlaceholder = ({
  size = SIZE.LARGE,
  className,
}: PermissionPlaceholderProps) => {
  const { t } = useTranslation();

  return (
    <div className={classNames('h-full flex-center', className)}>
      <Space
        align="center"
        data-testid="permission-error-placeholder"
        direction="vertical"
        size="small">
        <NoAccessPlaceHolderIcon
          data-testid="no-data-image"
          height={size}
          width={size}
        />
        <div className="text-center text-sm font-normal">
          <Typography.Paragraph className="w-80" style={{ marginBottom: '0' }}>
            {t('message.no-access-placeholder')}
          </Typography.Paragraph>
        </div>
      </Space>
    </div>
  );
};

export default PermissionErrorPlaceholder;
