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
import { Typography } from 'antd';
import classNames from 'classnames';
import { cloneDeep, includes, isEmpty, isEqual } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TabSpecificField } from '../../../enums/entity.enum';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/tests/testCase';
import { getOwnerVersionLabel } from '../../../utils/EntityVersionUtils';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import {
  EditIconButton,
  PlusIconButton,
} from '../../common/IconButtons/EditIconButton';
import { UserSelectableList } from '../../common/UserSelectableList/UserSelectableList.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';

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
      editOwnerPermission: permissions.EditAll || permissions.EditOwners,
      editAllPermission: permissions.EditAll,
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

  const header = (
    <div className={`d-flex items-center gap-2 `}>
      <Typography.Text
        className={classNames('text-sm font-medium')}
        data-testid="domain-expert-heading-name">
        {t('label.expert-plural')}
      </Typography.Text>
      {!isVersionView && editOwnerPermission && (
        <UserSelectableList
          hasPermission
          popoverProps={{ placement: 'topLeft' }}
          selectedUsers={domain.experts ?? []}
          onUpdate={handleExpertsUpdate}>
          {isEmpty(domain.experts) ? (
            <PlusIconButton
              data-testid="Add"
              size="small"
              title={t('label.add-entity', {
                entity: t('label.expert-plural'),
              })}
            />
          ) : (
            <EditIconButton
              newLook
              data-testid="edit-expert-button"
              size="small"
              title={t('label.edit-entity', {
                entity: t('label.expert-plural'),
              })}
            />
          )}
        </UserSelectableList>
      )}
    </div>
  );

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
    <ExpandableCard
      cardProps={{
        title: header,
      }}
      dataTestId="domain-expert-name"
      isExpandDisabled={isEmpty(domain.experts)}>
      {content}
    </ExpandableCard>
  );
};
