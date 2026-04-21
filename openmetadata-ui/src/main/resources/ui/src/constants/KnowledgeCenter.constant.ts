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
import { TabSpecificField } from 'enums/entity.enum';
import { ContentChangeState } from 'interface/knowledge-center.interface';

const CENTER_PANEL_DEFAULT_WIDTH = 750;
const CENTER_PANEL_PANEL_MARGIN = 75;
const CENTER_PANEL_PADDING_VERTICAL = '12px';
const CENTER_PANEL_PADDING_HORIZONTAL = '16px';

export const KNOWLEDGE_CENTER_PAGINATION_LIMIT = 100;
export const KNOWLEDGE_CENTER_PAGINATION_OFFSET_INCREMENT = 100;
export const KNOWLEDGE_CENTER_TREE_HEIGHT_OFFSET = 190; // Height offset for the tree component
export const KNOWLEDGE_CENTER_TREE_HEIGHT_OFFSET_CHILD_ARTICLE = 260; // Height offset for the tree component in child article
export const KNOWLEDGE_CENTER_INSTANCE_NAME_LENGTH = 8;

const KNOWLEDGE_PAGE_UN_SAVED_CHANGE_STATE = [
  ContentChangeState.UN_SAVED,
  ContentChangeState.SAVING,
];

const KNOWLEDGE_PAGE_FIELDS = {
  OWNERS: TabSpecificField.OWNERS,
  REVIEWERS: TabSpecificField.REVIEWERS,
  TAGS: TabSpecificField.TAGS,
  VOTES: TabSpecificField.VOTES,
  FOLLOWERS: TabSpecificField.FOLLOWERS,
  DOMAINS: TabSpecificField.DOMAINS,
  DATA_PRODUCTS: TabSpecificField.DATA_PRODUCTS,
  RELATED_ENTITIES: 'relatedEntities',
  RELATED_ARTICLES: 'relatedArticles',
  EDITORS: 'editors',
  PARENT: 'parent',
};

const getKnowledgePageFields = (additionalFields?: string[]): string => {
  const baseFields = [
    KNOWLEDGE_PAGE_FIELDS.OWNERS,
    KNOWLEDGE_PAGE_FIELDS.VOTES,
    KNOWLEDGE_PAGE_FIELDS.FOLLOWERS,
    KNOWLEDGE_PAGE_FIELDS.TAGS,
    KNOWLEDGE_PAGE_FIELDS.DOMAINS,
    KNOWLEDGE_PAGE_FIELDS.RELATED_ENTITIES,
    KNOWLEDGE_PAGE_FIELDS.DATA_PRODUCTS,
    KNOWLEDGE_PAGE_FIELDS.REVIEWERS,
  ];

  const allFields = additionalFields
    ? [...baseFields, ...additionalFields]
    : baseFields;

  return allFields.join(',');
};

const isMac = process.platform === 'darwin';
const MOD = isMac ? 'Meta' : 'Control';

export const SHORTCUTS = {
  bold: `${MOD}+b`,
  italic: `${MOD}+i`,
  code: `${MOD}+e`,
  undo: `${MOD}+z`,
  redo: `${MOD}+Shift+z`,
  selectAll: `${MOD}+a`,
  copy: `${MOD}+c`,
  paste: `${MOD}+v`,
  selectWord: `${MOD}+Shift+ArrowLeft`,
  enter: 'Enter',
  end: 'End',
  backspace: 'Backspace',
  tab: 'Tab',
} as const;

export const SLASH_COMMANDS = {
  h1: 'H1',
  h2: 'H2',
  h3: 'H3',
  bullet: 'Bullet',
  numbered: 'Numbered',
  divider: 'Divider',
  quote: 'Quote',
  codeBlock: 'CodeBlock',
  callout: 'Callout',
  table: 'Table',
  task: 'Task',
} as const;

export {
  CENTER_PANEL_DEFAULT_WIDTH,
  CENTER_PANEL_PANEL_MARGIN,
  CENTER_PANEL_PADDING_VERTICAL,
  CENTER_PANEL_PADDING_HORIZONTAL,
  KNOWLEDGE_PAGE_UN_SAVED_CHANGE_STATE,
  KNOWLEDGE_PAGE_FIELDS,
  getKnowledgePageFields,
};
