/*
 *  Copyright 2022 Collate.
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

import { Col, Row, Switch, Typography } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import { DROPDOWN_ICON_SIZE_PROPS } from 'constants/ManageButton.constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { t } from 'i18next';
import { PlaceholderProps } from 'interface/teamsAndUsers.interface';
import React from 'react';
import { ReactComponent as IconRestore } from '../assets/svg/ic-restore.svg';
import { ReactComponent as IconOpenLock } from '../assets/svg/open-lock.svg';
import { TeamsPageTab } from '../components/TeamDetails/team.interface';
import { Team } from '../generated/entity/teams/team';
import { Paging } from '../generated/type/paging';
import { filterEntityAssets } from './EntityUtils';

export const getTabs = (
  currentTeam: Team,
  teamUserPaging: Paging,
  isGroupType: boolean,
  isOrganization: boolean,
  teamsCount: number
) => {
  const tabs = {
    teams: {
      name: t('label.team-plural'),
      count: teamsCount,
      key: TeamsPageTab.TEAMS,
    },
    users: {
      name: t('label.user-plural'),
      count: teamUserPaging?.total,
      key: TeamsPageTab.USERS,
    },
    assets: {
      name: t('label.asset-plural'),
      count: filterEntityAssets(currentTeam?.owns || []).length,
      key: TeamsPageTab.ASSETS,
    },
    roles: {
      name: t('label.role-plural'),
      count: currentTeam?.defaultRoles?.length,
      key: TeamsPageTab.ROLES,
    },
    policies: {
      name: t('label.policy-plural'),
      count: currentTeam?.policies?.length,
      key: TeamsPageTab.POLICIES,
    },
  };

  const commonTabs = [tabs.roles, tabs.policies];

  if (isOrganization) {
    return [tabs.teams, ...commonTabs];
  }

  if (isGroupType) {
    return [tabs.users, tabs.assets, ...commonTabs];
  }

  return [tabs.teams, tabs.users, ...commonTabs];
};

export const fetchErrorPlaceHolder = ({
  permission,
  onClick,
  heading,
  doc,
  button,
  children,
  type = ERROR_PLACEHOLDER_TYPE.CREATE,
}: PlaceholderProps) => (
  <ErrorPlaceHolder
    button={button}
    className="mt-0-important"
    doc={doc}
    heading={heading}
    permission={permission}
    type={type}
    onClick={onClick}>
    {children}
  </ErrorPlaceHolder>
);

export const getExtraDropdownContent = (
  currentTeam: Team,
  handleReactiveTeam: () => void,
  handleOpenToJoinToggle: () => void
): ItemType[] => [
  ...(!currentTeam.parents?.[0]?.deleted && currentTeam.deleted
    ? [
        {
          label: (
            <Row className="cursor-pointer" onClick={handleReactiveTeam}>
              <Col span={3}>
                <IconRestore
                  {...DROPDOWN_ICON_SIZE_PROPS}
                  name={t('label.restore')}
                />
              </Col>
              <Col data-testid="restore-team" span={21}>
                <Row>
                  <Col span={24}>
                    <Typography.Text
                      className="font-medium"
                      data-testid="restore-team-label">
                      {t('label.restore-entity', {
                        entity: t('label.team'),
                      })}
                    </Typography.Text>
                  </Col>
                  <Col className="p-t-xss" span={24}>
                    <Typography.Paragraph className="text-grey-muted text-xs m-b-0 line-height-16">
                      {t('message.restore-deleted-team')}
                    </Typography.Paragraph>
                  </Col>
                </Row>
              </Col>
            </Row>
          ),
          key: 'restore-team-dropdown',
        },
      ]
    : []),
  {
    label: (
      <Row
        className="cursor-pointer"
        data-testid="open-group-switch"
        onClick={handleOpenToJoinToggle}>
        <Col span={3}>
          <IconOpenLock {...DROPDOWN_ICON_SIZE_PROPS} />
        </Col>
        <Col data-testid="open-group" span={21}>
          <Row>
            <Col span={21}>
              <Typography.Text
                className="font-medium"
                data-testid="open-group-label">
                {t('label.public-team')}
              </Typography.Text>
            </Col>

            <Col span={3}>
              <Switch
                checked={currentTeam.isJoinable}
                className="tw-mr-2"
                size="small"
              />
            </Col>

            <Col className="p-t-xss">
              <Typography.Paragraph className="text-grey-muted text-xs m-b-0 line-height-16">
                {t('message.access-to-collaborate')}
              </Typography.Paragraph>
            </Col>
          </Row>
        </Col>
      </Row>
    ),
    key: 'open-group-dropdown',
  },
];
