/*
 *  Copyright 2025 Collate.
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

import { Autocomplete } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { debounce, uniqBy } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { TERM_ADMIN } from '../../../../../constants/constants';
import { Role } from '../../../../../generated/entity/teams/role';
import {
  EntityReference,
  User,
} from '../../../../../generated/entity/teams/user';
import { useAuth } from '../../../../../hooks/authHooks';
import { searchRoles } from '../../../../../rest/rolesAPIV1';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import ChipBadgeList from './ChipBadgeList';
import InlineEditCard from './InlineEditCard';
import RemovableChip from './RemovableChip';

interface RolesRowProps {
  userData: User;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

const RolesRow: React.FC<RolesRowProps> = ({ userData, updateUserDetails }) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const canEdit = Boolean(isAdminUser) && !userData.deleted;

  const initialRoleIds = useMemo(() => {
    const ids = (userData.roles ?? []).map((r) => r.id);
    if (userData.isAdmin) {
      ids.push(TERM_ADMIN);
    }

    return ids;
  }, [userData.roles, userData.isAdmin]);

  const [draftRoleIds, setDraftRoleIds] = useState<string[]>(initialRoleIds);
  const [roleOptions, setRoleOptions] = useState<Role[]>([]);

  const fetchRoles = useCallback((query: string) => {
    searchRoles(query, 50)
      .then((res) => setRoleOptions(res ?? []))
      .catch((err) => showErrorToast(err as AxiosError));
  }, []);

  const searchRolesDebounced = useMemo(
    () => debounce((query: string) => fetchRoles(query), 300),
    [fetchRoles]
  );

  useEffect(() => () => searchRolesDebounced.cancel(), [searchRolesDebounced]);

  const options = useMemo(() => {
    const fetched = roleOptions.map((r) => ({
      id: r.id,
      label: getEntityName(r),
    }));
    const existing = (userData.roles ?? []).map((r) => ({
      id: r.id,
      label: getEntityName(r),
    }));
    const adminOption = isAdminUser
      ? [{ id: TERM_ADMIN, label: t('label.admin') }]
      : [];

    return uniqBy([...adminOption, ...existing, ...fetched], 'id');
  }, [roleOptions, userData.roles, isAdminUser, t]);

  const selectedItems = useMemo(
    () => options.filter((o) => draftRoleIds.includes(o.id)),
    [options, draftRoleIds]
  );

  const handleRoleCleared = useCallback((key: Key) => {
    setDraftRoleIds((prev) => prev.filter((id) => id !== key));
  }, []);

  const handleSave = async () => {
    const isAdmin = draftRoleIds.includes(TERM_ADMIN);
    const currentRoles = userData.roles ?? [];
    const draftRoleIdSet = new Set(draftRoleIds);
    const currentRoleIdSet = new Set(currentRoles.map((role) => role.id));
    const retainedRoles = currentRoles.filter((role) =>
      draftRoleIdSet.has(role.id)
    );
    const newlyAddedRoles = draftRoleIds
      .filter((id) => id !== TERM_ADMIN && !currentRoleIdSet.has(id))
      .map((id) => ({ id, type: 'role' }));
    await updateUserDetails(
      { roles: [...retainedRoles, ...newlyAddedRoles], isAdmin },
      'roles'
    );
  };

  // Admin is stored as `isAdmin`, not as a role entity, so surface it as a
  // synthetic chip — otherwise an admin-only user reads as "No roles assigned".
  const roleChips = useMemo(() => {
    const chips: EntityReference[] = [...(userData.roles ?? [])];
    if (userData.isAdmin) {
      chips.push({
        id: TERM_ADMIN,
        type: 'role',
        name: t('label.admin'),
        displayName: t('label.admin'),
      });
    }

    return chips;
  }, [userData.roles, userData.isAdmin, t]);

  return (
    <InlineEditCard
      canEdit={canEdit}
      description={t('message.role-granting-description')}
      lockedLabel={t('label.admin-managed')}
      renderEdit={() => (
        <Autocomplete
          multiple
          aria-label={t('label.role-plural')}
          data-testid="roles-multiselect"
          filterOption={() => true}
          items={options}
          placeholder={t('label.select-entity', {
            entity: t('label.role-plural'),
          })}
          renderTag={(item, onRemove) => (
            <RemovableChip
              key={item.id}
              label={item.label ?? ''}
              testId={`roles-remove-${item.label ?? ''}`}
              onRemove={onRemove}
            />
          )}
          selectedItems={selectedItems}
          onItemCleared={handleRoleCleared}
          onItemInserted={(key) =>
            setDraftRoleIds((prev) =>
              prev.includes(key as string) ? prev : [...prev, key as string]
            )
          }
          onSearchChange={searchRolesDebounced}>
          {(item) => (
            <Autocomplete.Item id={item.id}>{item.label}</Autocomplete.Item>
          )}
        </Autocomplete>
      )}
      testId="roles"
      title={t('label.role-plural')}
      view={
        <ChipBadgeList
          color="purple"
          noDataPlaceholder={t('message.no-roles-assigned')}
          values={roleChips}
        />
      }
      onCancel={() => setDraftRoleIds(initialRoleIds)}
      onEnterEdit={() => {
        setDraftRoleIds(initialRoleIds);
        fetchRoles('');
      }}
      onSave={handleSave}
    />
  );
};

export default RolesRow;
