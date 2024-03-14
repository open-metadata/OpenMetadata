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
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../../assets/svg/edit-new.svg';
import { NO_DATA_PLACEHOLDER } from '../../../../../constants/constants';
import { EMAIL_REG_EX } from '../../../../../constants/regex.constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { Team, TeamType } from '../../../../../generated/entity/teams/team';
import { EntityReference } from '../../../../../generated/entity/type';
import { useAuth } from '../../../../../hooks/authHooks';
import { useAuthContext } from '../../../../Auth/AuthProviders/AuthProvider';
import { DomainLabel } from '../../../../common/DomainLabel/DomainLabel.component';
import { OwnerLabel } from '../../../../common/OwnerLabel/OwnerLabel.component';
import TeamTypeSelect from '../../../../common/TeamTypeSelect/TeamTypeSelect.component';
import { SubscriptionWebhook, TeamsInfoProps } from '../team.interface';
import TeamsSubscription from './TeamsSubscription.component';

const TeamsInfo = ({
  parentTeams,
  isGroupType,
  childTeamsCount,
  entityPermissions,
  currentTeam,
  updateTeamHandler,
  isTeamDeleted,
}: TeamsInfoProps) => {
  const { t } = useTranslation();

  const { isAdminUser } = useAuth();

  const [isEmailEdit, setIsEmailEdit] = useState<boolean>(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { currentUser } = useAuthContext();

  const { email, owner, teamType, id, fullyQualifiedName } = useMemo(
    () => currentTeam,
    [currentTeam]
  );

  const { hasEditPermission, hasAccess } = useMemo(
    () => ({
      hasEditPermission: entityPermissions.EditAll && !isTeamDeleted,
      hasAccess: isAdminUser && !isTeamDeleted,
    }),

    [entityPermissions, isTeamDeleted]
  );

  const hasEditSubscriptionPermission = useMemo(
    () =>
      (entityPermissions.EditAll ||
        currentTeam.owner?.id === currentUser?.id) &&
      !isTeamDeleted,
    [entityPermissions, currentTeam, currentUser, isTeamDeleted]
  );

  const onEmailSave = async (data: { email: string }) => {
    if (currentTeam) {
      setIsLoading(true);

      const updatedData: Team = {
        ...currentTeam,
        email: isEmpty(data.email) ? undefined : data.email,
      };

      await updateTeamHandler(updatedData);
      setIsLoading(false);
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

  const updateTeamSubscription = async (data?: SubscriptionWebhook) => {
    if (currentTeam) {
      const updatedData: Team = {
        ...currentTeam,
        profile: {
          subscription: isEmpty(data)
            ? undefined
            : {
                [data?.webhook ?? '']: { endpoint: data?.endpoint },
              },
        },
      };

      await updateTeamHandler(updatedData);
    }
  };

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
                  disabled={isLoading}
                  size="small"
                  type="primary"
                  onClick={() => setIsEmailEdit(false)}>
                  <CloseOutlined />
                </Button>
                <Button
                  className="h-8 p-x-xss"
                  data-testid="save-edit-email"
                  htmlType="submit"
                  loading={isLoading}
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
    [email, isEmailEdit, hasEditPermission, isLoading]
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
              <Tooltip
                title={t('label.edit-entity', {
                  entity: t('label.team-type'),
                })}>
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
              </Tooltip>
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

  return (
    <Space size={0}>
      <DomainLabel
        domain={currentTeam.domain}
        entityFqn={fullyQualifiedName ?? ''}
        entityId={id ?? ''}
        entityType={EntityType.TEAM}
        hasPermission={hasEditPermission}
      />
      <Divider type="vertical" />
      <OwnerLabel
        className="text-sm"
        hasPermission={hasAccess}
        owner={owner}
        onUpdate={updateOwner}
      />
      <Divider type="vertical" />
      {emailRender}

      <Divider type="vertical" />
      <TeamsSubscription
        hasEditPermission={hasEditSubscriptionPermission}
        subscription={currentTeam.profile?.subscription}
        updateTeamSubscription={updateTeamSubscription}
      />
      {teamTypeElement}
    </Space>
  );
};

export default TeamsInfo;
