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

import { HintText, Input, Owner } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../enums/entity.enum';
import { EntityReference } from '../../../../../generated/entity/type';
import { useEntityRules } from '../../../../../hooks/useEntityRules';
import { toOwnerRefs } from '../../../../../utils/Owner/ownerConversionUtils';
import { UserTeamSelectableList } from '../../../../common/UserTeamSelectableList/UserTeamSelectableList.component';

interface IngestionNameCardProps {
  displayName: string;
  owners: EntityReference[];
  isOwnersRequired?: boolean;
  isOwnersInvalid?: boolean;
  onDisplayNameChange: (value: string) => void;
  onOwnersChange: (owners?: EntityReference[]) => void;
  onFocus?: (fieldName: string) => void;
}

const IngestionNameCard = ({
  displayName,
  owners,
  isOwnersRequired = false,
  isOwnersInvalid = false,
  onDisplayNameChange,
  onOwnersChange,
  onFocus,
}: IngestionNameCardProps) => {
  const { t } = useTranslation();
  const { entityRules } = useEntityRules(EntityType.INGESTION_PIPELINE);

  return (
    <div
      className="tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-5 tw:shadow-xs"
      data-testid="ingestion-name-card">
      <div className="tw:text-sm tw:font-semibold tw:leading-6 tw:text-primary">
        {t('label.name-this-ingestion')}
      </div>
      <div className="tw:mt-0.5 tw:text-xs tw:text-tertiary">
        {t('message.name-this-ingestion-description')}
      </div>
      <div className="tw:my-3 tw:h-px tw:bg-[var(--tw-color-border-secondary)]" />
      <Input
        isRequired
        id="ingestion-display-name"
        inputDataTestId="ingestion-display-name"
        label={t('label.name')}
        placeholder={t('label.name')}
        value={displayName}
        onChange={onDisplayNameChange}
        onFocus={() => onFocus?.('displayName')}
      />
      <div className="tw:mt-4" data-testid="ingestion-owners-field">
        <Owner
          hasPermission
          showLabel
          data-testid="ingestion-owners"
          isCompactView={false}
          owners={toOwnerRefs(owners)}
          selectorContent={
            <UserTeamSelectableList
              hasPermission
              previewSelected
              multiple={{
                user: entityRules.canAddMultipleUserOwners,
                team: entityRules.canAddMultipleTeamOwner,
              }}
              owner={owners}
              triggerDataTestId="add-ingestion-owners"
              onUpdate={onOwnersChange}
            />
          }
        />
        {isOwnersRequired && isOwnersInvalid && (
          <HintText isInvalid className="tw:mt-1" data-testid="owners-error">
            {t('label.field-required-plural', {
              field: t('label.owner-plural'),
            })}
          </HintText>
        )}
      </div>
    </div>
  );
};

export default IngestionNameCard;
