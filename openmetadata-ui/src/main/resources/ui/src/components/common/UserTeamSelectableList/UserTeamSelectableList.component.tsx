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
  Popover,
  PopoverTrigger,
  Tabs,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isArray, isEmpty, noop, toString } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconTeamsGrey } from '../../../assets/svg/teams-grey.svg';
import {
  ADD_USER_CONTAINER_HEIGHT,
  DE_ACTIVE_COLOR,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import { EditIconButton } from '../IconButtons/EditIconButton';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/data/table';
import { searchQuery } from '../../../rest/searchAPI';
import {
  formatTeamsResponse,
  formatUsersResponse,
} from '../../../utils/APIUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityReferenceListFromEntities } from '../../../utils/EntityReferenceUtils';
import { getTermQuery } from '../../../utils/SearchPureUtils';
import { SelectableList } from '../SelectableList/SelectableList.component';
import { UserTag } from '../UserTag/UserTag.component';
import { UserTagSize } from '../UserTag/UserTag.interface';
import { UserSelectDropdownProps } from './UserTeamSelectableList.interface';

export const TeamListItemRenderer = (props: EntityReference) => {
  return (
    <span className="tw:flex tw:items-center tw:gap-2">
      <IconTeamsGrey aria-hidden className="tw:size-4" />
      <span className="tw:text-sm">{getEntityName(props)}</span>
    </span>
  );
};

export const UserTeamSelectableList = ({
  hasPermission,
  owner,
  onClose,
  onUpdate = noop,
  children,
  popoverProps,
  multiple = { user: false, team: false },
  label,
  previewSelected = false,
  listHeight = ADD_USER_CONTAINER_HEIGHT,
  tooltipText,
  overlayClassName,
}: UserSelectDropdownProps) => {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'teams' | 'users'>('teams');
  const [count, setCount] = useState({ team: 0, user: 0 });

  const [selectedUsers, setSelectedUsers] = useState<EntityReference[]>([]);

  const ownerType = useMemo(() => {
    if (owner) {
      return owner?.[0]?.type ?? EntityType.TEAM;
    }

    return EntityType.TEAM;
  }, [owner]);

  const isMultiUser = multiple.user;
  const isMultiTeam = multiple.team;

  const { defaultUsers, defaultTeams } = useMemo(() => {
    return {
      defaultUsers:
        selectedUsers?.filter((item) => item.type === EntityType.USER) ?? [],
      defaultTeams:
        selectedUsers?.filter((item) => item.type === EntityType.TEAM) ?? [],
    };
  }, [selectedUsers]);

  const fetchUserOptions = async (searchText: string, after?: string) => {
    const afterPage = isNaN(Number(after)) ? 1 : Number(after);

    try {
      const res = await searchQuery({
        query: searchText,
        pageNumber: afterPage,
        pageSize: PAGE_SIZE_MEDIUM,
        queryFilter: getTermQuery({ isBot: 'false' }),
        sortField: 'displayName.keyword',
        sortOrder: 'asc',
        searchIndex: SearchIndex.USER,
      });

      const data = getEntityReferenceListFromEntities(
        formatUsersResponse(res.hits.hits),
        EntityType.USER
      );
      setCount((pre) => ({ ...pre, user: res.hits.total.value }));

      return {
        data,
        paging: {
          total: res.hits.total.value,
          after: toString(afterPage + 1),
        },
      };
    } catch (error) {
      return { data: [], paging: { total: 0 } };
    }
  };

  const fetchTeamOptions = async (searchText: string, after?: string) => {
    const afterPage = isNaN(Number(after)) ? 1 : Number(after);

    try {
      const res = await searchQuery({
        query: searchText || '',
        pageNumber: afterPage,
        pageSize: PAGE_SIZE_MEDIUM,
        queryFilter: getTermQuery({}, 'must', undefined, {
          matchTerms: { teamType: 'Group' },
        }),
        sortField: 'displayName.keyword',
        sortOrder: 'asc',
        searchIndex: SearchIndex.TEAM,
      });

      const data = getEntityReferenceListFromEntities(
        formatTeamsResponse(res.hits.hits),
        EntityType.TEAM
      );

      setCount((pre) => ({ ...pre, team: res.hits.total.value }));

      return {
        data,
        paging: {
          total: res.hits.total.value,
          after: toString(afterPage + 1),
        },
      };
    } catch (error) {
      return { data: [], paging: { total: 0 } };
    }
  };

  const getOwnerItemBasedOnTab = (updateItems: EntityReference[]) => {
    const currentTabType =
      activeTab === 'users' ? EntityType.USER : EntityType.TEAM;
    const otherTabType =
      activeTab === 'users' ? EntityType.TEAM : EntityType.USER;

    const itemsFromOtherTab = selectedUsers.filter(
      (item) => item.type === otherTabType
    );
    const itemsFromCurrentTab = updateItems.filter(
      (item) => item.type === currentTabType
    );

    return { itemsFromOtherTab, itemsFromCurrentTab };
  };

  const handleUpdate = async (updateItems: EntityReference[]) => {
    let updateData: EntityReference[] = [];

    if (isMultiUser && isMultiTeam) {
      const { itemsFromOtherTab, itemsFromCurrentTab } =
        getOwnerItemBasedOnTab(updateItems);

      updateData = [...itemsFromOtherTab, ...itemsFromCurrentTab];
    } else if (!isEmpty(updateItems)) {
      updateData = updateItems;
    }

    try {
      await onUpdate(updateData);
    } finally {
      setPopupVisible(false);
    }
  };

  const getUserCount = async () => {
    const res = await searchQuery({
      query: '',
      pageNumber: 1,
      pageSize: 0,
      queryFilter: getTermQuery({ isBot: 'false' }),
      searchIndex: SearchIndex.USER,
    });

    setCount((pre) => ({ ...pre, user: res.hits.total.value }));
  };

  const getTeamCount = async () => {
    const res = await searchQuery({
      query: '',
      pageNumber: 1,
      pageSize: 0,
      queryFilter: getTermQuery({}, 'must', undefined, {
        matchTerms: { teamType: 'Group' },
      }),
      searchIndex: SearchIndex.TEAM,
    });

    setCount((pre) => ({ ...pre, team: res.hits.total.value }));
  };

  const init = async () => {
    if (popupVisible || popoverProps?.open) {
      if (ownerType === EntityType.USER) {
        setActiveTab('users');
        await getTeamCount();
      } else {
        setActiveTab('teams');
        await getUserCount();
      }
    }
  };

  const handleCancelSelectableList = () => {
    setPopupVisible(false);
    onClose?.();
  };

  const onRemove = (id: string) => {
    setSelectedUsers((prevUsers) => {
      const removedUser = prevUsers.find((user) => user.id === id);
      const isTeamId = removedUser && removedUser.type === 'team';
      const isUserId = removedUser && removedUser.type === 'user';

      const updatedUsers = prevUsers.filter((user) => user.id !== id);

      if ((isTeamId && !isMultiTeam) || (isUserId && !isMultiUser)) {
        handleUpdate(updatedUsers);
      }

      return updatedUsers;
    });
  };

  const handleChange = (selectedItems: EntityReference[]) => {
    if (isMultiUser && isMultiTeam) {
      const { itemsFromOtherTab, itemsFromCurrentTab } =
        getOwnerItemBasedOnTab(selectedItems);

      setSelectedUsers([...itemsFromOtherTab, ...itemsFromCurrentTab]);
    } else {
      setSelectedUsers(selectedItems);
    }
  };

  useEffect(() => {
    const activeOwners = isArray(owner) ? owner : owner ? [owner] : [];
    setSelectedUsers(activeOwners);
  }, [owner]);

  useEffect(() => {
    init();
  }, [popupVisible]);

  const isOpen = popoverProps?.open ?? popupVisible;

  const handleOpenChange = (open: boolean) => {
    setPopupVisible(open);
    popoverProps?.onOpenChange?.(open);
    if (!open) {
      onClose?.();
    }
  };

  const defaultTrigger = hasPermission ? (
    <span ref={triggerRef}>
      <EditIconButton
        newLook
        data-testid="edit-owner"
        icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
        size="small"
        title={
          !isOpen
            ? tooltipText ??
              t('label.edit-entity', {
                entity: t('label.owner-plural'),
              })
            : undefined
        }
        onClick={(e) => {
          e.stopPropagation();
          setPopupVisible(true);
        }}
      />
    </span>
  ) : null;

  const triggerElement = children ?? defaultTrigger;

  if (!triggerElement) {
    return null;
  }

  const popoverContent = (
    // Stop click/enter from bubbling to parent collapsible panels
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="tw:w-80"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}>
      {previewSelected && (
        <div className="tw:flex tw:flex-col tw:gap-2 tw:px-3 tw:py-3 tw:bg-secondary tw:border-b tw:border-primary">
          <span className="tw:text-sm tw:text-tertiary">
            {t('label.selected-entity', {
              entity: label ?? t('label.owner-plural'),
            })}
          </span>
          <div className="tw:flex tw:flex-wrap tw:gap-1 tw:max-h-24 tw:overflow-y-auto">
            {selectedUsers.map((user) => {
              return (
                <UserTag
                  closable
                  avatarType="outlined"
                  className="user-team-pills"
                  id={user.name ?? ''}
                  isTeam={user.type === EntityType.TEAM}
                  key={user.id}
                  name={getEntityName(user)}
                  size={UserTagSize.small}
                  onRemove={() => onRemove(user.id)}
                />
              );
            })}
          </div>
        </div>
      )}
      <Tabs
        data-testid="select-owner-tabs"
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as 'teams' | 'users')}>
        <Tabs.List
          className="tw:px-2 tw:pt-2"
          size="sm"
          type="underline">
          <Tabs.Item badge={count.team} id="teams">
            {t('label.team-plural')}
          </Tabs.Item>
          <Tabs.Item badge={count.user} id="users">
            {t('label.user-plural')}
          </Tabs.Item>
        </Tabs.List>
        <Tabs.Panel data-testid="owner-select-teams-panel" id="teams">
          <SelectableList
            customTagRenderer={TeamListItemRenderer}
            fetchOptions={fetchTeamOptions}
            height={listHeight}
            multiSelect={isMultiTeam}
            searchBarDataTestId="owner-select-teams-search-bar"
            searchPlaceholder={t('label.search-for-type', {
              type: t('label.team'),
            })}
            selectedItems={defaultTeams}
            onCancel={handleCancelSelectableList}
            onChange={isMultiTeam ? handleChange : noop}
            onUpdate={handleUpdate}
          />
        </Tabs.Panel>
        <Tabs.Panel data-testid="owner-select-users-panel" id="users">
          <SelectableList
            fetchOptions={fetchUserOptions}
            height={listHeight}
            multiSelect={isMultiUser}
            searchBarDataTestId="owner-select-users-search-bar"
            searchPlaceholder={t('label.search-for-type', {
              type: t('label.user'),
            })}
            selectedItems={defaultUsers}
            onCancel={handleCancelSelectableList}
            onChange={isMultiUser ? handleChange : noop}
            onUpdate={handleUpdate}
          />
        </Tabs.Panel>
      </Tabs>
    </div>
  );

  return (
    <PopoverTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      {triggerElement}
      <Popover
        containerClassName={classNames(
          'tw:overflow-hidden tw:p-0',
          overlayClassName
        )}
        placement="bottom end"
        triggerRef={children ? undefined : triggerRef}>
        {popoverContent}
      </Popover>
    </PopoverTrigger>
  );
};
