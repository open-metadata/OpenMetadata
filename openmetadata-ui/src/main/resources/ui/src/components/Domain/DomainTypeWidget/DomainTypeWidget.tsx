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
import { Box } from '@openmetadata/ui-core-components';
import { cloneDeep } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Domain, DomainType } from '../../../generated/entity/domains/domain';
import { domainTypeTooltipDataRender } from '../../../utils/DomainUtils';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../../common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import DomainTypeSelectForm from '../DomainTypeSelectForm/DomainTypeSelectForm.component';

export const DomainTypeWidget = () => {
  const {
    data: domain,
    permissions,
    onUpdate,
    isVersionView,
  } = useGenericContext<Domain>();
  const [editDomainType, setEditDomainType] = useState(false);
  const { t } = useTranslation();

  const { editAllPermission } = useMemo(
    () => ({
      editAllPermission: permissions.EditAll,
    }),
    [permissions]
  );

  const handleDomainTypeUpdate = async (domainType: string) => {
    let updatedDomain = cloneDeep(domain);
    updatedDomain = {
      ...updatedDomain,
      domainType: domainType as DomainType,
    };
    await onUpdate(updatedDomain);
    setEditDomainType(false);
  };

  const domainTypeActionButton = domain.domainType ? (
    <WidgetEditButton
      data-testid="edit-domainType-button"
      title={t('label.edit-entity', { entity: t('label.domain-type') })}
      onClick={() => setEditDomainType(true)}
    />
  ) : (
    <WidgetPlusButton
      data-testid="add-domainType-button"
      title={t('label.add-entity', { entity: t('label.domain-type') })}
      onClick={() => setEditDomainType(true)}
    />
  );

  const headerExtra =
    !isVersionView && editAllPermission ? domainTypeActionButton : null;

  const content = (
    <>
      {!editDomainType && (
        <Box data-testid="domain-type-label" gap={2} wrap="wrap">
          {domain?.domainType}
        </Box>
      )}

      {editDomainType && (
        <DomainTypeSelectForm
          defaultValue={domain.domainType}
          onCancel={() => setEditDomainType(false)}
          onSubmit={handleDomainTypeUpdate}
        />
      )}
    </>
  );

  return (
    <WidgetCard
      dataTestId="domainType"
      forceExpand={editDomainType}
      headerExtra={headerExtra}
      helperText={domainTypeTooltipDataRender()}
      isExpandDisabled={!domain.domainType && !editDomainType}
      title={t('label.domain-type')}>
      {content}
    </WidgetCard>
  );
};
