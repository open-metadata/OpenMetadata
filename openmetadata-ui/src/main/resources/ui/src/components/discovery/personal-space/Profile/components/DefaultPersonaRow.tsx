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

import { Autocomplete } from '@openmetadata/ui-core-components';
import {
  EntityReference,
  User,
} from '../../../../../generated/entity/teams/user';
import { useAuth } from '../../../../../hooks/authHooks';
import { useApplicationStore } from '../../../../../hooks/useApplicationStore';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ChipView from './ChipView';
import InlineEditCard from './InlineEditCard';

interface DefaultPersonaRowProps {
  userData: User;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

const DefaultPersonaRow: React.FC<DefaultPersonaRowProps> = ({
  userData,
  updateUserDetails,
}) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const { currentUser } = useApplicationStore();
  const isSelf = currentUser?.name === userData.name;
  const canEdit = (isAdminUser || isSelf) && !userData.deleted;

  const [draftDefaultId, setDraftDefaultId] = useState<string | undefined>(
    userData.defaultPersona?.id
  );

  // Only personas the user belongs to (direct + inherited) are selectable as the
  // default, plus the current default itself. Mirrors UserProfilePersona (OSS).
  const personaPool: EntityReference[] = useMemo(() => {
    const map = new Map<string, EntityReference>();
    (userData.personas ?? []).forEach((p) => map.set(p.id, p));
    (userData.inheritedPersonas ?? []).forEach((p) => map.set(p.id, p));
    if (userData.defaultPersona) {
      map.set(userData.defaultPersona.id, userData.defaultPersona);
    }

    return Array.from(map.values());
  }, [userData.personas, userData.inheritedPersonas, userData.defaultPersona]);

  const options = useMemo(
    () => personaPool.map((p) => ({ id: p.id, label: getEntityName(p) })),
    [personaPool]
  );

  const selectedItems = useMemo(
    () => options.filter((o) => o.id === draftDefaultId),
    [options, draftDefaultId]
  );

  const handleSave = async () => {
    const nextDefault = personaPool.find((p) => p.id === draftDefaultId);
    if (nextDefault?.id !== userData.defaultPersona?.id) {
      await updateUserDetails(
        { defaultPersona: nextDefault },
        'defaultPersona'
      );
    }
  };

  return (
    <InlineEditCard
      canEdit={canEdit}
      description={t('message.default-persona-description')}
      renderEdit={() => (
        <Autocomplete
          aria-label={t('label.default-persona')}
          data-testid="default-persona-select"
          items={options}
          multiple={false}
          placeholder={t('label.select-entity', {
            entity: t('label.default-persona'),
          })}
          selectedItems={selectedItems}
          onItemCleared={() => setDraftDefaultId(undefined)}
          onItemInserted={(key) => setDraftDefaultId(key as string)}>
          {(item) => (
            <Autocomplete.Item id={item.id}>{item.label}</Autocomplete.Item>
          )}
        </Autocomplete>
      )}
      testId="default-persona"
      title={t('label.default-persona')}
      view={
        <ChipView
          label={t('label.default-persona')}
          noDataPlaceholder={t('message.no-default-persona')}
          values={userData.defaultPersona ? [userData.defaultPersona] : []}
        />
      }
      onEnterEdit={() => setDraftDefaultId(userData.defaultPersona?.id)}
      onSave={handleSave}
    />
  );
};

export default DefaultPersonaRow;
