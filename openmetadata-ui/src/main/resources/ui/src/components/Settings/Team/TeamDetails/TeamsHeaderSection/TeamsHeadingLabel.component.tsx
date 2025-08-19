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
import {
  CheckOutlined,
  CloseOutlined,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import { Button, Input, Space, Typography } from 'antd';
import { Tooltip } from '../../../../common/AntdCompat';;
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../../../constants/constants';
import { Team } from '../../../../../generated/entity/teams/team';
import { useAuth } from '../../../../../hooks/authHooks';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import { hasEditAccess } from '../../../../../utils/CommonUtils';
import { getEntityName } from '../../../../../utils/EntityUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import { TeamsHeadingLabelProps } from '../team.interface';

const TeamsHeadingLabel = ({
  currentTeam,
  updateTeamHandler,
  entityPermissions,
}: TeamsHeadingLabelProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isHeadingEditing, setIsHeadingEditing] = useState(false);
  const [heading, setHeading] = useState(
    currentTeam ? currentTeam.displayName : ''
  );
  const { isAdminUser } = useAuth();
  const { currentUser } = useApplicationStore();
  const { owners } = useMemo(() => currentTeam, [currentTeam]);

  const isCurrentTeamOwner = useMemo(
    () => currentUser && hasEditAccess(owners ?? [], currentUser),
    [owners, currentUser]
  );

  const { hasEditDisplayNamePermission, hasAccess } = useMemo(
    () => ({
      hasEditPermission: entityPermissions.EditAll,
      hasEditDisplayNamePermission:
        entityPermissions.EditDisplayName || entityPermissions.EditAll,
      hasAccess: isAdminUser,
    }),

    [entityPermissions]
  );

  const onHeadingSave = async (): Promise<void> => {
    if (isEmpty(heading)) {
      return showErrorToast(
        t('label.field-required', {
          field: t('label.display-name'),
        })
      );
    }
    if (currentTeam) {
      setIsLoading(true);
      const updatedData: Team = {
        ...currentTeam,
        displayName: heading,
      };

      await updateTeamHandler(updatedData);
      setIsLoading(false);
    }
    setIsHeadingEditing(false);
  };

  const handleClose = useCallback(() => {
    setHeading(currentTeam ? getEntityName(currentTeam) : '');
    setIsHeadingEditing(false);
  }, [currentTeam]);

  const teamHeadingRender = useMemo(
    () =>
      isHeadingEditing ? (
        // Used onClick stop click propagation event anywhere in the component to parent
        // TeamDetailsV1 component collapsible panel
        <Space onClick={(e) => e.stopPropagation()}>
          <Input
            className="w-48"
            data-testid="team-name-input"
            placeholder={t('message.enter-comma-separated-field', {
              field: t('label.term-lowercase'),
            })}
            type="text"
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
          />
          <Space data-testid="buttons" size={4}>
            <Button
              className="rounded-4 text-sm p-xss"
              data-testid="cancelAssociatedTag"
              disabled={isLoading}
              type="primary"
              onMouseDown={handleClose}>
              <CloseOutlined />
            </Button>
            <Button
              className="rounded-4 text-sm p-xss"
              data-testid="saveAssociatedTag"
              loading={isLoading}
              type="primary"
              onMouseDown={onHeadingSave}>
              <CheckOutlined />
            </Button>
          </Space>
        </Space>
      ) : (
        <>
          <>
            {heading ? (
              <Typography.Title
                className="m-b-0 w-max-200"
                data-testid="team-heading"
                ellipsis={{ tooltip: true }}
                level={5}>
                {heading}
              </Typography.Title>
            ) : (
              <Typography.Text
                className="m-b-0 text-grey-muted text-sm"
                data-testid="team-heading">
                {t('label.no-entity', {
                  entity: t('label.display-name'),
                })}
              </Typography.Text>
            )}
            {(hasAccess || isCurrentTeamOwner) && !currentTeam.deleted && (
              <Tooltip
                placement="right"
                title={
                  hasEditDisplayNamePermission
                    ? t('label.edit-entity', {
                        entity: t('label.display-name'),
                      })
                    : t('message.no-permission-for-action')
                }>
                <Button
                  className="p-0 edit-team-name flex-center"
                  data-testid="edit-team-name"
                  disabled={!hasEditDisplayNamePermission}
                  icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
                  size="small"
                  type="text"
                  onClick={(e) => {
                    // Used to stop click propagation event to parent TeamDetailV1 collapsible panel
                    e.stopPropagation();
                    setIsHeadingEditing(true);
                  }}
                />
              </Tooltip>
            )}
          </>
          {currentTeam.deleted && (
            <div
              className="deleted-badge-button text-xs flex-center"
              data-testid="deleted-badge">
              <ExclamationCircleFilled className="m-r-xss" />
              {t('label.deleted')}
            </div>
          )}
        </>
      ),
    [
      heading,
      isHeadingEditing,
      hasEditDisplayNamePermission,
      currentTeam,
      isLoading,
    ]
  );

  useEffect(() => {
    if (currentTeam) {
      setHeading(currentTeam.displayName ?? currentTeam.name);
    }
  }, [currentTeam]);

  return <Space size={4}>{teamHeadingRender}</Space>;
};

export default TeamsHeadingLabel;
