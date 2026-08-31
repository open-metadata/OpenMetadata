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
import { EntityType } from '../../../enums/entity.enum';
import {
  Direction,
  MetricAssetDirection,
} from '../../../generated/api/data/metricObservability';
import { EntityReference } from '../../../generated/entity/type';
import { BulkOperationResult } from '../../../generated/type/bulkOperationResult';
import Fqn from '../../../utils/Fqn';
import { MetricAssetDetails } from './MetricAssetsTab.types';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (
  record: Record<string, unknown>,
  key: string
): string | undefined =>
  typeof record[key] === 'string' ? record[key] : undefined;

const readNumber = (
  record: Record<string, unknown>,
  key: string
): number | undefined =>
  typeof record[key] === 'number' ? record[key] : undefined;

export const toEntityReference = (
  value: unknown
): EntityReference | undefined => {
  if (!isRecord(value)) {
    return;
  }

  const id = readString(value, 'id');
  const type = readString(value, 'type') ?? readString(value, 'entityType');
  if (!id || !type) {
    return;
  }

  return {
    id,
    type,
    deleted: value.deleted === true,
    description: readString(value, 'description'),
    displayName: readString(value, 'displayName'),
    fullyQualifiedName: readString(value, 'fullyQualifiedName'),
    href: readString(value, 'href'),
    name: readString(value, 'name'),
  };
};

const readReferences = (value: unknown): EntityReference[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        const reference = toEntityReference(item);

        return reference ? [reference] : [];
      })
    : [];

const readColumns = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((column) => {
        if (!isRecord(column)) {
          return [];
        }
        const name =
          readString(column, 'displayName') ?? readString(column, 'name');

        return name ? [name] : [];
      })
    : [];

const readTagGroups = (value: unknown) => {
  const groups = {
    glossaryTerms: [] as string[],
    tags: [] as string[],
    tier: undefined as string | undefined,
  };
  if (!Array.isArray(value)) {
    return groups;
  }

  value.forEach((tag) => {
    if (!isRecord(tag)) {
      return;
    }
    const fqn = readString(tag, 'tagFQN');
    if (!fqn) {
      return;
    }
    if (fqn.startsWith('Tier.')) {
      groups.tier = fqn;

      return;
    }
    if (readString(tag, 'source') === 'Glossary') {
      groups.glossaryTerms.push(fqn);
    } else {
      groups.tags.push(fqn);
    }
  });

  return groups;
};

const readUsage = (value: unknown) => {
  if (!isRecord(value)) {
    return {};
  }
  const weeklyStats = value.weeklyStats;
  if (!isRecord(weeklyStats)) {
    return {};
  }

  return {
    usageCount: readNumber(weeklyStats, 'count'),
    usagePercentile: readNumber(weeklyStats, 'percentileRank'),
  };
};

export const normalizeMetricAssetDetails = (
  asset: EntityReference,
  value?: unknown
): MetricAssetDetails => {
  const record = isRecord(value) ? value : {};
  const detailsReference = toEntityReference(record);
  const tags = readTagGroups(record.tags);
  const fqn =
    detailsReference?.fullyQualifiedName ?? asset.fullyQualifiedName ?? '';

  return {
    asset: { ...asset, ...detailsReference },
    columns: readColumns(record.columns),
    containment: fqn ? Fqn.split(fqn).slice(0, -1) : [],
    description:
      readString(record, 'description') ?? asset.description ?? undefined,
    domains: readReferences(record.domains),
    glossaryTerms: tags.glossaryTerms,
    owners: readReferences(record.owners),
    tags: tags.tags,
    tier: tags.tier,
    ...readUsage(record.usageSummary),
  };
};

export const getBulkFailureIds = (result: BulkOperationResult): Set<string> => {
  const failedIds = new Set<string>();
  result.failedRequest?.forEach((failure) => {
    const request: unknown = failure.request;
    if (!isRecord(request)) {
      return;
    }
    const requestId = readString(request, 'id');
    if (requestId) {
      failedIds.add(requestId);
    }
  });

  return failedIds;
};

export const getBulkFailureCount = (result: BulkOperationResult): number =>
  result.numberOfRowsFailed ?? result.failedRequest?.length ?? 0;

export const doesMetricAssetAffectHealth = (
  relation: MetricAssetDirection
): boolean =>
  relation.affectsHealth ??
  (relation.direction === Direction.Upstream &&
    relation.asset.type === EntityType.TABLE);
