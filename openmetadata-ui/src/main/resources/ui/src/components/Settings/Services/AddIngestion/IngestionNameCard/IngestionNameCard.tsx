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

import {
  HintText,
  Input,
  Label,
  Owner,
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../../enums/entity.enum';
import { EntityReference } from '../../../../../generated/entity/type';
import { useEntityRules } from '../../../../../hooks/useEntityRules';
import { toOwnerRefs } from '../../../../../utils/Owner/ownerConversionUtils';
import { UserTeamSelectableList } from '../../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../../../../common/WidgetActionButton/WidgetActionButton';

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
  const showOwnersError = isOwnersRequired && isOwnersInvalid;

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
      <div className="tw:my-3 tw:h-px tw:bg-border-secondary" />
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

      <fieldset
        aria-describedby={
          showOwnersError ? 'ingestion-owners-error' : undefined
        }
        aria-label={t('label.owner-plural')}
        className="tw:mt-4"
        data-testid="ingestion-owners-field">
        <div className="tw:flex tw:items-center tw:gap-2">
          <Label isRequired={isOwnersRequired}>{t('label.owner-plural')}</Label>
          <UserTeamSelectableList
            hasPermission
            listHeight={200}
            multiple={{
              user: entityRules.canAddMultipleUserOwners,
              team: entityRules.canAddMultipleTeamOwner,
            }}
            owner={owners}
            onUpdate={onOwnersChange}>
            {isEmpty(owners) ? (
              <WidgetPlusButton
                data-testid="add-owner"
                title={t('label.add-entity', {
                  entity: t('label.owner-plural'),
                })}
              />
            ) : (
              <WidgetEditButton
                data-testid="edit-owner"
                title={t('label.edit-entity', {
                  entity: t('label.owner-plural'),
                })}
              />
            )}
          </UserTeamSelectableList>
        </div>
        <Owner
          className="tw:mt-2"
          data-testid="ingestion-owners"
          isCompactView={false}
          owners={toOwnerRefs(owners)}
          showLabel={false}
        />
        {showOwnersError && (
          <HintText
            isInvalid
            className="tw:mt-1"
            data-testid="owners-error"
            id="ingestion-owners-error">
            {t('label.field-required-plural', {
              field: t('label.owner-plural'),
            })}
          </HintText>
        )}
      </fieldset>
    </div>
  );
};

export default IngestionNameCard;
