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

import type { SelectItemType } from '@openmetadata/ui-core-components';
import { Autocomplete } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { searchRoles } from '../../../../../../rest/rolesAPIV1';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import { mergeRoleItems, withoutId } from '../members/Members.utils';

interface SsoRolesAutocompleteProps {
  /** Role names — the security config stores roles by name, not id. */
  value: string[];
  testId: string;
  label?: string;
  placeholder?: string;
  hint?: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  isDisabled?: boolean;
  onChange: (roles: string[]) => void;
  onBlur?: () => void;
  onFocus?: () => void;
}

const SsoRolesAutocomplete = ({
  value,
  testId,
  label,
  placeholder,
  hint,
  isRequired,
  isInvalid,
  isDisabled,
  onChange,
  onBlur,
  onFocus,
}: SsoRolesAutocompleteProps) => {
  const [items, setItems] = useState<SelectItemType[]>([]);
  // The debounced search outlives renders; read the selection at call time.
  const valueRef = useRef(value);
  valueRef.current = value;

  const fetchRoles = useCallback(async (searchText = '') => {
    try {
      const roles = await searchRoles(searchText);
      setItems((prev) =>
        mergeRoleItems(
          prev,
          roles.map((role) => ({ id: role.name, label: getEntityName(role) })),
          valueRef.current
        )
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, []);

  const debouncedFetchRoles = useMemo(
    () => debounce(fetchRoles, 300),
    [fetchRoles]
  );

  useEffect(() => {
    void fetchRoles();

    return () => debouncedFetchRoles.cancel();
  }, [fetchRoles, debouncedFetchRoles]);

  // Memoized: Autocomplete resets its internal selection whenever this changes.
  const selectedItems = useMemo(
    () =>
      value.map((name) => ({
        id: name,
        label: items.find((item) => item.id === name)?.label ?? name,
      })),
    [value, items]
  );

  return (
    <Autocomplete
      data-testid={testId}
      hint={hint}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      isRequired={isRequired}
      items={items}
      label={label}
      placeholder={placeholder}
      selectedItems={selectedItems}
      onBlur={onBlur}
      onFocus={onFocus}
      onItemCleared={(key) => onChange(withoutId(value, key))}
      onItemInserted={(key) => onChange([...value, String(key)])}
      onSearchChange={debouncedFetchRoles}>
      {(item) => (
        <Autocomplete.Item id={item.id} key={item.id}>
          {item.label}
        </Autocomplete.Item>
      )}
    </Autocomplete>
  );
};

export default SsoRolesAutocomplete;
