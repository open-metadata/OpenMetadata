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
import { debounce } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Domain } from '../../../../../generated/entity/domains/domain';
import { User } from '../../../../../generated/entity/teams/user';
import { useAuth } from '../../../../../hooks/authHooks';
import { searchDomains } from '../../../../../rest/domainAPI';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../../../../utils/StringUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import ChipView from './ChipView';
import InlineEditCard from './InlineEditCard';
import RemovableChip from './RemovableChip';

interface DomainsRowProps {
  userData: User;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

const DomainsRow: React.FC<DomainsRowProps> = ({
  userData,
  updateUserDetails,
}) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const canEdit = Boolean(isAdminUser) && !userData.deleted;

  const initialIds = useMemo(
    () => (userData.domains ?? []).map((d) => d.id),
    [userData.domains]
  );
  const [draftIds, setDraftIds] = useState<string[]>(initialIds);
  const [domainList, setDomainList] = useState<Domain[]>([]);

  const fetchDomains = useCallback(async (search: string) => {
    try {
      const encoded = getEncodedFqn(escapeESReservedCharacters(search));
      const results: Domain[] = await searchDomains(encoded);
      setDomainList(results ?? []);
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, []);

  const handleSearchChange = useMemo(
    () => debounce((value: string) => fetchDomains(value), 300),
    [fetchDomains]
  );

  useEffect(() => () => handleSearchChange.cancel(), [handleSearchChange]);

  const options = useMemo(() => {
    const merged = new Map<string, { id: string; label: string }>();
    (userData.domains ?? []).forEach((d) =>
      merged.set(d.id, { id: d.id, label: getEntityName(d) })
    );
    domainList.forEach((d) =>
      merged.set(d.id ?? '', { id: d.id ?? '', label: getEntityName(d) })
    );

    return Array.from(merged.values());
  }, [domainList, userData.domains]);

  const selectedItems = useMemo(
    () => options.filter((o) => draftIds.includes(o.id)),
    [options, draftIds]
  );

  const handleSave = async () => {
    const currentDomains = userData.domains ?? [];
    const draftIdSet = new Set(draftIds);
    const currentIdSet = new Set(currentDomains.map((domain) => domain.id));
    const retainedDomains = currentDomains.filter((domain) =>
      draftIdSet.has(domain.id)
    );
    const newlyAddedDomains = draftIds
      .filter((id) => !currentIdSet.has(id))
      .map((id) => ({ id, type: 'domain' }));
    await updateUserDetails(
      { domains: [...retainedDomains, ...newlyAddedDomains] },
      'domains'
    );
  };

  const handleItemCleared = useCallback(
    (key: Key) => setDraftIds((prev) => prev.filter((id) => id !== key)),
    []
  );

  const handleItemInserted = useCallback(
    (key: Key) =>
      setDraftIds((prev) =>
        prev.includes(key as string) ? prev : [...prev, key as string]
      ),
    []
  );

  return (
    <InlineEditCard
      canEdit={canEdit}
      description={t('message.domain-belong-description')}
      renderEdit={() => (
        <Autocomplete
          multiple
          aria-label={t('label.domain-plural')}
          data-testid="domains-multiselect"
          items={options}
          placeholder={t('label.select-entity', {
            entity: t('label.domain-plural'),
          })}
          renderTag={(item, onRemove) => (
            <RemovableChip
              key={item.id}
              label={item.label ?? ''}
              testId={`domains-remove-${item.label ?? ''}`}
              onRemove={onRemove}
            />
          )}
          selectedItems={selectedItems}
          onItemCleared={handleItemCleared}
          onItemInserted={handleItemInserted}
          onSearchChange={handleSearchChange}>
          {(item) => (
            <Autocomplete.Item id={item.id}>{item.label}</Autocomplete.Item>
          )}
        </Autocomplete>
      )}
      testId="domains"
      title={t('label.domain-plural')}
      view={
        <ChipView
          label={t('label.domain-plural')}
          values={userData.domains ?? []}
        />
      }
      onCancel={() => setDraftIds(initialIds)}
      onEnterEdit={() => {
        setDraftIds(initialIds);
        fetchDomains('');
      }}
      onSave={handleSave}
    />
  );
};

export default DomainsRow;
