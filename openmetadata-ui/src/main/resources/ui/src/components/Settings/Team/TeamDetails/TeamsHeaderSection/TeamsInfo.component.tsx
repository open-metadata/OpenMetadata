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
import { Button, Divider, Form, Input, Space, Typography } from 'antd';
import { Tooltip } from '../../../../common/AntdCompat';;
import { isEmpty, last } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
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
import './teams-info.less';
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
      <Space align="start" className="d-flex flex-col gap-2">
        <div className="d-flex gap-1">
          <Typography.Text className="text-sm font-medium teams-info-heading">{`${t(
            'label.email'
          )}`}</Typography.Text>
          {hasEditPermission && (
            <Tooltip
              title={t('label.edit-entity', {
                entity: t('label.email'),
              })}>
              <Button
                className="flex-center teams-info-email-edit-button p-0"
                data-testid="edit-email"
                icon={
                  <EditIcon
                    color={DE_ACTIVE_COLOR}
                    {...ICON_DIMENSION}
                    width="12px"
                  />
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
        </div>
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
            <Typography.Text
              className="font-medium text-sm teams-info-value"
              data-testid="email-value">
              {email ?? NO_DATA_PLACEHOLDER}
            </Typography.Text>
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
      <>
        <Divider className="vertical-divider" type="vertical" />
        <Space align="start" className="d-flex flex-col gap-2">
          <div className="d-flex  gap-2">
            <Typography.Text className="text-sm font-medium teams-info-heading ">
              {`${t('label.type')}`}
            </Typography.Text>
            {hasEditPermission && !showTypeSelector && !isGroupType && (
              <Tooltip
                title={t('label.edit-entity', {
                  entity: t('label.team-type'),
                })}>
                <Button
                  className="flex-center edit-team-type-icon p-0"
                  data-testid="edit-team-type-icon"
                  icon={
                    <EditIcon
                      color={DE_ACTIVE_COLOR}
                      {...ICON_DIMENSION}
                      width={12}
                    />
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
          </div>

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
            <Typography.Text className="font-medium" data-testid="team-type">
              {teamType}
            </Typography.Text>
          )}
        </Space>
      </>
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
    <Space className="teams-info-header-container" size={0}>
      <DomainLabel
        headerLayout
        multiple
        domains={currentTeam?.domains ?? []}
        entityFqn={fullyQualifiedName ?? ''}
        entityId={id ?? ''}
        entityType={EntityType.TEAM}
        hasPermission={hasEditPermission}
      />
      <Divider className="vertical-divider" type="vertical" />
      <OwnerLabel
        className="text-sm"
        hasPermission={hasAccess}
        isCompactView={false}
        owners={owners}
        onUpdate={updateOwner}
      />
      <Divider className="vertical-divider" type="vertical" />
      {emailRender}

      <Divider className="vertical-divider" type="vertical" />
      <TeamsSubscription
        hasEditPermission={hasEditSubscriptionPermission}
        subscription={currentTeam.profile?.subscription}
        updateTeamSubscription={updateTeamSubscription}
      />
      {teamTypeElement}

      <Divider className="vertical-divider" type="vertical" />

      <Space align="start" className="d-flex flex-col gap-2">
        <Typography.Text className="teams-info-heading text-sm font-medium d-flex items-center">
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
        </Typography.Text>

        <Typography.Text
          className="teams-info-value text-sm font-medium text-secondary-new"
          data-testid="team-user-count">
          {currentTeam.userCount}
        </Typography.Text>
      </Space>
    </Space>
  );
};

export default TeamsInfo;
