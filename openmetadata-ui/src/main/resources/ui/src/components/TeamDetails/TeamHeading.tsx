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

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Input, Space, Tooltip, Typography } from 'antd';
import { ReactComponent as IconEdit } from 'assets/svg/edit-new.svg';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import { Team } from 'generated/entity/teams/team';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface TeamHeadingProps {
  currentTeam: Team;
  isActionAllowed: boolean;
  updateTeamHandler: (
    data: Team,
    fetchTeam?: boolean | undefined
  ) => Promise<void>;
  entityPermissions: OperationPermission;
}

function TeamHeading({
  currentTeam,
  entityPermissions,
  isActionAllowed,
  updateTeamHandler,
}: TeamHeadingProps) {
  const { t } = useTranslation();
  const [heading, setHeading] = useState(
    currentTeam ? currentTeam.displayName : ''
  );
  const [isHeadingEditing, setIsHeadingEditing] = useState(false);

  const handleHeadingSave = () => {
    if (heading && currentTeam) {
      const updatedData: Team = {
        ...currentTeam,
        displayName: heading,
      };

      updateTeamHandler(updatedData);
      setIsHeadingEditing(false);
    }
  };

  useEffect(() => {
    setHeading(currentTeam.displayName || currentTeam.name);
  }, [currentTeam]);

  return (
    <Typography.Title data-testid="team-heading" level={5}>
      {isHeadingEditing ? (
        <Space align="center" size={4}>
          <Input
            className="w-64"
            data-testid="synonyms"
            id="synonyms"
            name="synonyms"
            placeholder={t('message.enter-comma-separated-field', {
              field: t('label.term-lowercase'),
            })}
            type="text"
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
          />
          <Space data-testid="buttons" size={4}>
            <Button
              className="p-xss rounded-4"
              data-testid="cancelAssociatedTag"
              type="primary"
              onMouseDown={() => setIsHeadingEditing(false)}>
              <CloseOutlined />
            </Button>
            <Button
              className="p-xss rounded-4"
              data-testid="saveAssociatedTag"
              type="primary"
              onMouseDown={handleHeadingSave}>
              <CheckOutlined />
            </Button>
          </Space>
        </Space>
      ) : (
        <Space className="m-b-xs" data-testid="team-heading" size={4}>
          <Typography.Title
            className="m-b-0"
            ellipsis={{ rows: 1, tooltip: true }}
            level={5}>
            {heading}
          </Typography.Title>
          {isActionAllowed && (
            <Tooltip
              placement="bottomLeft"
              title={
                entityPermissions.EditAll || entityPermissions.EditDisplayName
                  ? t('label.edit-entity', {
                      entity: t('label.display-name'),
                    })
                  : t('message.no-permission-for-action')
              }>
              <Button
                className="p-0"
                data-testid="edit-synonyms"
                disabled={
                  !(
                    entityPermissions.EditDisplayName ||
                    entityPermissions.EditAll
                  )
                }
                icon={<IconEdit height={16} width={16} />}
                size="small"
                type="text"
                onClick={() => setIsHeadingEditing(true)}
              />
            </Tooltip>
          )}
        </Space>
      )}
    </Typography.Title>
  );
}

export default TeamHeading;
