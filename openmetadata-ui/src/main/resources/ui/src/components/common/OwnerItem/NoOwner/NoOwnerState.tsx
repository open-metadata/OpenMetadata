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
import { ReactComponent as IconUser } from '../../../../assets/svg/user.svg';
import { EntityReference } from '../../../../generated/tests/testCase';
import { UserTeamSelectableList } from '../../UserTeamSelectableList/UserTeamSelectableList.component';

interface NoOwnerStateProps {
  isCompactView: boolean;
  placeHolder?: string;
  owners: EntityReference[];
  hasPermission?: boolean;
  onUpdate?: (owners?: EntityReference[]) => void;
  multiple: {
    user: boolean;
    team: boolean;
  };
  tooltipText?: string;
  className?: string;
}

export const NoOwnerState: React.FC<NoOwnerStateProps> = ({
  isCompactView,
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
    <div className="flex flex-col gap-2">
      <div className="d-flex items-center gap-1">
        {!isCompactView && (
          <div className="owner-avatar-icon d-flex">
            <Icon
              component={IconUser}
              data-testid="no-owner-icon"
              style={{ fontSize: '18px' }}
            />
          </div>
        )}
        <Typography.Text
          className={classNames('no-owner font-medium text-sm', className)}
          data-testid="owner-link">
          {placeHolder ??
            (isCompactView
              ? t('label.owner-plural')
              : t('label.no-entity', {
                  entity: t('label.owner-plural'),
                }))}
        </Typography.Text>
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

      <div className="no-owner-text text-sm font-medium">
        {isCompactView &&
          t('label.no-entity', { entity: t('label.owner-plural') })}
      </div>
    </div>
  );
};
