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
import { ButtonUtility, Owner } from '@openmetadata/ui-core-components';
import { Edit01, Plus } from '@openmetadata/ui-core-components/icons';
import { isEmpty } from 'lodash';
import { lazy, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { EntityReference } from '../../../../generated/entity/type';
import { getOwnerVersionLabel } from '../../../../utils/EntityVersionUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import WidgetCard from '../../../common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { CommonWidgetComponent, GenericEntity } from '../CommonWidgets.types';

const UserTeamSelectableList = withSuspenseFallback(
  lazy(() =>
    import(
      '../../../common/UserTeamSelectableList/UserTeamSelectableList.component'
    ).then((m) => ({ default: m.UserTeamSelectableList }))
  ),
  null
);

export const OwnerWidget: CommonWidgetComponent = () => {
  const { data, permissions, isVersionView, entityRules, onUpdate } =
    useGenericContext<GenericEntity>();
  const { t } = useTranslation();
  const owners = data.owners;
  const { canEditOwners } = useMemo(
    () => getDerivedPermissionFlags(permissions, data.deleted),
    [permissions, data.deleted]
  );
  const handleOwnerUpdate = useCallback(
    async (updatedOwners?: EntityReference[]) => {
      await onUpdate({ ...data, owners: updatedOwners });
    },
    [data, onUpdate]
  );

  return (
    <WidgetCard
      dataTestId="glossary-right-panel-owner-link"
      headerExtra={
        !isVersionView && canEditOwners ? (
          <UserTeamSelectableList
            hasPermission={Boolean(canEditOwners)}
            listHeight={200}
            multiple={{
              user: entityRules.canAddMultipleUserOwners,
              team: entityRules.canAddMultipleTeamOwner,
            }}
            owner={owners}
            onUpdate={handleOwnerUpdate}>
            {isEmpty(owners) ? (
              <ButtonUtility
                data-testid="add-owner"
                icon={Plus}
                tooltip={t('label.add-entity', {
                  entity: t('label.owner-plural'),
                })}
              />
            ) : (
              <ButtonUtility
                data-testid="edit-owner"
                icon={Edit01}
                tooltip={t('label.edit-entity', {
                  entity: t('label.owner-plural'),
                })}
              />
            )}
          </UserTeamSelectableList>
        ) : null
      }
      isExpandDisabled={isEmpty(owners)}
      title={t('label.owner-plural')}>
      {isVersionView ? (
        getOwnerVersionLabel(
          data,
          isVersionView,
          TabSpecificField.OWNERS,
          canEditOwners
        )
      ) : (
        <Owner isCompactView={false} owners={owners ?? []} showLabel={false} />
      )}
    </WidgetCard>
  );
};
