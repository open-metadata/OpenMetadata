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

import { isEmpty, xor } from 'lodash';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../../../../../generated/entity/teams/user';
import { EntityReference } from '../../../../../generated/entity/type';
import { useAuth } from '../../../../../hooks/authHooks';
import DomainSelect from '../../../../common/DomainSelect/DomainSelect';
import ChipView from './ChipView';
import InlineEditCard from './InlineEditCard';

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
  const [draft, setDraft] = useState<EntityReference[]>(userData.domains ?? []);

  const handleSave = async () => {
    const currentDomains = userData.domains ?? [];
    const draftIdSet = new Set(draft.map((domain) => domain.id));
    const currentIdSet = new Set(currentDomains.map((domain) => domain.id));
    // Keep the stored references as-is so the patch only touches real changes.
    const retainedDomains = currentDomains.filter((domain) =>
      draftIdSet.has(domain.id)
    );
    const newlyAddedDomains = draft
      .filter((domain) => !currentIdSet.has(domain.id))
      .map(({ id }) => ({ id, type: 'domain' }));
    await updateUserDetails(
      { domains: [...retainedDomains, ...newlyAddedDomains] },
      'domains'
    );
  };

  return (
    <InlineEditCard
      canEdit={canEdit}
      description={t('message.domain-belong-description')}
      isSaveDisabled={isEmpty(
        xor(
          draft.map((domain) => domain.id),
          (userData.domains ?? []).map((domain) => domain.id)
        )
      )}
      renderEdit={() => (
        <DomainSelect
          multiple
          data-testid="domains-multiselect"
          placeholder={t('label.select-entity', {
            entity: t('label.domain-plural'),
          })}
          selectedDomain={draft}
          onUpdate={(domains) => {
            if (Array.isArray(domains)) {
              setDraft(domains);

              return;
            }
            setDraft(domains ? [domains] : []);
          }}
        />
      )}
      testId="domains"
      title={t('label.domain-plural')}
      view={
        <ChipView
          label={t('label.domain-plural')}
          values={userData.domains ?? []}
        />
      }
      onCancel={() => setDraft(userData.domains ?? [])}
      onEnterEdit={() => setDraft(userData.domains ?? [])}
      onSave={handleSave}
    />
  );
};

export default DomainsRow;
