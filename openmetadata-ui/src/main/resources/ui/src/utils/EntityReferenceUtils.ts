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
import { EntityReference } from '../generated/entity/data/table';
import { DataProduct } from '../generated/entity/domains/dataProduct';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../generated/type/tagLabel';

export const convertTagLabelsToEntityReferences = (
  tags: TagLabel[]
): EntityReference[] => {
  return tags.map((tag) => ({
    id: tag.tagFQN || '',
    name: tag.name || tag.tagFQN || '',
    displayName: tag.displayName || tag.name || tag.tagFQN,
    type: tag.source === TagSource.Glossary ? 'glossaryTerm' : 'tag',
    fullyQualifiedName: tag.tagFQN,
    description: tag.description,
  }));
};

export const convertEntityReferencesToTagLabels = (
  refs: EntityReference[],
  source: TagSource = TagSource.Classification
): TagLabel[] => {
  return refs.map((ref) => ({
    tagFQN: ref.fullyQualifiedName || ref.id,
    displayName: ref.displayName || ref.name,
    name: ref.name,
    source,
    labelType: LabelType.Manual,
    state: State.Confirmed,
    description: ref.description,
  }));
};

export const convertDataProductsToEntityReferences = (
  dataProducts: DataProduct[]
): EntityReference[] => {
  return dataProducts.map((dp) => ({
    id: dp.id || '',
    name: dp.name || '',
    displayName: dp.displayName || dp.name,
    type: 'dataProduct',
    fullyQualifiedName: dp.fullyQualifiedName,
    description: dp.description,
  }));
};

export const convertEntityReferencesToDataProducts = (
  refs: EntityReference[]
): DataProduct[] => {
  return refs.map((ref) => ({
    id: ref.id,
    name: ref.name,
    displayName: ref.displayName || ref.name,
    fullyQualifiedName: ref.fullyQualifiedName || ref.id,
    description: ref.description,
    type: 'dataProduct',
  })) as DataProduct[];
};
