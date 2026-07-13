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
import { EntityType } from '../enums/entity.enum';
import {
  ContextSection,
  PersonaContextDefinition,
} from '../generated/type/personaContextDefinition';

export const PERSONA_CONTEXT_ASSET_SECTIONS = [
  ContextSection.Description,
  ContextSection.Schema,
  ContextSection.Constraints,
  ContextSection.Joins,
  ContextSection.Tags,
  ContextSection.GlossaryTerms,
  ContextSection.Articles,
  ContextSection.Metrics,
  ContextSection.Lineage,
  ContextSection.Profile,
  ContextSection.DataQuality,
];

export const DEFAULT_PERSONA_CONTEXT_SECTIONS = [
  ContextSection.Description,
  ContextSection.Schema,
  ContextSection.Constraints,
  ContextSection.Joins,
  ContextSection.Tags,
  ContextSection.GlossaryTerms,
  ContextSection.Articles,
  ContextSection.Metrics,
];

export const PERSONA_CONTEXT_ARTICLE_SECTIONS = [
  ContextSection.TitleSummary,
  ContextSection.FullBody,
  ContextSection.Tags,
  ContextSection.GlossaryTerms,
  ContextSection.RelatedAssets,
];

export const PERSONA_CONTEXT_METRIC_SECTIONS = [
  ContextSection.Definition,
  ContextSection.FormulaExpression,
  ContextSection.UnitGrain,
  ContextSection.Owner,
  ContextSection.Tags,
  ContextSection.RelatedAssets,
];

export const PERSONA_CONTEXT_GLOSSARY_TERM_SECTIONS = [
  ContextSection.Definition,
  ContextSection.Synonyms,
  ContextSection.RelatedTerms,
  ContextSection.Tags,
  ContextSection.RelatedAssets,
];

export const HEAVY_PERSONA_CONTEXT_SECTIONS = new Set([
  ContextSection.Lineage,
  ContextSection.Profile,
  ContextSection.DataQuality,
]);

export const DEFAULT_PERSONA_CONTEXT_DEFINITION: PersonaContextDefinition = {
  cacheTtlMinutes: 30,
  characterBudget: 400000,
  enabled: true,
  rules: [],
};

export const DEFAULT_PERSONA_CONTEXT_MAX_ASSETS = 200;

export const PERSONA_CONTEXT_ASSET_TYPES = [
  EntityType.TABLE,
  EntityType.TOPIC,
  EntityType.DASHBOARD,
  EntityType.CHART,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.PIPELINE,
  EntityType.MLMODEL,
  EntityType.CONTAINER,
  EntityType.DATABASE,
  EntityType.DATABASE_SCHEMA,
  EntityType.STORED_PROCEDURE,
  EntityType.SEARCH_INDEX,
  EntityType.API_COLLECTION,
  EntityType.API_ENDPOINT,
  EntityType.DATA_PRODUCT,
];

export const PERSONA_CONTEXT_KNOWLEDGE_TYPES = [
  EntityType.GLOSSARY_TERM,
  EntityType.KNOWLEDGE_PAGE,
  EntityType.METRIC,
];

export const PERSONA_CONTEXT_ENTITY_LABEL_KEYS: Record<string, string> = {
  [EntityType.API_COLLECTION]: 'label.api-collection',
  [EntityType.API_ENDPOINT]: 'label.api-endpoint',
  [EntityType.CHART]: 'label.chart',
  [EntityType.CONTAINER]: 'label.container',
  [EntityType.DASHBOARD]: 'label.dashboard',
  [EntityType.DASHBOARD_DATA_MODEL]: 'label.data-model',
  [EntityType.DATABASE]: 'label.database',
  [EntityType.DATABASE_SCHEMA]: 'label.database-schema',
  [EntityType.DATA_PRODUCT]: 'label.data-product',
  [EntityType.GLOSSARY_TERM]: 'label.glossary-term',
  [EntityType.KNOWLEDGE_PAGE]: 'label.article',
  [EntityType.METRIC]: 'label.metric',
  [EntityType.MLMODEL]: 'label.ml-model',
  [EntityType.PIPELINE]: 'label.pipeline',
  [EntityType.SEARCH_INDEX]: 'label.search-index',
  [EntityType.STORED_PROCEDURE]: 'label.stored-procedure',
  [EntityType.TABLE]: 'label.table',
  [EntityType.TOPIC]: 'label.topic',
};

export const PERSONA_CONTEXT_SECTION_LABEL_KEYS: Record<
  ContextSection,
  string
> = {
  [ContextSection.Articles]: 'label.related-article-plural',
  [ContextSection.Constraints]: 'label.keys-and-constraints',
  [ContextSection.DataQuality]: 'label.data-quality',
  [ContextSection.Definition]: 'label.definition',
  [ContextSection.Description]: 'label.description',
  [ContextSection.FormulaExpression]: 'label.formula-expression',
  [ContextSection.FullBody]: 'label.full-body',
  [ContextSection.GlossaryTerms]: 'label.related-glossary-term-plural',
  [ContextSection.Joins]: 'label.join',
  [ContextSection.Lineage]: 'label.lineage',
  [ContextSection.Metrics]: 'label.related-metric-context',
  [ContextSection.Owner]: 'label.owner',
  [ContextSection.Profile]: 'label.profile',
  [ContextSection.RelatedAssets]: 'label.related-asset-plural',
  [ContextSection.RelatedTerms]: 'label.related-term-context',
  [ContextSection.Schema]: 'label.schema',
  [ContextSection.Synonyms]: 'label.synonym-plural',
  [ContextSection.Tags]: 'label.tag-plural',
  [ContextSection.TitleSummary]: 'label.title-and-summary',
  [ContextSection.UnitGrain]: 'label.unit-and-grain',
};

export const PERSONA_CONTEXT_SECTIONS_BY_ENTITY_TYPE: Record<
  string,
  ContextSection[]
> = {
  [EntityType.API_COLLECTION]: PERSONA_CONTEXT_ASSET_SECTIONS,
  [EntityType.API_ENDPOINT]: PERSONA_CONTEXT_ASSET_SECTIONS,
  [EntityType.CHART]: PERSONA_CONTEXT_ASSET_SECTIONS,
  [EntityType.CONTAINER]: PERSONA_CONTEXT_ASSET_SECTIONS,
  [EntityType.DASHBOARD]: PERSONA_CONTEXT_ASSET_SECTIONS,
  [EntityType.DASHBOARD_DATA_MODEL]: PERSONA_CONTEXT_ASSET_SECTIONS,
  [EntityType.DATABASE]: PERSONA_CONTEXT_ASSET_SECTIONS,
  [EntityType.DATABASE_SCHEMA]: PERSONA_CONTEXT_ASSET_SECTIONS,
  [EntityType.DATA_PRODUCT]: PERSONA_CONTEXT_ASSET_SECTIONS,
  [EntityType.GLOSSARY_TERM]: PERSONA_CONTEXT_GLOSSARY_TERM_SECTIONS,
  [EntityType.KNOWLEDGE_PAGE]: PERSONA_CONTEXT_ARTICLE_SECTIONS,
  [EntityType.METRIC]: PERSONA_CONTEXT_METRIC_SECTIONS,
  [EntityType.MLMODEL]: PERSONA_CONTEXT_ASSET_SECTIONS,
  [EntityType.PIPELINE]: PERSONA_CONTEXT_ASSET_SECTIONS,
  [EntityType.SEARCH_INDEX]: PERSONA_CONTEXT_ASSET_SECTIONS,
  [EntityType.STORED_PROCEDURE]: PERSONA_CONTEXT_ASSET_SECTIONS,
  [EntityType.TABLE]: PERSONA_CONTEXT_ASSET_SECTIONS,
  [EntityType.TOPIC]: PERSONA_CONTEXT_ASSET_SECTIONS,
};

export const PERSONA_CONTEXT_DEFAULT_SECTIONS_BY_ENTITY_TYPE: Record<
  string,
  ContextSection[]
> = {
  [EntityType.API_COLLECTION]: DEFAULT_PERSONA_CONTEXT_SECTIONS,
  [EntityType.API_ENDPOINT]: DEFAULT_PERSONA_CONTEXT_SECTIONS,
  [EntityType.CHART]: DEFAULT_PERSONA_CONTEXT_SECTIONS,
  [EntityType.CONTAINER]: DEFAULT_PERSONA_CONTEXT_SECTIONS,
  [EntityType.DASHBOARD]: DEFAULT_PERSONA_CONTEXT_SECTIONS,
  [EntityType.DASHBOARD_DATA_MODEL]: DEFAULT_PERSONA_CONTEXT_SECTIONS,
  [EntityType.DATABASE]: DEFAULT_PERSONA_CONTEXT_SECTIONS,
  [EntityType.DATABASE_SCHEMA]: DEFAULT_PERSONA_CONTEXT_SECTIONS,
  [EntityType.DATA_PRODUCT]: DEFAULT_PERSONA_CONTEXT_SECTIONS,
  [EntityType.GLOSSARY_TERM]: [ContextSection.Definition],
  [EntityType.KNOWLEDGE_PAGE]: [
    ContextSection.TitleSummary,
    ContextSection.FullBody,
    ContextSection.Tags,
  ],
  [EntityType.METRIC]: [
    ContextSection.Definition,
    ContextSection.FormulaExpression,
    ContextSection.UnitGrain,
  ],
  [EntityType.MLMODEL]: DEFAULT_PERSONA_CONTEXT_SECTIONS,
  [EntityType.PIPELINE]: DEFAULT_PERSONA_CONTEXT_SECTIONS,
  [EntityType.SEARCH_INDEX]: DEFAULT_PERSONA_CONTEXT_SECTIONS,
  [EntityType.STORED_PROCEDURE]: DEFAULT_PERSONA_CONTEXT_SECTIONS,
  [EntityType.TABLE]: DEFAULT_PERSONA_CONTEXT_SECTIONS,
  [EntityType.TOPIC]: DEFAULT_PERSONA_CONTEXT_SECTIONS,
};
