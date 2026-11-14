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
import { GraphFilterOption } from '../../../types/knowledgeGraph.types';

/**
 * Groups the Entity Type filter dropdown presents, mirroring Explore's
 * `getExploreTree()` sidebar so the two surfaces share one mental model.
 * KG adds an "Owners" group (User, Team) because the graph surfaces people
 * as nodes while Explore does not. Anything whose type does not match a
 * known group falls into {@link KG_ENTITY_GROUP_OTHER}.
 */
export interface KnowledgeGraphEntityGroup {
  /** Stable key for React + testids. */
  key: string;
  /** i18n label key for the section header. */
  labelKey: string;
  /** Entity type ids (lower-case EntityType values) owned by this group. */
  entityTypes: string[];
}

export const KG_ENTITY_GROUP_OTHER = 'other';

export const KNOWLEDGE_GRAPH_ENTITY_GROUPS: KnowledgeGraphEntityGroup[] = [
  {
    key: 'databases',
    labelKey: 'label.database-plural',
    entityTypes: [
      EntityType.DATABASE,
      EntityType.DATABASE_SCHEMA,
      EntityType.STORED_PROCEDURE,
      EntityType.TABLE,
      EntityType.TABLE_COLUMN,
    ],
  },
  {
    key: 'dashboards',
    labelKey: 'label.dashboard-plural',
    entityTypes: [
      EntityType.DASHBOARD_DATA_MODEL,
      EntityType.DASHBOARD,
      EntityType.CHART,
    ],
  },
  {
    key: 'pipelines',
    labelKey: 'label.pipeline-plural',
    entityTypes: [EntityType.PIPELINE],
  },
  {
    key: 'topics',
    labelKey: 'label.topic-plural',
    entityTypes: [EntityType.TOPIC],
  },
  {
    key: 'ml-models',
    labelKey: 'label.ml-model-plural',
    entityTypes: [EntityType.MLMODEL],
  },
  {
    key: 'containers',
    labelKey: 'label.container-plural',
    entityTypes: [EntityType.CONTAINER],
  },
  {
    key: 'search-indexes',
    labelKey: 'label.search-index-plural',
    entityTypes: [EntityType.SEARCH_INDEX],
  },
  {
    key: 'apis',
    labelKey: 'label.api-uppercase-plural',
    entityTypes: [EntityType.API_ENDPOINT, EntityType.API_COLLECTION],
  },
  {
    key: 'drives',
    labelKey: 'label.drive-plural',
    entityTypes: [
      EntityType.DIRECTORY,
      EntityType.FILE,
      EntityType.SPREADSHEET,
      EntityType.WORKSHEET,
    ],
  },
  {
    key: 'governance',
    labelKey: 'label.governance',
    entityTypes: [EntityType.TAG, EntityType.GLOSSARY_TERM, EntityType.METRIC],
  },
  {
    key: 'domains',
    labelKey: 'label.domain-plural',
    entityTypes: [EntityType.DATA_PRODUCT],
  },
  {
    key: 'context-center',
    labelKey: 'label.context-center',
    entityTypes: [EntityType.KNOWLEDGE_PAGE],
  },
  {
    key: 'owners',
    labelKey: 'label.owner-plural',
    entityTypes: [EntityType.USER, EntityType.TEAM],
  },
];

export interface KnowledgeGraphEntityGroupSection {
  key: string;
  labelKey: string;
  choices: GraphFilterOption[];
}

/**
 * Bucket raw filter choices into their group, preserving the group order
 * declared above. Groups with zero matches are dropped so the dropdown
 * only shows families actually present in the current graph. Choices that
 * don't match any group spill into the "Other" section at the end.
 */
export const groupEntityTypeChoices = (
  choices: GraphFilterOption[]
): KnowledgeGraphEntityGroupSection[] => {
  const typeToGroup = new Map<string, string>();
  KNOWLEDGE_GRAPH_ENTITY_GROUPS.forEach((group) =>
    group.entityTypes.forEach((type) => typeToGroup.set(type, group.key))
  );
  const bucketed = new Map<string, GraphFilterOption[]>();
  choices.forEach((choice) => {
    const groupKey = typeToGroup.get(choice.id) ?? KG_ENTITY_GROUP_OTHER;
    const bucket = bucketed.get(groupKey) ?? [];
    bucket.push(choice);
    bucketed.set(groupKey, bucket);
  });
  const sections: KnowledgeGraphEntityGroupSection[] = [];
  KNOWLEDGE_GRAPH_ENTITY_GROUPS.forEach((group) => {
    const items = bucketed.get(group.key);
    if (items && items.length > 0) {
      sections.push({
        key: group.key,
        labelKey: group.labelKey,
        choices: items,
      });
    }
  });
  const other = bucketed.get(KG_ENTITY_GROUP_OTHER);
  if (other && other.length > 0) {
    sections.push({
      key: KG_ENTITY_GROUP_OTHER,
      labelKey: 'label.kg-other',
      choices: other,
    });
  }

  return sections;
};
