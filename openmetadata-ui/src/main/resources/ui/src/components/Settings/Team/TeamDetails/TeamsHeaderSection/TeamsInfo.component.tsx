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
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Button, Divider, Form, Input, Space, Tooltip, Typography } from 'antd';
import { isEmpty, last } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../../assets/svg/edit-new.svg';
import {
  DE_ACTIVE_COLOR,
  GRAYED_OUT_COLOR,
  ICON_DIMENSION,
  NO_DATA_PLACEHOLDER,
} from '../../../../../constants/constants';
import { EMAIL_REG_EX } from '../../../../../constants/regex.constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { Team, TeamType } from '../../../../../generated/entity/teams/team';
import { EntityReference } from '../../../../../generated/entity/type';
import { useAuth } from '../../../../../hooks/authHooks';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
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

  const { currentUser } = useApplicationStore();

  const { email, owners, teamType, id, fullyQualifiedName } = useMemo(
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

  const isUserPartOfCurrentTeam = useMemo<boolean>(() => {
    return owners?.some((owner) => owner.id === currentUser?.id) ?? false;
  }, [owners, currentUser]);

  const hasEditSubscriptionPermission = useMemo(
    () =>
      (entityPermissions.EditAll || isUserPartOfCurrentTeam) && !isTeamDeleted,
    [entityPermissions, isUserPartOfCurrentTeam, isTeamDeleted]
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
    async (owners?: EntityReference[]) => {
      if (currentTeam) {
        const updatedData: Team = {
          ...currentTeam,
          owners,
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
          <Form
            initialValues={{ email }}
            //  Used onClick stop click propagation event anywhere in the form to parent
            //  TeamsDetailV1 collapsible panel
            onClick={(e) => e.stopPropagation()}
            onFinish={onEmailSave}>
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
                title={t('label.edit-entity', {
                  entity: t('label.email'),
                })}>
                <Button
                  className="flex-center p-0"
                  data-testid="edit-email"
                  icon={
                    <EditIcon color={DE_ACTIVE_COLOR} {...ICON_DIMENSION} />
                  }
                  size="small"
                  type="text"
                  onClick={(e) => {
                    // Used to stop click propagation event to parent TeamDetailV1 collapsible panel
                    e.stopPropagation();
                    setIsEmailEdit(true);
                  }}
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

            {hasEditPermission && !isGroupType && (
              <Tooltip
                title={t('label.edit-entity', {
                  entity: t('label.team-type'),
                })}>
                <Button
                  className="flex-center p-0"
                  data-testid="edit-team-type-icon"
                  icon={
                    <EditIcon color={DE_ACTIVE_COLOR} {...ICON_DIMENSION} />
                  }
                  size="small"
                  type="text"
                  onClick={(e) => {
                    // Used to stop click propagation event to parent TeamDetailV1 collapsible panel
                    e.stopPropagation();
                    setShowTypeSelector(true);
                  }}
                />
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
        multiple
        domain={currentTeam.domains}
        entityFqn={fullyQualifiedName ?? ''}
        entityId={id ?? ''}
        entityType={EntityType.TEAM}
        hasPermission={hasEditPermission}
      />
      <Divider type="vertical" />
      <OwnerLabel
        className="text-sm"
        hasPermission={hasAccess}
        owners={owners}
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

      <Divider type="vertical" />

      <Space size={4}>
        <Typography.Text className="text-grey-muted d-flex items-center">
          {t('label.total-user-plural')}
          <Tooltip
            destroyTooltipOnHide
            title={t('message.team-distinct-user-description')}>
            <InfoCircleOutlined
              className="m-x-xss"
              data-testid="helper-icon"
              style={{ color: GRAYED_OUT_COLOR }}
            />
          </Tooltip>
          {' : '}
        </Typography.Text>

        <Typography.Text className="font-medium" data-testid="team-user-count">
          {currentTeam.userCount}
        </Typography.Text>
      </Space>
    </Space>
  );
};

export default TeamsInfo;
