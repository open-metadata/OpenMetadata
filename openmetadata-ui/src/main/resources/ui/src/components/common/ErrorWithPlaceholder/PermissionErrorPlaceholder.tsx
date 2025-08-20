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
import NoAccessPlaceHolderIcon from '../../../assets/svg/add-placeholder.svg?react';
import { SIZE } from '../../../enums/common.enum';
import { Transi18next } from '../../../utils/CommonUtils';
import { PermissionPlaceholderProps } from './placeholder.interface';

const PermissionErrorPlaceholder = ({
  size = SIZE.LARGE,
  className,
  permissionValue,
}: PermissionPlaceholderProps) => {
  return (
    <div
      className={classNames(
        'full-height flex-center border-default border-radius-sm bg-white',
        className
      )}>
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
          <Typography.Paragraph className="w-68" style={{ marginBottom: '0' }}>
            <Transi18next
              i18nKey="message.no-access-placeholder"
              renderElement={<b />}
              values={{
                entity: permissionValue,
              }}
            />
          </Typography.Paragraph>
        </div>
      </Space>
    </div>
  );
};

export default PermissionErrorPlaceholder;
