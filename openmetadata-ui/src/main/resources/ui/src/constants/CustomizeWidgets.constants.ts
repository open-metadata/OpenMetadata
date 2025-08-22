/*
 *  Copyright 2024 Collate.
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
import { WidgetWidths } from '../enums/CustomizablePage.enum';
import {
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
} from '../enums/CustomizeDetailPage.enum';
import { EntityType } from '../enums/entity.enum';
import { TagSource } from '../generated/type/tagLabel';
import i18n from '../utils/i18next/LocalUtil';

export const TAB_GRID_MAX_COLUMNS = 8;

export type GridSizes = keyof typeof WidgetWidths;
export interface CommonWidgetType {
  fullyQualifiedName: string;
  name: string;
  description?: string;
  data: {
    gridSizes: Array<GridSizes>;
  };
}

export const DESCRIPTION_WIDGET: CommonWidgetType = {
  fullyQualifiedName: DetailPageWidgetKeys.DESCRIPTION,
  name: i18n.t('label.description'),
  data: {
    gridSizes: ['small', 'large'],
  },
};

export const TAGS_WIDGET: CommonWidgetType = {
  fullyQualifiedName: DetailPageWidgetKeys.TAGS,
  name: i18n.t('label.tag-plural'),
  data: { gridSizes: ['small'] },
};

export const GLOSSARY_TERMS_WIDGET: CommonWidgetType = {
  fullyQualifiedName: DetailPageWidgetKeys.GLOSSARY_TERMS,
  name: i18n.t('label.glossary-term-plural'),
  data: { gridSizes: ['small'] },
};

export const CUSTOM_PROPERTIES_WIDGET: CommonWidgetType = {
  fullyQualifiedName: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
  name: i18n.t('label.custom-property-plural'),
  data: { gridSizes: ['small'] },
};

export const DOMAIN_WIDGET: CommonWidgetType = {
  fullyQualifiedName: GlossaryTermDetailPageWidgetKeys.DOMAIN,
  name: i18n.t('label.domain-plural'),
  data: { gridSizes: ['small'] },
};

export const OWNER_WIDGET: CommonWidgetType = {
  fullyQualifiedName: GlossaryTermDetailPageWidgetKeys.OWNER,
  name: i18n.t('label.owner-plural'),
  data: { gridSizes: ['small'] },
};

export const TERMS_TABLE_WIDGET: CommonWidgetType = {
  fullyQualifiedName: GlossaryTermDetailPageWidgetKeys.TERMS_TABLE,
  name: i18n.t('label.term-plural'),
  data: { gridSizes: ['large'] },
};

export const REFERENCES_WIDGET: CommonWidgetType = {
  fullyQualifiedName: GlossaryTermDetailPageWidgetKeys.REFERENCES,
  name: i18n.t('label.reference-plural'),
  data: { gridSizes: ['small'] },
};

export const REVIEWER_WIDGET: CommonWidgetType = {
  fullyQualifiedName: GlossaryTermDetailPageWidgetKeys.REVIEWER,
  name: i18n.t('label.reviewer-plural'),
  data: { gridSizes: ['small'] },
};

export const WORKFLOW_HISTORY_WIDGET: CommonWidgetType = {
  fullyQualifiedName: GlossaryTermDetailPageWidgetKeys.WORKFLOW_HISTORY,
  name: i18n.t('label.workflow-history'),
  data: { gridSizes: ['small'] },
};

export const SYNONYMS_WIDGET: CommonWidgetType = {
  fullyQualifiedName: GlossaryTermDetailPageWidgetKeys.SYNONYMS,
  name: i18n.t('label.synonym-plural'),
  data: {
    gridSizes: ['small'],
  },
};

export const RELATED_TERMS_WIDGET: CommonWidgetType = {
  fullyQualifiedName: GlossaryTermDetailPageWidgetKeys.RELATED_TERMS,
  name: i18n.t('label.related-term-plural'),
  data: { gridSizes: ['small'] },
};

export const DATA_PRODUCTS_WIDGET: CommonWidgetType = {
  fullyQualifiedName: DetailPageWidgetKeys.DATA_PRODUCTS,
  name: i18n.t('label.data-product-plural'),
  data: { gridSizes: ['small'] },
};

export const DUMMY_TAGS_LIST = [
  {
    tagFQN: 'BusinessGlossary.Purchase',
    source: TagSource.Glossary,
    name: 'Purchase',
  },
  {
    tagFQN: 'Person.BankNumber',
    source: TagSource.Glossary,
    name: 'BankNumber',
  },
  {
    tagFQN: 'Hospitality.Guest Type',
    source: TagSource.Glossary,
    name: 'Guest Type',
  },
  {
    tagFQN: 'Financial Services',
    source: TagSource.Glossary,
    name: 'Auto Loan',
  },
];

export const DUMMY_OWNER_LIST = [
  {
    name: 'Aaron Singh',
    type: EntityType.USER,
    id: '123',
  },
  {
    name: 'Engineering',
    type: EntityType.TEAM,
    id: '123',
  },
];

export const WIDGET_CUSTOM_PROPERTIES = [
  {
    name: 'name',
    value: 'OpenMetadata',
    propertyType: {
      name: 'string',
      type: 'string',
      id: '123',
    },
    description: 'Name',
    displayName: 'Name',
  },
  {
    name: 'email',
    value: 'customproperty@OpenMetadata.com',
    propertyType: {
      name: 'string',
      type: 'string',
      id: '123',
    },
    description: 'Email',
    displayName: 'Email',
  },
];
