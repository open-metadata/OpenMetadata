/*
 *  Copyright 2022 Collate.
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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Input, Space, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SVGIcons from '../../../utils/SvgUtils';
import { DisplayNameComponentProps } from './DisplayNameComponent.interface';
import './DisplayNameComponent.style.less';

const DisplayNameComponent = ({
  isDisplayNameEdit,
  displayName,
  onDisplayNameChange,
  handleDisplayNameChange,
  displayNamePermission,
  editAllPermission,
  setIsDisplayNameEdit,
}: DisplayNameComponentProps) => {
  const { t } = useTranslation();

  return (
    <div className="mt-4 w-full d-flex">
      {isDisplayNameEdit ? (
        <div className="flex items-center gap-2">
          <Input
            className="w-full"
            data-testid="displayName"
            id="displayName"
            name="displayName"
            placeholder={t('label.display-name')}
            value={displayName}
            onChange={onDisplayNameChange}
          />
          <div className="flex justify-end" data-testid="buttons">
            <Button
              className="text-sm mr-1"
              data-testid="cancel-displayName"
              icon={<FontAwesomeIcon className="w-3.5 h-3.5" icon="times" />}
              size="small"
              type="primary"
              onMouseDown={() => setIsDisplayNameEdit(false)}
            />

            <Button
              className="text-sm mr-1"
              data-testid="save-displayName"
              icon={<FontAwesomeIcon className="w-3.5 h-3.5" icon="check" />}
              size="small"
              type="primary"
              onClick={handleDisplayNameChange}
            />
          </div>
        </div>
      ) : (
        <Space>
          {displayName ? (
            <Typography.Title className="display-name" level={5}>
              {displayName}
            </Typography.Title>
          ) : (
            <Typography.Text className="add-display-name">
              {t('label.add-entity', {
                entity: t('label.display-name-lowercase'),
              })}
            </Typography.Text>
          )}
          {(displayNamePermission || editAllPermission) && (
            <button
              className="focus:tw-outline-none m-b-xss"
              data-testid="edit-displayName"
              onClick={() => setIsDisplayNameEdit(true)}>
              <SVGIcons
                alt="edit"
                icon="icon-edit"
                title={t('label.edit')}
                width="16px"
              />
            </button>
          )}
        </Space>
      )}
    </div>
  );
};

export default DisplayNameComponent;
