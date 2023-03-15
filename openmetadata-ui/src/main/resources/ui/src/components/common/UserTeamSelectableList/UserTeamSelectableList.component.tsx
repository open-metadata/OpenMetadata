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
import { Button, Popover, Tabs, Tag } from 'antd';
import Tooltip from 'antd/es/tooltip';
import { PAGE_SIZE_MEDIUM, pagingObject } from 'constants/constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { SearchIndex } from 'enums/search.enum';
import { OwnerType } from 'enums/user.enum';
import { EntityReference } from 'generated/entity/data/table';
import { Team } from 'generated/entity/teams/team';
import { User } from 'generated/entity/teams/user';
import { Paging } from 'generated/type/paging';
import { SearchResponse } from 'interface/search.interface';
import { noop } from 'lodash';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchData } from 'rest/miscAPI';
import { getTeams } from 'rest/teamsAPI';
import { getUsers } from 'rest/userAPI';
import { formatTeamsResponse, formatUsersResponse } from 'utils/APIUtils';
import { getEntityName } from 'utils/EntityUtils';
import SVGIcons, { Icons } from 'utils/SvgUtils';
import { SelectableList } from '../SelectableList/SelectableList.component';
import './user-team-selectable-list.less';
import { UserSelectDropdownProps } from './UserTeamSelectableList.interface';

export const UserTeamSelectableList = ({
  hasPermission,
  owner,
  onUpdate = noop,
}: UserSelectDropdownProps) => {
  const { t } = useTranslation();
  const [popupVisible, setPopupVisible] = useState(false);
  const [userPaging, setUserPaging] = useState<Paging>(pagingObject);
  const [teamPaging, setTeamPaging] = useState<Paging>(pagingObject);
  const [activeTab, setActiveTab] = useState<'teams' | 'users'>('teams');

  const getFilterUserData = (data: Array<User | Team>) => {
    return data.map((user) => {
      return {
        displayName: getEntityName(user),
        fqn: user.fullyQualifiedName || '',
        id: user.id,
        type: OwnerType.USER,
        name: user.name,
      };
    });
  };

  const fetchUserOptions = async (searchText: string, after?: string) => {
    if (searchText) {
      try {
        const res = await searchData(
          searchText,
          1,
          PAGE_SIZE_MEDIUM,
          '',
          '',
          '',
          SearchIndex.USER
        );

        const data = getFilterUserData(
          formatUsersResponse(
            (res.data as SearchResponse<SearchIndex.USER>).hits.hits
          )
        );
        setUserPaging({ total: res.data.hits.total.value });

        return { data, paging: { total: res.data.hits.total.value } };
      } catch (error) {
        return { data: [], paging: { total: 0 } };
      }
    } else {
      try {
        const { data, paging } = await getUsers(
          '',
          PAGE_SIZE_MEDIUM,
          after
            ? {
                after,
              }
            : undefined
        );
        const filterData = getFilterUserData(data);
        setUserPaging(paging);

        return { data: filterData, paging };
      } catch (error) {
        console.error(error);

        return { data: [], paging: { total: 0 } };
      }
    }
  };

  const fetchTeamOptions = async (searchText: string, after?: string) => {
    if (searchText) {
      try {
        const res = await searchData(
          searchText,
          1,
          PAGE_SIZE_MEDIUM,
          '',
          '',
          '',
          SearchIndex.TEAM
        );

        const data = getFilterUserData(
          formatTeamsResponse(
            (res.data as SearchResponse<SearchIndex.TEAM>).hits.hits
          )
        );

        setTeamPaging({ total: res.data.hits.total.value });

        return { data, paging: { total: res.data.hits.total.value } };
      } catch (error) {
        return { data: [], paging: { total: 0 } };
      }
    } else {
      try {
        const { data, paging } = await getTeams('', {
          after,
          limit: PAGE_SIZE_MEDIUM,
        });

        const filterData = getFilterUserData(data);

        setTeamPaging(paging);

        return { data: filterData, paging };
      } catch (error) {
        console.error(error);

        return { data: [], paging: { total: 0 } };
      }
    }
  };

  const handleUpdate = (updateItems: EntityReference[]) => {
    onUpdate(updateItems[0]);
    setPopupVisible(false);
  };

  return (
    <Popover
      content={
        <Tabs
          centered
          activeKey={activeTab}
          className="select-owner-tabs"
          size="small"
          onChange={(key: string) => setActiveTab(key as 'teams' | 'users')}>
          <Tabs.TabPane
            key="teams"
            tab={
              <>
                {t('label.team-plural')}{' '}
                <Tag color={activeTab === 'teams' ? '#7147e8' : 'default'}>
                  {teamPaging.total}
                </Tag>
              </>
            }>
            <SelectableList
              fetchOptions={fetchTeamOptions}
              searchPlaceholder={t('label.search-for-type', {
                type: t('label.team'),
              })}
              selectedItems={owner ? [owner] : []}
              onCancel={() => setPopupVisible(false)}
              onUpdate={handleUpdate}
            />
          </Tabs.TabPane>
          <Tabs.TabPane
            key="users"
            tab={
              <>
                {t('label.user-plural')}{' '}
                <Tag color={activeTab === 'users' ? '#7147e8' : 'default'}>
                  {userPaging.total}
                </Tag>
              </>
            }>
            <SelectableList
              fetchOptions={fetchUserOptions}
              searchPlaceholder={t('label.search-for-type', {
                type: t('label.user'),
              })}
              selectedItems={owner ? [owner] : []}
              onCancel={() => setPopupVisible(false)}
              onUpdate={handleUpdate}
            />
          </Tabs.TabPane>
        </Tabs>
      }
      open={popupVisible}
      overlayClassName="user-team-select-popover card-shadow"
      overlayInnerStyle={{ padding: '0px' }}
      overlayStyle={{ padding: 0 }}
      placement="bottomLeft"
      showArrow={false}
      //   title={t('label.user-plural')}
      trigger="click"
      onOpenChange={setPopupVisible}>
      <Tooltip
        placement="topRight"
        title={hasPermission ? 'Update Owner' : NO_PERMISSION_FOR_ACTION}>
        <Button
          className="flex-center p-0"
          data-testid="owner-dropdown"
          disabled={!hasPermission}
          icon={
            <SVGIcons alt="edit" icon={Icons.EDIT} title="Edit" width="16px" />
          }
          size="small"
          type="text"
          onClick={() => setPopupVisible(true)}
        />
      </Tooltip>
    </Popover>
  );
};
