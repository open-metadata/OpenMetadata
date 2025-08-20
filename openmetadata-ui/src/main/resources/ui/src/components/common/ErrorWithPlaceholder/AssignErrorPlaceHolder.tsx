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
import { useTranslation } from 'react-i18next';
import AddPlaceHolderIcon from '../../../assets/svg/add-placeholder.svg?react';
import PermissionErrorPlaceholder from './PermissionErrorPlaceholder';
import { AssignPlaceholderProps } from './placeholder.interface';

const AssignErrorPlaceHolder = ({
  size,
  className,
  permission,
  heading,
  button,
  children,
  permissionValue,
}: AssignPlaceholderProps) => {
  const { t } = useTranslation();

  if (!permission) {
    return (
      <PermissionErrorPlaceholder
        className={className}
        permissionValue={permissionValue}
        size={size}
      />
    );
  }

  return (
    <div
      className={classNames(
        className,
        'h-full flex-center border-default border-radius-sm bg-white'
      )}
      data-testid={`assign-error-placeholder-${heading}`}>
      <Space align="center" className="w-full" direction="vertical" size={10}>
        <AddPlaceHolderIcon
          data-testid="no-data-image"
          height={size}
          width={size}
        />
        <div className="text-center text-sm font-normal">
          <Typography.Paragraph className="w-max-600">
            {children ??
              t('message.adding-new-entity-is-easy-just-give-it-a-spin', {
                entity: heading,
              })}
          </Typography.Paragraph>

          {button}
        </div>
      </Space>
    </div>
  );
};

export default AssignErrorPlaceHolder;
