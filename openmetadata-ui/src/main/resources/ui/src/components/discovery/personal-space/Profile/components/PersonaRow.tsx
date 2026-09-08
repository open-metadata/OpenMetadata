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
import { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../enums/entity.enum';
import { Persona } from '../../../../../generated/entity/teams/persona';
import {
  EntityReference,
  User,
} from '../../../../../generated/entity/teams/user';
import { useAuth } from '../../../../../hooks/authHooks';
import { searchPersonas } from '../../../../../rest/PersonaAPI';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import ChipView from './ChipView';
import InlineEditCard from './InlineEditCard';
import RemovableChip from './RemovableChip';

const personaToRef = (persona: Persona): EntityReference => ({
  id: persona.id,
  type: EntityType.PERSONA,
  name: persona.name,
  displayName: persona.displayName,
  fullyQualifiedName: persona.fullyQualifiedName,
});

const mergeFetchedPersonas =
  (list: Persona[]) =>
  (prev: Record<string, EntityReference>): Record<string, EntityReference> => {
    const next = { ...prev };
    list.forEach((persona) => {
      next[persona.id] = personaToRef(persona);
    });

    return next;
  };

interface PersonaRowProps {
  userData: User;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

const PersonaRow: React.FC<PersonaRowProps> = ({
  userData,
  updateUserDetails,
}) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  // Persona assignment is admin-managed (like teams/roles); users pick their
  // own default persona in DefaultPersonaRow, not the assignment here.
  const canEdit = Boolean(isAdminUser) && !userData.deleted;

  const initialPersonaIds = useMemo(
    () => (userData.personas ?? []).map((p) => p.id),
    [userData.personas]
  );

  const [draftPersonaIds, setDraftPersonaIds] =
    useState<string[]>(initialPersonaIds);
  const [personaResults, setPersonaResults] = useState<Persona[]>([]);
  // Accumulates every persona ref the search has returned so a selected persona
  // keeps its full ref (name/FQN) on save even after the query changes — the save
  // endpoint sorts by name and 500s on a bare {id, type} ref.
  const [fetchedById, setFetchedById] = useState<
    Record<string, EntityReference>
  >({});

  // The persona list only feeds the edit dropdown, so fetch page 1 lazily when
  // the row enters edit mode — not on every profile page load.
  const fetchPersonas = useCallback((query: string) => {
    searchPersonas(query, 50)
      .then((res) => {
        const list = res ?? [];
        setPersonaResults(list);
        setFetchedById(mergeFetchedPersonas(list));
      })
      .catch((err) => showErrorToast(err as AxiosError));
  }, []);

  // `draftPersonaIds` is seeded once at mount, and ProfilePage mounts this row
  // against the store's `currentUser` — which carries no personas until the
  // getUserByName backfill lands. Re-seeding the draft here means the editor
  // always opens from what the row is currently displaying, so a save can never
  // write back a set captured before a refresh.
  const handleEnterEdit = useCallback(() => {
    setDraftPersonaIds(initialPersonaIds);
    fetchPersonas('');
  }, [fetchPersonas, initialPersonaIds]);

  const searchPersonasDebounced = useMemo(
    () => debounce((query: string) => fetchPersonas(query), 300),
    [fetchPersonas]
  );

  useEffect(
    () => () => searchPersonasDebounced.cancel(),
    [searchPersonasDebounced]
  );

  const resolvedById = useMemo(() => {
    const map = new Map<string, EntityReference>();
    Object.values(fetchedById).forEach((p) => map.set(p.id, p));
    (userData.personas ?? []).forEach((p) => map.set(p.id, p));
    (userData.inheritedPersonas ?? []).forEach((p) => map.set(p.id, p));
    if (userData.defaultPersona) {
      map.set(userData.defaultPersona.id, userData.defaultPersona);
    }

    return map;
  }, [fetchedById, userData]);

  // Only the current search page (+ the user's assigned personas), never the
  // accumulated pool — otherwise stale results from earlier queries linger.
  const options = useMemo(() => {
    const fetched = personaResults.map((p) => ({
      id: p.id,
      label: getEntityName(p),
    }));
    const existing = (userData.personas ?? []).map((p) => ({
      id: p.id,
      label: getEntityName(p),
    }));

    return uniqBy([...existing, ...fetched], 'id');
  }, [personaResults, userData.personas]);

  const selectedItems = useMemo(
    () =>
      draftPersonaIds
        .map((id) => resolvedById.get(id))
        .filter((p): p is EntityReference => Boolean(p))
        .map((p) => ({ id: p.id, label: getEntityName(p) })),
    [draftPersonaIds, resolvedById]
  );

  const handleSave = async () => {
    const selectedPersonas = draftPersonaIds
      .map((id) => resolvedById.get(id))
      .filter((p): p is EntityReference => Boolean(p));
    await updateUserDetails({ personas: selectedPersonas }, 'personas');
  };

  const handleItemCleared = useCallback(
    (key: Key) => setDraftPersonaIds((prev) => prev.filter((id) => id !== key)),
    []
  );

  const handleItemInserted = useCallback(
    (key: Key) =>
      setDraftPersonaIds((prev) =>
        prev.includes(key as string) ? prev : [...prev, key as string]
      ),
    []
  );

  return (
    <InlineEditCard
      canEdit={canEdit}
      description={t('message.persona-assigned-description')}
      lockedLabel={t('label.admin-managed')}
      renderEdit={() => (
        <Autocomplete
          multiple
          aria-label={t('label.persona')}
          data-testid="persona-multiselect"
          filterOption={() => true}
          items={options}
          placeholder={t('label.select-entity', {
            entity: t('label.persona-plural'),
          })}
          renderTag={(item, onRemove) => (
            <RemovableChip
              key={item.id}
              label={item.label ?? ''}
              testId={`persona-remove-${item.label ?? ''}`}
              onRemove={onRemove}
            />
          )}
          selectedItems={selectedItems}
          onItemCleared={handleItemCleared}
          onItemInserted={handleItemInserted}
          onSearchChange={searchPersonasDebounced}>
          {(item) => (
            <Autocomplete.Item id={item.id}>{item.label}</Autocomplete.Item>
          )}
        </Autocomplete>
      )}
      testId="persona"
      title={t('label.persona')}
      view={
        <ChipView
          label={t('label.persona')}
          noDataPlaceholder={t('message.no-persona-assigned')}
          values={userData.personas ?? []}
        />
      }
      onCancel={() => setDraftPersonaIds(initialPersonaIds)}
      onEnterEdit={handleEnterEdit}
      onSave={handleSave}
    />
  );
};

export default PersonaRow;
