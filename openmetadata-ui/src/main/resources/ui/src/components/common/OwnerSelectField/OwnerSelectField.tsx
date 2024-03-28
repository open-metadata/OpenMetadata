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
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconTeamsGrey } from '../../../assets/svg/teams-grey.svg';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
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
import { UserTag } from '../UserTag/UserTag.component';
import { UserTagSize } from '../UserTag/UserTag.interface';

export const TeamListItemRenderer = (props: EntityReference) => {
  return (
    <Space>
      <Icon component={IconTeamsGrey} style={{ fontSize: '16px' }} />
      <Typography.Text>{getEntityName(props)}</Typography.Text>
    </Space>
  );
};

export type OwnerSelectFieldProps = { userOnly: boolean } & (
  | {
      owners: EntityReference;
      onUpdate: (owners: EntityReference) => void;
      allowMultiple?: false;
    }
  | {
      owners: EntityReference[];
      onUpdate: (owners: EntityReference[]) => void;
      allowMultiple: true;
    }
);

export const OwenerSelectField = ({
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
  const [userOptions, setUserOptions] = useState<EntityReference[]>([]);
  const [teamOptions, setTeamOptions] = useState<EntityReference[]>([]);

  const fetchUserOptions = async (searchText: string) => {
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
        setUserOptions(data);
      } catch (error) {
        setUserOptions([]);
      }
    } else {
      try {
        const { data, paging: resPaging } = await getUsers({
          limit: PAGE_SIZE_MEDIUM,
          after: undefined,
          isBot: false,
        });
        const filterData = getEntityReferenceListFromEntities(
          data,
          EntityType.USER
        );

        setCount((pre) => ({ ...pre, user: resPaging.total }));
        setUserOptions(filterData);
      } catch (error) {
        setUserOptions([]);
      }
    }
  };

  const fetchTeamOptions = async (searchText: string) => {
    const afterPage = 1;

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

      setTeamOptions(data);
    } catch (error) {
      setTeamOptions([]);
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

  useEffect(() => {
    activeTab === 'teams' && !userOnly
      ? fetchTeamOptions('')
      : fetchUserOptions('');
  }, [activeTab, userOnly]);

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
      options={[
        ...(activeTab === 'teams' && !userOnly ? teamOptions : userOptions),
      ].map((option) => ({
        label: getEntityName(option),
        value: option.name,
        title: option.type,
      }))}
      tagRender={(props) => {
        return (
          <UserTag
            bordered
            className="m-r-xs"
            id={props.value}
            isTeam={
              teamOptions.find((team) => team.name === props.value) !==
              undefined
            }
            name={props.label as string}
            size={UserTagSize.small}
            onRemove={props.onClose}
            {...props}
          />
        );
      }}
      value={selectedValues?.map((owner) => owner.name) as string[]}
      onChange={handleOnChangeMultiMode}
      onSearch={activeTab === 'users' ? fetchUserOptions : fetchTeamOptions}
    />
  );
};
