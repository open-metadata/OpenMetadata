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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Popover, Space, Tabs, Tooltip, Typography } from 'antd';
import { isEmpty, noop, toString } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconTeamsGrey } from '../../../assets/svg/teams-grey.svg';
import {
  DE_ACTIVE_COLOR,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/data/table';
import { searchData } from '../../../rest/miscAPI';
import { getUsers } from '../../../rest/userAPI';
import {
  formatTeamsResponse,
  formatUsersResponse,
} from '../../../utils/APIUtils';
import { getCountBadge } from '../../../utils/CommonUtils';
import {
  getEntityName,
  getEntityReferenceListFromEntities,
} from '../../../utils/EntityUtils';
import { SelectableList } from '../SelectableList/SelectableList.component';
import './user-team-selectable-list.less';
import { UserSelectDropdownProps } from './UserTeamSelectableList.interface';

export const TeamListItemRenderer = (props: EntityReference) => {
  return (
    <Space>
      <Icon component={IconTeamsGrey} style={{ fontSize: '16px' }} />
      <Typography.Text>{getEntityName(props)}</Typography.Text>
    </Space>
  );
};

export const UserTeamSelectableList = ({
  hasPermission,
  owner,
  onUpdate = noop,
  children,
}: UserSelectDropdownProps) => {
  const { t } = useTranslation();
  const [popupVisible, setPopupVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'teams' | 'users'>('teams');
  const [count, setCount] = useState({ team: 0, user: 0 });

  const fetchUserOptions = async (searchText: string, after?: string) => {
    if (searchText) {
      try {
        const res = await searchData(
          searchText,
          1,
          PAGE_SIZE_MEDIUM,
          'isBot:false',
          '',
          '',
          SearchIndex.USER
        );

        const data = getEntityReferenceListFromEntities(
          formatUsersResponse(res.data.hits.hits),
          EntityType.USER
        );
        setCount((pre) => ({ ...pre, user: res.data.hits.total.value }));

        return { data, paging: { total: res.data.hits.total.value } };
      } catch (error) {
        return { data: [], paging: { total: 0 } };
      }
    } else {
      try {
        const { data, paging } = await getUsers({
          limit: PAGE_SIZE_MEDIUM,
          after: after ?? undefined,
          isBot: false,
        });
        const filterData = getEntityReferenceListFromEntities(
          data,
          EntityType.USER
        );

        setCount((pre) => ({ ...pre, user: paging.total }));

        return { data: filterData, paging };
      } catch (error) {
        return { data: [], paging: { total: 0 } };
      }
    }
  };

  const fetchTeamOptions = async (searchText: string, after?: string) => {
    const afterPage = isNaN(Number(after)) ? 1 : Number(after);

    try {
      const res = await searchData(
        searchText || '',
        afterPage,
        PAGE_SIZE_MEDIUM,
        'teamType:Group',
        'displayName.keyword',
        'asc',
        SearchIndex.TEAM
      );

      const data = getEntityReferenceListFromEntities(
        formatTeamsResponse(res.data.hits.hits),
        EntityType.TEAM
      );

      setCount((pre) => ({ ...pre, team: res.data.hits.total.value }));

      return {
        data,
        paging: {
          total: res.data.hits.total.value,
          after: toString(afterPage + 1),
        },
      };
    } catch (error) {
      return { data: [], paging: { total: 0 } };
    }
  };

  const handleUpdate = async (updateItems: EntityReference[]) => {
    await onUpdate(
      isEmpty(updateItems)
        ? undefined
        : {
            id: updateItems[0].id,
            type: activeTab === 'teams' ? EntityType.TEAM : EntityType.USER,
            name: updateItems[0].name,
            displayName: updateItems[0].displayName,
          }
    );

    setPopupVisible(false);
  };

  // Fetch and store count for Users tab
  const getUserCount = async () => {
    const res = await searchData(
      '',
      1,
      0,
      'isBot:false',
      '',
      '',
      SearchIndex.USER
    );

    setCount((pre) => ({ ...pre, user: res.data.hits.total.value }));
  };
  const getTeamCount = async () => {
    const res = await searchData(
      '',
      1,
      0,
      'teamType:Group',
      '',
      '',
      SearchIndex.TEAM
    );

    setCount((pre) => ({ ...pre, team: res.data.hits.total.value }));
  };

  const fetchCount = async () => {
    if (popupVisible) {
      if (owner?.type === EntityType.USER) {
        await getTeamCount();
      } else {
        await getUserCount();
      }
    }
  };

  const openPopover = useCallback(() => setPopupVisible(true), []);

  useEffect(() => {
    fetchCount();
  }, [popupVisible]);

  useEffect(() => {
    if (owner?.type === EntityType.USER) {
      setActiveTab('users');
    } else {
      setActiveTab('teams');
    }
  }, [owner]);

  return (
    <Popover
      destroyTooltipOnHide
      content={
        <Tabs
          centered
          activeKey={activeTab}
          className="select-owner-tabs"
          data-testid="select-owner-tabs"
          destroyInactiveTabPane={false}
          items={[
            {
              label: (
                <>
                  {t('label.team-plural')}{' '}
                  {getCountBadge(count.team, '', activeTab === 'teams')}
                </>
              ),
              key: 'teams',
              children: (
                <SelectableList
                  customTagRenderer={TeamListItemRenderer}
                  fetchOptions={fetchTeamOptions}
                  searchBarDataTestId="owner-select-teams-search-bar"
                  searchPlaceholder={t('label.search-for-type', {
                    type: t('label.team'),
                  })}
                  selectedItems={owner?.type === EntityType.TEAM ? [owner] : []}
                  onCancel={() => setPopupVisible(false)}
                  onUpdate={handleUpdate}
                />
              ),
            },
            {
              label: (
                <>
                  {t('label.user-plural')}
                  {getCountBadge(count.user, '', activeTab === 'users')}
                </>
              ),
              key: 'users',
              children: (
                <SelectableList
                  fetchOptions={fetchUserOptions}
                  searchBarDataTestId="owner-select-users-search-bar"
                  searchPlaceholder={t('label.search-for-type', {
                    type: t('label.user'),
                  })}
                  selectedItems={owner?.type === EntityType.USER ? [owner] : []}
                  onCancel={() => setPopupVisible(false)}
                  onUpdate={handleUpdate}
                />
              ),
            },
          ]}
          size="small"
          onChange={(key: string) => setActiveTab(key as 'teams' | 'users')}
        />
      }
      open={popupVisible}
      overlayClassName="user-team-select-popover card-shadow"
      placement="bottomRight"
      showArrow={false}
      trigger="click"
      onOpenChange={setPopupVisible}>
      {children ??
        (hasPermission && (
          <Tooltip
            title={
              !popupVisible &&
              t('label.edit-entity', {
                entity: t('label.owner'),
              })
            }>
            <Button
              className="flex-center p-0"
              data-testid="edit-owner"
              icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
              size="small"
              type="text"
              onClick={openPopover}
            />
          </Tooltip>
        ))}
    </Popover>
  );
};
