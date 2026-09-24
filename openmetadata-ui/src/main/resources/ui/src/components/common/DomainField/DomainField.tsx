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
import { ButtonUtility, Typography } from '@openmetadata/ui-core-components';
import { Edit } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { get, isEmpty, isUndefined } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityReference } from '../../../generated/entity/type';
import {
  getAPIfromSource,
  getEntityAPIfromSource,
} from '../../../utils/Assets/AssetsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AssetsUnion } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { DataAssetWithDomains } from '../../DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import DomainSelect from '../DomainSelect/DomainSelect';
import DomainTags from '../DomainTags/DomainTags';
import { DomainFieldProps } from './DomainField.types';

const DomainField: FC<DomainFieldProps> = ({
  domains,
  entityType,
  entityFqn,
  entityId,
  hasPermission = false,
  multiple = false,
  showDomainHeading = false,
  maxVisible,
  afterDomainUpdateAction,
  onUpdate,
  onCreate,
  createLabel,
  'data-testid': dataTestId,
}) => {
  const { t } = useTranslation();
  const [activeDomain, setActiveDomain] = useState<EntityReference[]>([]);

  useEffect(() => {
    setActiveDomain(domains ?? []);
  }, [domains]);

  const handleDomainSave = useCallback(
    async (selectedDomain?: EntityReference | EntityReference[]) => {
      try {
        const entityDetailsResponse = await getEntityAPIfromSource(
          entityType as AssetsUnion
        )(entityFqn, { fields: 'domains' });

        if (!entityDetailsResponse) {
          return;
        }

        let updatedDomains: EntityReference[];
        if (Array.isArray(selectedDomain)) {
          updatedDomains = selectedDomain;
        } else if (isEmpty(selectedDomain)) {
          updatedDomains = [];
        } else {
          updatedDomains = [selectedDomain as EntityReference];
        }

        const jsonPatch = compare(entityDetailsResponse, {
          ...entityDetailsResponse,
          domains: updatedDomains,
        });

        const res = await getAPIfromSource(entityType as AssetsUnion)(
          entityId,
          jsonPatch
        );

        const entityDomains = get(res, 'domains', []);
        let nextDomains: EntityReference[];
        if (Array.isArray(entityDomains)) {
          nextDomains = entityDomains;
        } else if (isEmpty(entityDomains)) {
          nextDomains = [];
        } else {
          nextDomains = [entityDomains];
        }
        setActiveDomain(nextDomains);

        if (!isUndefined(afterDomainUpdateAction)) {
          afterDomainUpdateAction(res as DataAssetWithDomains);
        }
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [entityType, entityFqn, entityId, afterDomainUpdateAction]
  );

  const handleUpdate = onUpdate ?? handleDomainSave;

  const editor = hasPermission ? (
    <DomainSelect
      hasPermission
      createLabel={createLabel}
      multiple={multiple}
      renderTrigger={({ toggle }) => (
        <ButtonUtility
          color="tertiary"
          data-testid="add-domain"
          icon={Edit}
          size="xs"
          tooltip={t('label.edit-entity', {
            entity: t('label.domain-plural'),
          })}
          onClick={toggle}
        />
      )}
      selectedDomain={activeDomain}
      triggerVariant="button"
      onCreate={onCreate}
      onUpdate={handleUpdate}
    />
  ) : null;

  const chips = (
    <DomainTags domains={activeDomain} maxVisible={maxVisible} size="sm" />
  );

  const heading = useMemo(
    () => (
      <Typography className="tw:text-sm tw:font-medium" size="text-sm">
        {t('label.domain-plural')}
      </Typography>
    ),
    [t]
  );

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-2"
      data-testid={dataTestId ?? 'domain-container'}>
      {showDomainHeading && (
        <div
          className="tw:flex tw:items-center tw:gap-1"
          data-testid="header-domain-container">
          {heading}
          {editor}
        </div>
      )}
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        {chips}
        {!showDomainHeading && editor}
      </div>
    </div>
  );
};

export default DomainField;
