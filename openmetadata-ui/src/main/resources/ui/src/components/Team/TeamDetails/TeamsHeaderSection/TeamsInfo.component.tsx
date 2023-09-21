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
import React, { useMemo, useState } from 'react';

import Icon from '@ant-design/icons/lib/components/Icon';
import { useAuthContext } from 'components/authentication/auth-provider/AuthProvider';
import EntitySummaryDetails from 'components/common/EntitySummaryDetails/EntitySummaryDetails';
import { OwnerLabel } from 'components/common/OwnerLabel/OwnerLabel.component';
import { EMAIL_REG_EX } from 'constants/regex.constants';
import { useAuth } from 'hooks/authHooks';
import { isUndefined } from 'lodash';
import { useTranslation } from 'react-i18next';
import { hasEditAccess } from 'utils/CommonUtils';
import { ReactComponent as IconEdit } from '../../../../assets/svg/edit-new.svg';
import { TeamsInfoProps } from '../team.interface';

const TeamsInfo = ({
  isOrganization,
  isGroupType,
  childTeamsCount,
  heading,
  entityPermissions,
  currentTeam,
  currentUser,
  joinTeam,
  updateOwner,
  updateTeamType,
  deleteUserHandler,
  onChangeHeading,
  handleHeadingSave,
  handleUpdateEmail,
}: TeamsInfoProps) => {
  const { t } = useTranslation();

  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();

  const [isHeadingEditing, setIsHeadingEditing] = useState(false);
  const [isEmailEdit, setIsEmailEdit] = useState<boolean>(false);

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
    await handleHeadingSave();
    setIsHeadingEditing(false);
  };

  const onEmailSave: FormProps['onFinish'] = async (data): Promise<void> => {
    await handleUpdateEmail(data.email);
    setIsEmailEdit(false);
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
            onChange={onChangeHeading}
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
                component={IconEdit}
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
              component={IconEdit}
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

  const summaryDetailsRender = useMemo(
    () =>
      !isOrganization && (
        <EntitySummaryDetails
          allowTeamOwner={false}
          currentOwner={owner}
          data={{
            key: 'TeamType',
            value: teamType ?? '',
          }}
          isGroupType={isGroupType}
          showGroupOption={!childTeamsCount}
          teamType={teamType}
          updateTeamType={hasEditPermission ? updateTeamType : undefined}
        />
      ),
    [
      isOrganization,
      owner,
      teamType,
      isGroupType,
      childTeamsCount,
      hasEditPermission,
    ]
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
      {summaryDetailsRender}
      {teamActionButton}
    </Space>
  );
};

export default TeamsInfo;
