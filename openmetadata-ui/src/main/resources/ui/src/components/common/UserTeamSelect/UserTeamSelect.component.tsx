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
import { Input, Select, Space, Spin, Tabs, Typography } from 'antd';
import { debounce, noop } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconTeamsGrey } from '../../../assets/svg/teams-grey.svg';
import { ReactComponent as IconUser } from '../../../assets/svg/user.svg';
import {
  ADD_USER_CONTAINER_HEIGHT,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/data/table';
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
import './user-team-select.less';
import { UserTeamSelectProps } from './UserTeamSelect.interface';

export const TeamOptionRenderer = (props: EntityReference) => {
  return (
    <Space>
      <Icon component={IconTeamsGrey} style={{ fontSize: '16px' }} />
      <Typography.Text>{getEntityName(props)}</Typography.Text>
    </Space>
  );
};

export const UserOptionRenderer = (props: EntityReference) => {
  return (
    <Space>
      <Icon component={IconUser} style={{ fontSize: '16px' }} />
      <Typography.Text>{getEntityName(props)}</Typography.Text>
    </Space>
  );
};

export const UserTeamSelect = ({
  value = [],
  onChange = noop,
  placeholder,
  multiple = { user: true, team: true },
  disabled = false,
  showSearch = true,
  allowClear = true,
  size = 'middle',
  className,
  style,
}: UserTeamSelectProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'teams' | 'users'>('teams');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState({ team: 0, user: 0 });
  const [userOptions, setUserOptions] = useState<EntityReference[]>([]);
  const [teamOptions, setTeamOptions] = useState<EntityReference[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [teamPage, setTeamPage] = useState(1);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [hasMoreTeams, setHasMoreTeams] = useState(true);

  const isMultiUser = multiple.user;
  const isMultiTeam = multiple.team;

  // Separate selected users and teams for reference if needed
  const selectedUsers = useMemo(
    () => value?.filter((item) => item.type === EntityType.USER) ?? [],
    [value]
  );
  const selectedTeams = useMemo(
    () => value?.filter((item) => item.type === EntityType.TEAM) ?? [],
    [value]
  );

  const fetchUserOptions = async (searchTerm: string, page = 1) => {
    setLoading(true);
    try {
      const res = await searchData(
        searchTerm,
        page,
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
      setHasMoreUsers(data.length === PAGE_SIZE_MEDIUM);

      if (page === 1) {
        setUserOptions(data);
      } else {
        setUserOptions((prev) => [...prev, ...data]);
      }

      return data;
    } catch (error) {
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamOptions = async (searchTerm: string, page = 1) => {
    setLoading(true);
    try {
      const res = await searchData(
        searchTerm || '',
        page,
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
      setHasMoreTeams(data.length === PAGE_SIZE_MEDIUM);

      if (page === 1) {
        setTeamOptions(data);
      } else {
        setTeamOptions((prev) => [...prev, ...data]);
      }

      return data;
    } catch (error) {
      return [];
    } finally {
      setLoading(false);
    }
  };

  const debouncedSearch = useCallback(
    debounce((searchTerm: string) => {
      if (activeTab === 'users') {
        setUserPage(1);
        fetchUserOptions(searchTerm, 1);
      } else {
        setTeamPage(1);
        fetchTeamOptions(searchTerm, 1);
      }
    }, 300),
    [activeTab]
  );

  const handleSearch = (searchTerm: string) => {
    setSearchText(searchTerm);
    debouncedSearch(searchTerm);
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key as 'teams' | 'users');
    setSearchText('');
    if (key === 'users' && userOptions.length === 0) {
      fetchUserOptions('', 1);
    } else if (key === 'teams' && teamOptions.length === 0) {
      fetchTeamOptions('', 1);
    }
  };

  const handleSelect = (selectedValue: string) => {
    const currentOptions = activeTab === 'users' ? userOptions : teamOptions;
    const selectedItem = currentOptions.find(
      (item) => item.id === selectedValue
    );

    if (selectedItem) {
      const isTeam = selectedItem.type === EntityType.TEAM;
      const isUser = selectedItem.type === EntityType.USER;

      // Check if multiple selection is allowed for this type
      const allowMultiple = (isTeam && isMultiTeam) || (isUser && isMultiUser);

      let newValue: EntityReference[];
      if (allowMultiple) {
        // Add to existing selection
        newValue = [...value, selectedItem];
      } else {
        // Replace existing selection of the same type
        newValue = value.filter((item) => item.type !== selectedItem.type);
        newValue.push(selectedItem);
      }

      onChange(newValue);

      // Close dropdown if single selection
      if (!allowMultiple) {
        setOpen(false);
      }
    }
  };

  const handleDeselect = (deselectedValue: string) => {
    const newValue = value.filter((item) => item.id !== deselectedValue);
    onChange(newValue);
  };

  const handleLoadMore = () => {
    if (activeTab === 'users' && hasMoreUsers && !loading) {
      const nextPage = userPage + 1;
      setUserPage(nextPage);
      fetchUserOptions(searchText, nextPage);
    } else if (activeTab === 'teams' && hasMoreTeams && !loading) {
      const nextPage = teamPage + 1;
      setTeamPage(nextPage);
      fetchTeamOptions(searchText, nextPage);
    }
  };

  const renderOption = (option: EntityReference) => {
    const isSelected = value.some((item) => item.id === option.id);

    return (
      <Select.Option
        className={isSelected ? 'selected-option' : ''}
        disabled={isSelected}
        key={option.id}
        value={option.id}>
        {option.type === EntityType.TEAM ? (
          <TeamOptionRenderer {...option} />
        ) : (
          <UserOptionRenderer {...option} />
        )}
      </Select.Option>
    );
  };

  const renderSelectedValue = () => {
    if (value.length === 0) {
      return null;
    }

    return value.map((item) => (
      <UserTag
        closable
        id={item.name ?? ''}
        isTeam={item.type === EntityType.TEAM}
        key={item.id}
        name={getEntityName(item)}
        size={UserTagSize.small}
        onRemove={() => handleDeselect(item.id)}
      />
    ));
  };

  const dropdownRender = (menu: React.ReactElement) => (
    <div className="user-team-select-dropdown">
      <Tabs
        activeKey={activeTab}
        items={[
          {
            label: (
              <>
                {t('label.team-plural')}{' '}
                {getCountBadge(count.team, '', activeTab === 'teams')}
              </>
            ),
            key: 'teams',
          },
          {
            label: (
              <>
                {t('label.user-plural')}
                {getCountBadge(count.user, '', activeTab === 'users')}
              </>
            ),
            key: 'users',
          },
        ]}
        size="small"
        onChange={handleTabChange}
      />

      {showSearch && (
        <div className="search-container">
          <Input.Search
            loading={loading}
            placeholder={t('label.search-for-type', {
              type: activeTab === 'users' ? t('label.user') : t('label.team'),
            })}
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      )}

      <div
        className="options-container"
        style={{ maxHeight: ADD_USER_CONTAINER_HEIGHT, overflowY: 'auto' }}>
        {loading && (
          <div className="loading-container">
            <Spin size="small" />
          </div>
        )}

        {(activeTab === 'users' ? userOptions : teamOptions).map(renderOption)}

        {((activeTab === 'users' && hasMoreUsers) ||
          (activeTab === 'teams' && hasMoreTeams)) && (
          <div className="load-more-container">
            <Typography.Link disabled={loading} onClick={handleLoadMore}>
              {t('label.load-more')}
            </Typography.Link>
          </div>
        )}
      </div>
    </div>
  );

  // Initialize data when dropdown opens
  useEffect(() => {
    if (open) {
      if (activeTab === 'users' && userOptions.length === 0) {
        fetchUserOptions('', 1);
      } else if (activeTab === 'teams' && teamOptions.length === 0) {
        fetchTeamOptions('', 1);
      }
    }
  }, [open, activeTab]);

  return (
    <Select
      allowClear={allowClear}
      className={className}
      disabled={disabled}
      dropdownRender={dropdownRender}
      dropdownStyle={{ padding: 0 }}
      mode="multiple"
      open={open}
      placeholder={
        placeholder ||
        t('label.select-entity', { entity: t('label.owner-plural') })
      }
      size={size}
      style={style}
      suffixIcon={null}
      tagRender={() => <></>} // We'll render tags manually
      value={value.map((item) => item.id)}
      onDeselect={handleDeselect}
      onDropdownVisibleChange={setOpen}
      onSelect={handleSelect}>
      {/* Render selected values */}
      <div className="selected-values-container">{renderSelectedValue()}</div>
    </Select>
  );
};
