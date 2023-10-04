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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Divider, Form, Input, Space, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty, last } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { EMAIL_REG_EX } from '../../../../constants/regex.constants';
import { Team, TeamType } from '../../../../generated/entity/teams/team';
import { EntityReference } from '../../../../generated/entity/type';
import { useAuth } from '../../../../hooks/authHooks';
import { hasEditAccess } from '../../../../utils/CommonUtils';
import { useAuthContext } from '../../../authentication/auth-provider/AuthProvider';
import { OwnerLabel } from '../../../common/OwnerLabel/OwnerLabel.component';
import TeamTypeSelect from '../../../common/TeamTypeSelect/TeamTypeSelect.component';
import { TeamsInfoProps } from '../team.interface';

const TeamsInfo = ({
  parentTeams,
  isGroupType,
  childTeamsCount,
  entityPermissions,
  currentTeam,
  updateTeamHandler,
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

  const { email, owner, teamType } = useMemo(() => currentTeam, [currentTeam]);

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

  const onEmailSave = async (data: { email: string }) => {
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
    async (owner?: EntityReference) => {
      if (currentTeam) {
        const updatedData: Team = {
          ...currentTeam,
          owner,
        };

        await updateTeamHandler(updatedData);
      }
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
            className="m-b-0 w-max-200"
            data-testid="team-heading"
            ellipsis={{ tooltip: true }}
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
      ),
    [heading, isHeadingEditing, hasEditDisplayNamePermission]
  );

  const emailRender = useMemo(
    () => (
      <Space align="center" size={4}>
        <Typography.Text className="text-grey-muted">{`${t(
          'label.email'
        )} :`}</Typography.Text>
        {isEmailEdit ? (
          <Form initialValues={{ email }} onFinish={onEmailSave}>
            <Space align="baseline">
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
                  className="w-48"
                  data-testid="email-input"
                  placeholder={t('label.enter-entity', {
                    entity: t('label.email-lowercase'),
                  })}
                />
              </Form.Item>
              <Space size={4}>
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
          <Space align="center">
            <Typography.Text className="font-medium" data-testid="email-value">
              {email ?? NO_DATA_PLACEHOLDER}
            </Typography.Text>
            {hasEditPermission && (
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
                  className="toolbar-button align-middle"
                  component={EditIcon}
                  data-testid="edit-email"
                  style={{ fontSize: '16px' }}
                  onClick={() => setIsEmailEdit(true)}
                />
              </Tooltip>
            )}
          </Space>
        )}
      </Space>
    ),
    [email, isEmailEdit, hasEditPermission]
  );

  const teamTypeElement = useMemo(() => {
    if (teamType === TeamType.Organization) {
      return null;
    }

    return (
      <Space size={4}>
        <Divider type="vertical" />
        <Typography.Text className="text-grey-muted">
          {`${t('label.type')} :`}
        </Typography.Text>
        {showTypeSelector ? (
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
            <Typography.Text className="font-medium" data-testid="team-type">
              {teamType}
            </Typography.Text>

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
    <Space size={4}>
      {teamHeadingRender}
      <Divider type="vertical" />
      <OwnerLabel
        className="text-sm"
        hasPermission={hasAccess}
        owner={owner}
        onUpdate={updateOwner}
      />
      <Divider type="vertical" />
      {emailRender}
      {teamTypeElement}
    </Space>
  );
};

export default TeamsInfo;
