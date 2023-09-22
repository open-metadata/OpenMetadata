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
import {
  Button,
  Form,
  FormProps,
  Input,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import Icon from '@ant-design/icons/lib/components/Icon';
import { useAuthContext } from 'components/authentication/auth-provider/AuthProvider';
import { OwnerLabel } from 'components/common/OwnerLabel/OwnerLabel.component';
import { EMAIL_REG_EX } from 'constants/regex.constants';
import { useAuth } from 'hooks/authHooks';
import { isEmpty, isUndefined, last } from 'lodash';
import { useTranslation } from 'react-i18next';
import { hasEditAccess } from 'utils/CommonUtils';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';

import classNames from 'classnames';
import TeamTypeSelect from 'components/common/TeamTypeSelect/TeamTypeSelect.component';
import { Team, TeamType } from 'generated/entity/teams/team';
import { EntityReference } from 'generated/entity/type';
import { TeamsInfoProps } from '../team.interface';

const TeamsInfo = ({
  parentTeams,
  isOrganization,
  isGroupType,
  childTeamsCount,
  entityPermissions,
  currentTeam,
  currentUser,
  joinTeam,
  updateTeamHandler,
  deleteUserHandler,
}: TeamsInfoProps) => {
  const { t } = useTranslation();

  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();

  const [isHeadingEditing, setIsHeadingEditing] = useState(false);
  const [isEmailEdit, setIsEmailEdit] = useState<boolean>(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [heading, setHeading] = useState(
    currentTeam ? currentTeam.displayName : ''
  );

  const { id, email, owner, isJoinable, teamType } = useMemo(
    () => currentTeam,
    [currentTeam]
  );

  const { hasEditPermission, hasEditDisplayNamePermission, hasAccess } =
    useMemo(
      () => ({
        hasEditPermission: entityPermissions.EditAll,
        hasEditDisplayNamePermission:
          entityPermissions.EditDisplayName || entityPermissions.EditAll,
        hasAccess: isAuthDisabled || isAdminUser,
      }),

      [entityPermissions]
    );

  const isAlreadyJoinedTeam = useMemo(
    () => currentUser?.teams?.find((team) => team.id === id),
    [id, currentUser]
  );

  /**
   * Check if current team is the owner or not
   * @returns - True true or false based on hasEditAccess response
   */
  const isCurrentTeamOwner = useMemo(
    () => hasEditAccess(owner?.type ?? '', owner?.id ?? ''),
    [owner]
  );

  const onHeadingSave = async (): Promise<void> => {
    if (heading && currentTeam) {
      const updatedData: Team = {
        ...currentTeam,
        displayName: heading,
      };

      await updateTeamHandler(updatedData);
    }
    setIsHeadingEditing(false);
  };

  const onEmailSave: FormProps['onFinish'] = async (data): Promise<void> => {
    if (currentTeam) {
      const updatedData: Team = {
        ...currentTeam,
        email: isEmpty(data.email) ? undefined : data.email,
      };

      await updateTeamHandler(updatedData);
    }
    setIsEmailEdit(false);
  };

  const updateOwner = useCallback(
    (owner?: EntityReference) => {
      if (currentTeam) {
        const updatedData: Team = {
          ...currentTeam,
          owner,
        };

        return updateTeamHandler(updatedData);
      }

      return Promise.reject();
    },
    [currentTeam]
  );

  const updateTeamType = async (type: TeamType): Promise<void> => {
    if (currentTeam) {
      const updatedData: Team = {
        ...currentTeam,
        teamType: type,
      };

      await updateTeamHandler(updatedData);

      setShowTypeSelector(false);
    }
  };

  const teamHeadingRender = useMemo(
    () =>
      isHeadingEditing ? (
        <Space size="middle">
          <Input
            className="w-64"
            data-testid="team-name-input"
            placeholder={t('message.enter-comma-separated-field', {
              field: t('label.term-lowercase'),
            })}
            type="text"
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
          />
          <Space data-testid="buttons">
            <Button
              className="rounded-4 text-sm p-xss"
              data-testid="cancelAssociatedTag"
              type="primary"
              onMouseDown={() => setIsHeadingEditing(false)}>
              <CloseOutlined />
            </Button>
            <Button
              className="rounded-4 text-sm p-xss"
              data-testid="saveAssociatedTag"
              type="primary"
              onMouseDown={onHeadingSave}>
              <CheckOutlined />
            </Button>
          </Space>
        </Space>
      ) : (
        <Space align="baseline">
          <Typography.Title
            className="m-b-0"
            data-testid="team-heading"
            ellipsis={{ rows: 1, tooltip: true }}
            level={5}>
            {heading}
          </Typography.Title>
          {(hasAccess || isCurrentTeamOwner) && (
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
                component={EditIcon}
                data-testid="edit-team-name"
                disabled={!hasEditDisplayNamePermission}
                style={{ fontSize: '16px' }}
                onClick={() => setIsHeadingEditing(true)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    [heading, isHeadingEditing, hasEditDisplayNamePermission]
  );

  const emailRender = useMemo(
    () =>
      isEmailEdit ? (
        <Form initialValues={{ email }} onFinish={onEmailSave}>
          <Space align="baseline" size="middle">
            <Form.Item
              className="m-b-0"
              name="email"
              rules={[
                {
                  pattern: EMAIL_REG_EX,
                  type: 'email',
                  message: t('message.field-text-is-invalid', {
                    fieldText: t('label.email'),
                  }),
                },
              ]}>
              <Input
                className="w-64"
                data-testid="email-input"
                placeholder={t('label.enter-entity', {
                  entity: t('label.email-lowercase'),
                })}
              />
            </Form.Item>
            <Space>
              <Button
                className="h-8 p-x-xss"
                data-testid="cancel-edit-email"
                size="small"
                type="primary"
                onClick={() => setIsEmailEdit(false)}>
                <CloseOutlined />
              </Button>
              <Button
                className="h-8 p-x-xss"
                data-testid="save-edit-email"
                htmlType="submit"
                size="small"
                type="primary">
                <CheckOutlined />
              </Button>
            </Space>
          </Space>
        </Form>
      ) : (
        <Space align="baseline">
          <Typography.Text data-testid="email-value">
            {email ?? t('label.no-entity', { entity: t('label.email') })}
          </Typography.Text>
          <Tooltip
            placement="right"
            title={
              hasEditPermission
                ? t('label.edit-entity', {
                    entity: t('label.email'),
                  })
                : t('message.no-permission-for-action')
            }>
            <Icon
              className="toolbar-button"
              component={EditIcon}
              data-testid="edit-email"
              disabled={!hasEditPermission}
              style={{ fontSize: '16px' }}
              onClick={() => setIsEmailEdit(true)}
            />
          </Tooltip>
        </Space>
      ),
    [email, isEmailEdit, hasEditPermission]
  );

  const teamActionButton = useMemo(
    () =>
      !isOrganization &&
      !isUndefined(currentUser) &&
      (isAlreadyJoinedTeam ? (
        <Button
          ghost
          className="m-t-xs"
          data-testid="leave-team-button"
          type="primary"
          onClick={() => deleteUserHandler(currentUser.id, true)}>
          {t('label.leave-team')}
        </Button>
      ) : (
        (Boolean(isJoinable) || hasAccess) && (
          <Button
            className="m-t-xs"
            data-testid="join-teams"
            type="primary"
            onClick={joinTeam}>
            {t('label.join-team')}
          </Button>
        )
      )),

    [currentUser, isAlreadyJoinedTeam, isJoinable, hasAccess]
  );

  const teamTypeElement = useMemo(() => {
    if (teamType === TeamType.Organization) {
      return null;
    }

    return (
      <Space size={4}>
        {t('label.type') + ' - '}
        {teamType ? (
          showTypeSelector ? (
            <TeamTypeSelect
              handleShowTypeSelector={setShowTypeSelector}
              parentTeamType={
                last(parentTeams)?.teamType ?? TeamType.Organization
              }
              showGroupOption={!childTeamsCount}
              teamType={teamType ?? TeamType.Department}
              updateTeamType={hasEditPermission ? updateTeamType : undefined}
            />
          ) : (
            <>
              {teamType}
              {hasEditPermission && (
                <Icon
                  className={classNames('vertical-middle m-l-xs', {
                    'opacity-50': isGroupType,
                  })}
                  data-testid="edit-team-type-icon"
                  title={
                    isGroupType
                      ? t('message.group-team-type-change-message')
                      : t('label.edit-entity', {
                          entity: t('label.team-type'),
                        })
                  }
                  onClick={
                    isGroupType ? undefined : () => setShowTypeSelector(true)
                  }>
                  <EditIcon />
                </Icon>
              )}
            </>
          )
        ) : (
          <span>{teamType}</span>
        )}
      </Space>
    );
  }, [
    teamType,
    parentTeams,
    isGroupType,
    childTeamsCount,
    showTypeSelector,
    hasEditPermission,
    updateTeamType,
    setShowTypeSelector,
  ]);

  useEffect(() => {
    if (currentTeam) {
      setHeading(currentTeam.displayName ?? currentTeam.name);
    }
  }, [currentTeam]);

  return (
    <Space className="p-x-sm" direction="vertical">
      {teamHeadingRender}
      {emailRender}
      <OwnerLabel
        className="text-sm"
        hasPermission={hasAccess}
        owner={owner}
        onUpdate={updateOwner}
      />
      {teamTypeElement}
      {teamActionButton}
    </Space>
  );
};

export default TeamsInfo;
