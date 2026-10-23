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

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../../../../../generated/entity/teams/user';
import { EntityReference } from '../../../../../generated/entity/type';
import { useAuth } from '../../../../../hooks/authHooks';
import { useProfileCopy } from '../../../../../hooks/discovery/personal-space/useUserProfile';
import DomainSelect from '../../../../common/DomainSelect/DomainSelect';
import {
  getDirectDomains,
  hasDirectDomainChanges,
  mergeDomainEdits,
} from '../tabs/members/Members.utils';
import ChipView from './ChipView';
import InlineEditCard from './InlineEditCard';

interface DomainsRowProps {
  userData: User;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<boolean>;
  // Overrides the default admin-only rule (e.g. per-user EditAll permission).
  canEdit?: boolean;
  // Overrides the first-person description used on your own profile.
  description?: string;
}

const DomainsRow: React.FC<DomainsRowProps> = ({
  userData,
  updateUserDetails,
  canEdit: canEditProp,
  description,
}) => {
  const { t } = useTranslation();
  const copy = useProfileCopy(userData);
  const { isAdminUser } = useAuth();
  const canEdit = canEditProp ?? (Boolean(isAdminUser) && !userData.deleted);
  const [draft, setDraft] = useState<EntityReference[]>(
    getDirectDomains(userData.domains)
  );

  const handleSave = async () => {
    return updateUserDetails(
      {
        domains:
          mergeDomainEdits(
            userData.domains,
            draft.map((domain) => domain.id)
          ) ?? [],
      },
      'domains'
    );
  };

  return (
    <InlineEditCard
      canEdit={canEdit}
      description={
        description ??
        copy(
          'message.domain-belong-description',
          'message.domain-belong-description-of-user'
        )
      }
      isSaveDisabled={
        !hasDirectDomainChanges(
          userData.domains,
          draft.map((domain) => domain.id)
        )
      }
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
      onCancel={() => setDraft(getDirectDomains(userData.domains))}
      onEnterEdit={() => setDraft(getDirectDomains(userData.domains))}
      onSave={handleSave}
    />
  );
};

export default DomainsRow;
