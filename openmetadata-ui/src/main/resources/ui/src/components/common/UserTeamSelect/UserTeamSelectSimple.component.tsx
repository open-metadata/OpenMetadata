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
import { CloseOutlined } from '@ant-design/icons';
import Icon from '@ant-design/icons/lib/components/Icon';
import { Select, Space, Spin, Tag, Typography } from 'antd';
import { debounce, noop } from 'lodash';
import type { CustomTagProps } from 'rc-select/lib/BaseSelect';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconTeamsGrey } from '../../../assets/svg/teams-grey.svg';
import { ReactComponent as IconUser } from '../../../assets/svg/user.svg';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/data/table';
import { searchData } from '../../../rest/miscAPI';
import {
  formatTeamsResponse,
  formatUsersResponse,
} from '../../../utils/APIUtils';
import {
  getEntityName,
  getEntityReferenceListFromEntities,
} from '../../../utils/EntityUtils';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
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

export const UserTeamSelectSimple = ({
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
  const [loading, setLoading] = useState(false);
  const [userOptions, setUserOptions] = useState<EntityReference[]>([]);
  const [teamOptions, setTeamOptions] = useState<EntityReference[]>([]);
  const [userPage, setUserPage] = useState(1);
  const [teamPage, setTeamPage] = useState(1);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [hasMoreTeams, setHasMoreTeams] = useState(true);

  const isMultiUser = multiple.user;
  const isMultiTeam = multiple.team;

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
      setUserPage(1);
      setTeamPage(1);
      fetchUserOptions(searchTerm, 1);
      fetchTeamOptions(searchTerm, 1);
    }, 300),
    []
  );

  const handleSearch = (searchTerm: string) => {
    debouncedSearch(searchTerm);
  };

  const handleSelect = (selectedValue: string) => {
    const allOptions = [...userOptions, ...teamOptions];
    const selectedItem = allOptions.find((item) => item.id === selectedValue);

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
    }
  };

  const handleDeselect = (deselectedValue: string) => {
    const newValue = value.filter((item) => item.id !== deselectedValue);
    onChange(newValue);
  };

  const handleDropdownScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { target } = e;
    const { scrollTop, scrollHeight, clientHeight } = target as HTMLDivElement;

    if (scrollTop + clientHeight >= scrollHeight - 5) {
      // Load more users
      if (hasMoreUsers && !loading) {
        const nextPage = userPage + 1;
        setUserPage(nextPage);
        fetchUserOptions('', nextPage);
      }

      // Load more teams
      if (hasMoreTeams && !loading) {
        const nextPage = teamPage + 1;
        setTeamPage(nextPage);
        fetchTeamOptions('', nextPage);
      }
    }
  };

  const getOptions = () => {
    const options = allOptions.map((option) => {
      const isSelected = value.some((item) => item.id === option.id);

      return {
        label:
          option.type === EntityType.TEAM ? (
            <TeamOptionRenderer {...option} />
          ) : (
            <UserOptionRenderer {...option} />
          ),
        value: option.id,
        disabled: isSelected,
        className: isSelected ? 'selected-option' : '',
      };
    });

    if (loading) {
      options.push({
        label: (
          <div style={{ textAlign: 'center', padding: '8px' }}>
            <Spin size="small" />
          </div>
        ),
        value: 'loading',
        disabled: true,
        className: '',
      });
    }

    return options;
  };

  const tagRender = (props: CustomTagProps) => {
    const { value: tagValue, closable, onClose } = props;
    const selectedItem = value.find((item) => item.id === tagValue);

    if (!selectedItem) {
      return <></>;
    }

    return (
      <Tag
        className="inline-flex gap-2"
        closable={closable}
        id={selectedItem.name ?? ''}
        onClose={onClose}>
        <ProfilePicture
          avatarType="outlined"
          isTeam={selectedItem.type === EntityType.TEAM}
          name={selectedItem.id}
          width="16px"
        />
        {getEntityName(selectedItem)}
        {closable && <CloseOutlined size={16} onClick={onClose} />}
      </Tag>
    );
  };

  // Initialize data on mount
  useEffect(() => {
    fetchUserOptions('', 1);
    fetchTeamOptions('', 1);
  }, []);

  const allOptions = [...userOptions, ...teamOptions];

  return (
    <Select
      allowClear={allowClear}
      className={className}
      disabled={disabled}
      filterOption={false}
      loading={loading}
      mode="tags"
      options={getOptions()}
      placeholder={
        placeholder ||
        t('label.select-entity', { entity: t('label.owner-plural') })
      }
      size={size}
      style={style}
      tagRender={tagRender}
      value={value.map((item) => item.id)}
      onDeselect={handleDeselect}
      onPopupScroll={handleDropdownScroll}
      onSearch={showSearch ? handleSearch : undefined}
      onSelect={handleSelect}
    />
  );
};
