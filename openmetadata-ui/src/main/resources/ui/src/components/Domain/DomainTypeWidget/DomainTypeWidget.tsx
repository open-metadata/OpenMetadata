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
  Box,
  ButtonUtility,
  FilterSelect,
} from '@openmetadata/ui-core-components';
import { Edit01, Plus } from '@openmetadata/ui-core-components/icons';
import { cloneDeep } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DOMAIN_TYPE_DISPLAY } from '../../../constants/Domain.constants';
import { Domain, DomainType } from '../../../generated/entity/domains/domain';
import { domainTypeTooltipDataRender } from '../../../utils/DomainUtils';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import WidgetCard from '../../common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';

export const DomainTypeWidget = () => {
  const {
    data: domain,
    permissions,
    onUpdate,
    isVersionView,
  } = useGenericContext<Domain>();
  const [editDomainType, setEditDomainType] = useState(false);
  const { t } = useTranslation();

  // Named-flag derivation (Task 8 prop-contract migration): `permissions` is the raw
  // OperationPermission from useGenericContext(). No `deleted` argument: `Domain` has no
  // `deleted` field (confirmed against the generated type) and the old code never gated on
  // one. Maps the raw, EditAll-only `permissions.EditAll` read onto `canEditAll` — the same
  // value, per PermissionDerivation.ts's "EditAll-only" mapping rule (not a prioritization
  // change; see DomainExpertWidget.tsx's identical case in this batch).
  const { editAllPermission } = useMemo(
    () => ({
      editAllPermission: getDerivedPermissionFlags(permissions).canEditAll,
    }),
    [permissions]
  );

  const domainTypeOptions = useMemo(
    () =>
      Object.values(DomainType).map((type) => ({
        value: type,
        label: t(DOMAIN_TYPE_DISPLAY[type].labelKey),
        icon: DOMAIN_TYPE_DISPLAY[type].icon,
      })),
    [t]
  );

  const handleDomainTypeUpdate = async ([domainType]: string[]) => {
    try {
      await onUpdate({
        ...cloneDeep(domain),
        domainType: domainType as DomainType,
      });
    } catch {
      // The page-level updater already toasts before rethrowing, and the
      // picker has closed itself.
    }
  };

  const domainTypeActionButton = domain.domainType ? (
    <ButtonUtility
      data-testid="edit-domainType-button"
      icon={Edit01}
      tooltip={t('label.edit-entity', { entity: t('label.domain-type') })}
    />
  ) : (
    <ButtonUtility
      data-testid="add-domainType-button"
      icon={Plus}
      tooltip={t('label.add-entity', { entity: t('label.domain-type') })}
    />
  );

  const headerExtra =
    !isVersionView && editAllPermission ? (
      <FilterSelect
        hideCounts
        searchable
        showRadio
        emptyState={t('label.no-entity-available', {
          entity: t('label.domain-type'),
        })}
        isClearable={false}
        isOpen={editDomainType}
        label={t('label.domain-type')}
        options={domainTypeOptions}
        selectedValues={domain.domainType ? [domain.domainType] : []}
        selectionMode="single"
        trigger={domainTypeActionButton}
        onChange={handleDomainTypeUpdate}
        onOpenChange={setEditDomainType}
      />
    ) : null;

  const content = (
    <Box data-testid="domain-type-label" gap={2} wrap="wrap">
      {domain?.domainType}
    </Box>
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
