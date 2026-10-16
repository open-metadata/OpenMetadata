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

import { HintText, Label, Owner } from '@openmetadata/ui-core-components';
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

interface IngestionOwnersFieldProps {
  owners: EntityReference[];
  canEdit: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  onChange: (owners?: EntityReference[]) => void;
}

const IngestionOwnersField = ({
  owners,
  canEdit,
  isRequired = false,
  isInvalid = false,
  onChange,
}: IngestionOwnersFieldProps) => {
  const { t } = useTranslation();
  const { entityRules } = useEntityRules(EntityType.INGESTION_PIPELINE);
  const showOwnersError = isRequired && isInvalid;

  return (
    <fieldset
      aria-describedby={showOwnersError ? 'ingestion-owners-error' : undefined}
      aria-label={t('label.owner-plural')}
      data-testid="ingestion-owners-field">
      <div className="tw:flex tw:items-center tw:gap-2">
        <Label isRequired={isRequired}>{t('label.owner-plural')}</Label>
        {/* `hasPermission` alone would not gate this: the picker only honours
            it for its own default trigger, and a consumer-supplied trigger
            (below) stays clickable. So the whole selector is withheld — the
            same shape the Glossary/Classification owners widgets use. */}
        {canEdit && (
          <UserTeamSelectableList
            hasPermission={canEdit}
            listHeight={200}
            multiple={{
              user: entityRules.canAddMultipleUserOwners,
              team: entityRules.canAddMultipleTeamOwner,
            }}
            owner={owners}
            onUpdate={onChange}>
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
        )}
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
  );
};

export default IngestionOwnersField;
