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
import Icon, {
  CheckOutlined,
  CloseOutlined,
  ExclamationCircleFilled,
} from '@ant-design/icons';
import { Button, Col, Input, Space, Tooltip, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../../assets/svg/edit-new.svg';
import { Team } from '../../../../../generated/entity/teams/team';
import { useAuth } from '../../../../../hooks/authHooks';
import { hasEditAccess } from '../../../../../utils/CommonUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import { useAuthContext } from '../../../../Auth/AuthProviders/AuthProvider';
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
  const { currentUser } = useAuthContext();
  const { owner } = useMemo(() => currentTeam, [currentTeam]);

  const isCurrentTeamOwner = useMemo(
    () =>
      currentUser &&
      hasEditAccess(owner?.type ?? '', owner?.id ?? '', currentUser),
    [owner]
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
    setHeading(currentTeam ? currentTeam.displayName : '');
    setIsHeadingEditing(false);
  }, [currentTeam.displayName]);

  const teamHeadingRender = useMemo(
    () =>
      isHeadingEditing ? (
        <Space>
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
        <Space align="center">
          <Space align="baseline">
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
                <Icon
                  className="align-middle"
                  component={EditIcon}
                  data-testid="edit-team-name"
                  disabled={!hasEditDisplayNamePermission}
                  style={{ fontSize: '16px' }}
                  onClick={() => setIsHeadingEditing(true)}
                />
              </Tooltip>
            )}
          </Space>
          {currentTeam.deleted && (
            <Col className="text-xs">
              <div className="deleted-badge-button" data-testid="deleted-badge">
                <ExclamationCircleFilled className="m-r-xss font-medium text-xs" />
                {t('label.deleted')}
              </div>
            </Col>
          )}
        </Space>
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
