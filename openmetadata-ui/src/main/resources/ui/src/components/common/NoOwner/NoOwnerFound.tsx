/*
 *  Copyright 2025 Collate.
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
import { Typography } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconUser } from '../../../assets/svg/user.svg';
import { UserTeamSelectableList } from '../UserTeamSelectableList/UserTeamSelectableList.component';
import { NoOwnerFoundProps } from './NoOwnerFound.interface';

export const NoOwnerFound: React.FC<NoOwnerFoundProps> = ({
  isCompactView,
  showLabel = true,
  placeHolder,
  owners,
  hasPermission,
  onUpdate,
  multiple,
  tooltipText,
  className,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={classNames(
        'd-flex justify-start flex-col gap-2',
        { 'owner-label-container': !isCompactView },
        className
      )}
      data-testid="owner-label">
      {(isCompactView || showLabel) && (
        <div className="d-flex items-center gap-1">
          {isCompactView && (
            <div className="owner-avatar-icon d-flex">
              <Icon
                component={IconUser}
                data-testid="no-owner-icon"
                style={{ fontSize: '18px' }}
              />
            </div>
          )}
          {showLabel && (
            <Typography.Text
              className={classNames(
                isCompactView
                  ? 'text-xs no-owner'
                  : ' no-owner-heading font-medium text-sm',
                className
              )}
              data-testid="owner-link">
              {placeHolder ??
                (!isCompactView
                  ? t('label.owner-plural')
                  : t('label.no-entity', {
                      entity: t('label.owner-plural'),
                    }))}
            </Typography.Text>
          )}
          {onUpdate && (
            <UserTeamSelectableList
              hasPermission={Boolean(hasPermission)}
              multiple={multiple}
              owner={owners}
              tooltipText={tooltipText}
              onUpdate={(updatedUsers) => {
                if (onUpdate) {
                  onUpdate(updatedUsers);
                }
              }}
            />
          )}
        </div>
      )}

      {!isCompactView && (
        <div className="no-owner-text text-sm font-medium">
          {placeHolder
            ? showLabel
              ? t('label.no-entity', { entity: placeHolder })
              : placeHolder
            : t('label.no-entity', { entity: t('label.owner-plural') })}
        </div>
      )}
    </div>
  );
};
