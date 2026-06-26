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
import { cloneDeep, includes, isEmpty, isEqual } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TabSpecificField } from '../../../enums/entity.enum';
import type { Domain } from '../../../generated/entity/domains/domain';
import { Operation } from '../../../generated/entity/policies/policy';
import type { EntityReference } from '../../../generated/tests/testCase';
import { getOwnerVersionLabel } from '../../../utils/EntityVersionUtils';
import { getPrioritizedEditPermission } from '../../../utils/PermissionsUtils';
import { UserSelectableList } from '../../common/UserSelectableList/UserSelectableList.component';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../../common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';

export const DomainExpertWidget = () => {
  const {
    data: domain,
    permissions,
    onUpdate,
    isVersionView,
  } = useGenericContext<Domain>();
  const { t } = useTranslation();

  const { editOwnerPermission, editAllPermission } = useMemo(
    () => ({
      editOwnerPermission:
        permissions &&
        getPrioritizedEditPermission(permissions, Operation.EditOwners),
      editAllPermission: permissions?.EditAll,
    }),
    [permissions]
  );

  const handleExpertsUpdate = async (data: Array<EntityReference>) => {
    if (!isEqual(data, domain.experts)) {
      let updatedDomain = cloneDeep(domain);
      const oldExperts = data.filter((d) => includes(domain.experts, d));
      const newExperts = data
        .filter((d) => !includes(domain.experts, d))
        .map((d) => ({
          id: d.id,
          type: d.type,
          name: d.name,
          displayName: d.displayName,
        }));
      updatedDomain = {
        ...updatedDomain,
        experts: [...oldExperts, ...newExperts],
      };
      await onUpdate(updatedDomain);
    }
  };

  const headerExtra =
    !isVersionView && editOwnerPermission ? (
      <UserSelectableList
        hasPermission
        popoverProps={{ placement: 'topLeft' }}
        selectedUsers={domain.experts ?? []}
        onUpdate={handleExpertsUpdate}>
        {isEmpty(domain.experts) ? (
          <WidgetPlusButton
            data-testid="Add"
            title={t('label.add-entity', { entity: t('label.expert-plural') })}
          />
        ) : (
          <WidgetEditButton
            data-testid="edit-expert-button"
            title={t('label.edit-entity', { entity: t('label.expert-plural') })}
          />
        )}
      </UserSelectableList>
    ) : null;

  const content = isEmpty(domain.experts) ? null : (
    <div>
      {getOwnerVersionLabel(
        domain,
        isVersionView ?? false,
        TabSpecificField.EXPERTS,
        editAllPermission
      )}
    </div>
  );

  return (
    <WidgetCard
      dataTestId="domain-expert-name"
      headerExtra={headerExtra}
      isExpandDisabled={isEmpty(domain.experts)}
      title={t('label.expert-plural')}>
      {content}
    </WidgetCard>
  );
};
