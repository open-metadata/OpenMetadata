/*
 *  Copyright 2026 Collate.
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

import { Autocomplete, SelectItemType } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import { Key, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_MEDIUM } from '../../../../../../constants/constants';
import { SearchIndex } from '../../../../../../enums/search.enum';
import { EntityReference } from '../../../../../../generated/entity/type';
import { UserSearchSource } from '../../../../../../interface/search.interface';
import { searchData } from '../../../../../../rest/miscAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';

interface UserMultiSelectProps {
  selectedUsers: EntityReference[];
  onChange: (users: EntityReference[]) => void;
  disabled?: boolean;
  placeholder?: string;
  'data-testid'?: string;
}

const toRef = (user: UserSearchSource): EntityReference => ({
  id: user.id,
  type: 'user',
  name: user.name,
  displayName: user.displayName,
  fullyQualifiedName: user.fullyQualifiedName,
});

const toItem = (user: EntityReference, avatarUrl?: string): SelectItemType => ({
  id: user.id,
  label: getEntityName(user),
  avatarUrl,
});

const UserMultiSelect = ({
  selectedUsers,
  onChange,
  disabled,
  placeholder,
  'data-testid': dataTestId,
}: UserMultiSelectProps) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<EntityReference[]>([]);
  // Accumulates every user we have seen (search hits + selected) so chips keep
  // their labels after the search list changes.
  const knownUsers = useRef<Map<string, EntityReference>>(new Map());

  useEffect(() => {
    selectedUsers.forEach((u) => knownUsers.current.set(u.id, u));
  }, [selectedUsers]);

  const searchUsers = useCallback(async (query: string) => {
    try {
      const res = await searchData(
        query || '*',
        0,
        PAGE_SIZE_MEDIUM,
        '',
        '',
        '',
        SearchIndex.USER
      );
      const refs = res.data.hits.hits.map((hit) => {
        const ref = toRef(hit._source as UserSearchSource);
        knownUsers.current.set(ref.id, ref);

        return ref;
      });
      setOptions(refs);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, []);

  const debouncedSearch = useMemo(
    () => debounce(searchUsers, 300),
    [searchUsers]
  );

  useEffect(() => {
    searchUsers('');

    return () => debouncedSearch.cancel();
  }, [searchUsers, debouncedSearch]);

  const items = useMemo<SelectItemType[]>(
    () => options.map((u) => toItem(u)),
    [options]
  );

  const selectedItems = useMemo<SelectItemType[]>(
    () => selectedUsers.map((u) => toItem(u)),
    [selectedUsers]
  );

  const handleInserted = useCallback(
    (key: Key) => {
      const ref = knownUsers.current.get(String(key));
      if (!ref || selectedUsers.some((u) => u.id === ref.id)) {
        return;
      }
      onChange([...selectedUsers, ref]);
    },
    [onChange, selectedUsers]
  );

  const handleCleared = useCallback(
    (key: Key) => {
      onChange(selectedUsers.filter((u) => u.id !== String(key)));
    },
    [onChange, selectedUsers]
  );

  return (
    <Autocomplete
      data-testid={dataTestId}
      filterOption={() => true}
      isDisabled={disabled}
      items={items}
      placeholder={
        placeholder ??
        t('label.search-for-type', { type: t('label.user-plural') })
      }
      selectedItems={selectedItems}
      onItemCleared={handleCleared}
      onItemInserted={handleInserted}
      onSearchChange={(value) => debouncedSearch(value)}>
      {(item) => (
        <Autocomplete.Item id={item.id} key={item.id}>
          {item.label}
        </Autocomplete.Item>
      )}
    </Autocomplete>
  );
};

export default UserMultiSelect;
