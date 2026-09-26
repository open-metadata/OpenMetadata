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
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { get, isEmpty, isUndefined } from 'lodash';
import { Dispatch, SetStateAction } from 'react';
import { DomainLabelProps } from '../components/common/DomainLabel/DomainLabel.interface';
import { AssetsUnion } from '../components/DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { DataAssetWithDomains } from '../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { EntityReference } from '../generated/entity/type';
import { getAPIfromSource, getEntityAPIfromSource } from './Assets/AssetsUtils';
import { showErrorToast } from './ToastUtils';

/**
 * Stable content key for a domain list, used to skip no-op `setActiveDomain`
 * updates that would otherwise churn the state's array identity on every
 * context re-render — remounting the domain picker subtree and collapsing an
 * open picker mid-interaction. Keyed on every render-relevant field (not just
 * identity) so refreshed metadata — a renamed domain, a flipped `inherited`, a
 * changed link — still updates the chip, while unchanged data stays
 * reference-stable. JSON encoding keeps it collision-safe.
 *
 * Shared by every DomainLabel variant so they cannot drift apart again.
 */
export const getDomainsContentKey = (list: EntityReference[]): string =>
  JSON.stringify(
    list.map((d) => [
      d.id,
      d.fullyQualifiedName,
      d.name,
      d.displayName,
      d.inherited,
      d.href,
    ])
  );

const resolveDomainsForPatch = (
  selectedDomain: EntityReference | EntityReference[]
): EntityReference[] => {
  if (Array.isArray(selectedDomain)) {
    return selectedDomain;
  }

  return isEmpty(selectedDomain) ? [] : [selectedDomain];
};

/** Delegate the save to the consumer's `onUpdate`, then mirror it locally. */
export const saveDomainViaOnUpdate = async (
  selectedDomain: EntityReference | EntityReference[],
  onUpdate: DomainLabelProps['onUpdate'],
  setActiveDomain: Dispatch<SetStateAction<EntityReference[]>>
): Promise<void> => {
  if (!onUpdate) {
    return;
  }

  try {
    await onUpdate(selectedDomain);
    const updatedDomains = Array.isArray(selectedDomain)
      ? selectedDomain
      : [selectedDomain];
    setActiveDomain(updatedDomains);
  } catch (err) {
    showErrorToast(err as AxiosError);
  }
};

/** PATCH the entity's `domains` directly when no `onUpdate` is supplied. */
export const saveDomainViaApi = async (
  selectedDomain: EntityReference | EntityReference[],
  entityType: AssetsUnion,
  entityFqn: string,
  entityId: string,
  setActiveDomain: Dispatch<SetStateAction<EntityReference[]>>,
  afterDomainUpdateAction?: DomainLabelProps['afterDomainUpdateAction']
): Promise<void> => {
  try {
    const entityDetailsResponse = await getEntityAPIfromSource(entityType)(
      entityFqn,
      { fields: 'domains' }
    );
    if (!entityDetailsResponse) {
      return;
    }

    const jsonPatch = compare(entityDetailsResponse, {
      ...entityDetailsResponse,
      domains: resolveDomainsForPatch(selectedDomain),
    });

    const api = getAPIfromSource(entityType);
    const res = await api(entityId, jsonPatch);

    const entityDomains = get(res, 'domains', {}) as
      | EntityReference[]
      | EntityReference
      | undefined;
    if (Array.isArray(entityDomains)) {
      setActiveDomain(entityDomains);
    } else {
      setActiveDomain(
        isEmpty(entityDomains) || !entityDomains ? [] : [entityDomains]
      );
    }
    !isUndefined(afterDomainUpdateAction) &&
      afterDomainUpdateAction(res as DataAssetWithDomains);
  } catch (err) {
    showErrorToast(err as AxiosError);
  }
};
