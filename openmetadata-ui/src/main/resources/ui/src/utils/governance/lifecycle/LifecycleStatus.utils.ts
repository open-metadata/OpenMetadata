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
import { SelectFieldSettings } from '@react-awesome-query-builder/ui';
import { EntityLifecycleStages } from '../../../generated/api/governance/entityLifecycleStages';
import { getEntityLifecycleStages } from '../../../rest/metadataTypeAPI';

type StatusSelection = 'union' | 'intersection';

export const resolveLifecycleStatuses = (
  lifecycle: EntityLifecycleStages,
  entityTypes: readonly string[],
  selection: StatusSelection = 'union'
): string[] => {
  const scopedTypes = entityTypes.some(
    (type) => type === 'all' || type === 'dataAsset'
  )
    ? lifecycle.entityTypes.map((type) => type.entityType)
    : entityTypes;
  const vocabularies = scopedTypes.map(
    (entityType) =>
      lifecycle.entityTypes.find((type) => type.entityType === entityType)
        ?.stages ?? []
  );
  const statuses =
    selection === 'intersection'
      ? (vocabularies[0] ?? []).filter((status) =>
          vocabularies.every((stages) => stages.includes(status))
        )
      : vocabularies.flat();

  return [...new Set(statuses)].sort();
};

export const fetchLifecycleStatuses = async (
  entityTypes: readonly string[],
  selection: StatusSelection = 'union'
) =>
  resolveLifecycleStatuses(
    await getEntityLifecycleStages(
      selection === 'intersection' && !entityTypes.includes('dataAsset')
        ? undefined
        : entityTypes
    ),
    entityTypes,
    selection
  );

export const lifecycleStatusAutocomplete =
  (
    entityTypes: readonly string[]
  ): NonNullable<SelectFieldSettings['asyncFetch']> =>
  async (search) => {
    const statuses = await fetchLifecycleStatuses(entityTypes);
    const query = (
      Array.isArray(search) ? search.join(',') : search ?? ''
    ).toLowerCase();

    return {
      values: statuses
        .filter((status) => status.toLowerCase().includes(query))
        .map((status) => ({ value: status, title: status })),
      hasMore: false,
    };
  };
