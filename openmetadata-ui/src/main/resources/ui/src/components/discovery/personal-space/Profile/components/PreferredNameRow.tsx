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

import { Input, Typography } from '@openmetadata/ui-core-components';
import { startCase } from 'lodash';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User } from '../../../../../generated/entity/teams/user';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import InlineEditCard from './InlineEditCard';

interface PreferredNameRowProps {
  userData: User;
  canEdit: boolean;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<boolean>;
  // The Members user page shows this as "Display Name" in third person.
  title?: string;
  description?: string;
}

const PreferredNameRow: React.FC<PreferredNameRowProps> = ({
  userData,
  canEdit,
  updateUserDetails,
  title,
  description,
}) => {
  const { t } = useTranslation();
  const displayName = getEntityName(userData);
  const [draft, setDraft] = useState(displayName);

  return (
    <InlineEditCard
      canEdit={canEdit}
      description={description ?? t('message.preferred-name-description')}
      isSaveDisabled={!draft.trim() || draft.trim() === displayName}
      renderEdit={() => (
        <Input
          data-testid="preferred-name-input"
          size="sm"
          value={draft}
          onChange={setDraft}
        />
      )}
      testId="preferred-name"
      title={title ?? t('label.preferred-name')}
      view={
        <Typography className="tw:text-primary" size="text-sm" weight="regular">
          {userData.displayName || startCase(userData.name)}
        </Typography>
      }
      onEnterEdit={() => setDraft(displayName)}
      onSave={() =>
        updateUserDetails({ displayName: draft.trim() }, 'displayName')
      }
    />
  );
};

export default PreferredNameRow;
