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
import type {
  ChangeDescription,
  Metric,
} from '../../../generated/entity/data/metric';
import type { EntityReference } from '../../../generated/type/entityReference';
import type { TagLabel } from '../../../generated/type/tagLabel';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { isMetricTierTag } from '../../../utils/MetricEntityUtils/MetricDisplayUtils';

export const getMetricVersionField = (
  changeDescription: ChangeDescription | undefined,
  fieldName: string,
  fallback?: string
) => {
  const changedField = changeDescription?.fieldsUpdated?.find(
    ({ name }) => name === fieldName
  );

  return changedField?.newValue ?? fallback;
};

export const getMetricVersionMetadata = ({
  owners,
  domains,
  tier,
}: {
  owners?: EntityReference[];
  domains?: EntityReference[];
  tier?: TagLabel;
}) => ({
  ownerDisplayName: owners?.map(getEntityName).join(', ') ?? '',
  domainDisplayName: domains?.map(getEntityName).join(', ') ?? '',
  tierDisplayName: tier?.tagFQN.split('.').at(-1) ?? '',
});

export const getMetricVersionTags = (metric: Metric) =>
  (metric.tags ?? []).filter(({ tagFQN }) => !isMetricTierTag(tagFQN));
