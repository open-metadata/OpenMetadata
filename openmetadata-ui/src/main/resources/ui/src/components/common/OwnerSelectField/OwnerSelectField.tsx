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
import { Select, Space, Tabs, Typography } from 'antd';
import { BaseOptionType } from 'antd/lib/select';
import { isNil, noop } from 'lodash';
import React, {
  ReactElement,
  UIEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconTeamsGrey } from '../../../assets/svg/teams-grey.svg';
import { PAGE_SIZE_MEDIUM, pagingObject } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/data/table';
import { Paging } from '../../../generated/type/paging';
import { searchData } from '../../../rest/miscAPI';
import {
  formatTeamsResponse,
  formatUsersResponse,
} from '../../../utils/APIUtils';
import { getCountBadge } from '../../../utils/CommonUtils';
import {
  getEntityName,
  getEntityReferenceListFromEntities,
} from '../../../utils/EntityUtils';
import { UserTag } from '../UserTag/UserTag.component';
import { UserTagSize } from '../UserTag/UserTag.interface';
import { OwnerSelectFieldProps } from './OwnerSelectField.interface';

export const TeamListItemRenderer = (props: EntityReference) => {
  return (
    <Space>
      <Icon component={IconTeamsGrey} style={{ fontSize: '16px' }} />
      <Typography.Text>{getEntityName(props)}</Typography.Text>
    </Space>
  );
};

export const OwnerSelectField = ({
  owners,
  onUpdate = noop,
  allowMultiple = false,
  userOnly,
}: OwnerSelectFieldProps) => {
  const { t } = useTranslation();
  const selectedValues = useMemo(
    () =>
      isNil(owners)
        ? []
        : (allowMultiple
            ? (owners as EntityReference[])
            : [owners as EntityReference]
          ).filter((owner) => owner !== null),
    [owners]
  );

  const [activeTab, setActiveTab] = useState<'teams' | 'users'>('teams');
  const [count, setCount] = useState({ team: 0, user: 0 });
  const [uniqueOptions, setUniqueOptions] = useState<EntityReference[]>([]);
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [searchText, setSearchText] = useState('');

  const fetchUserOptions = async (searchText: string, after = 1) => {
    try {
      const res = await searchData(
        searchText,
        after,
        PAGE_SIZE_MEDIUM,
        'isBot:false',
        'displayName.keyword',
        'asc',
        SearchIndex.USER
      );

      const data = getEntityReferenceListFromEntities(
        formatUsersResponse(res.data.hits.hits),
        EntityType.USER
      );
      setCount((pre) => ({ ...pre, user: res.data.hits.total.value }));

      return {
        data,
        paging: { total: res.data.hits.total.value, offset: after + '' },
      };
    } catch (error) {
      return {
        data: [],
        paging: { total: 0 },
      };
    }
  };

  const fetchTeamOptions = async (searchText: string, after = 1) => {
    try {
      const res = await searchData(
        searchText || '',
        after,
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

      return { data, paging: { total: res.data.hits.total.value } };
    } catch (error) {
      return {
        data: [],
        paging: { total: 0 },
      };
    }
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
    if (activeTab === 'teams') {
      await getTeamCount();
    } else {
      await getUserCount();
    }
  };

  const fetchOptions = useCallback(
    async (searchText: string, after?: number) => {
      const { data, paging: pageInfo } =
        activeTab === 'teams' && !userOnly
          ? await fetchTeamOptions(searchText, after)
          : await fetchUserOptions(searchText, after);

      setUniqueOptions((prevData) => [...prevData, ...data]);
      setPaging(pageInfo as Paging);
    },
    [activeTab, userOnly]
  );

  const onScroll: UIEventHandler<HTMLElement> = useCallback(
    async (e) => {
      if (
        // If user reach to end of container fetch more options
        e.currentTarget.scrollHeight - e.currentTarget.scrollTop === 256 &&
        // If there are other options available which can be determine form the cursor value
        paging.offset &&
        // If we have all the options already we don't need to fetch more
        uniqueOptions.length < paging.total
      ) {
        await fetchOptions(searchText, paging.offset + 1);
      }
    },
    [paging, uniqueOptions, searchText]
  );

  useEffect(() => {
    fetchOptions(searchText);
  }, [searchText]);

  useEffect(() => {
    setUniqueOptions([]);
    fetchOptions('');
  }, [fetchOptions, userOnly]);

  useEffect(() => {
    fetchCount();
  }, []);

  const customDropdown = (menu: ReactElement) => {
    return userOnly ? (
      menu
    ) : (
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
            children: menu,
          },
          {
            label: (
              <>
                {t('label.user-plural')}
                {getCountBadge(count.user, '', activeTab === 'users')}
              </>
            ),
            key: 'users',
            children: menu,
          },
        ]}
        size="small"
        onChange={(key: string) => setActiveTab(key as 'teams' | 'users')}
      />
    );
  };

  const handleOnChangeMultiMode = useCallback(
    (_: string[], optionTypes: BaseOptionType) => {
      const owners = (
        Array.isArray(optionTypes) ? optionTypes : [optionTypes]
      ).map(
        (item) =>
          ({
            type: item.title,
            name: item.value,
            id: item.id,
            displayName: item.label,
          } as EntityReference)
      );

      allowMultiple
        ? (onUpdate as (owners: EntityReference[]) => void)(owners)
        : (onUpdate as (owners: EntityReference) => void)(owners[0]);
    },
    [onUpdate]
  );

  return (
    <Select
      showSearch
      dropdownRender={customDropdown}
      mode={allowMultiple ? 'multiple' : undefined}
      options={uniqueOptions.map((option) => ({
        label: getEntityName(option),
        id: option.id,
        value: option.name,
        title: option.type,
      }))}
      tagRender={(props) => {
        return (
          <UserTag
            bordered
            className="m-r-xs"
            id={props.value}
            name={props.label as string}
            size={UserTagSize.small}
            onRemove={props.onClose}
            {...props}
          />
        );
      }}
      value={selectedValues?.map((owner) => owner.name) as string[]}
      onChange={handleOnChangeMultiMode}
      onPopupScroll={onScroll}
      onSearch={setSearchText}
    />
  );
};
