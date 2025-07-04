/*
 *  Copyright 2022 Collate.
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

import { CardStyle } from '../generated/entity/feed/thread';

export const EntityRegExPattern = /<#E::([^<>]+?)::([^<>]+?)(?:::([^<>]+?))?>/;

export const EntityRegEx = new RegExp(EntityRegExPattern);

export const mentionRegEx = /\[@(.+?)?\]\((.+?)?\)/g;
export const hashtagRegEx = /\[#(.+?)?\]\((.+?)?\)/g;
export const linkRegEx = /\((.+?\/\/.+?)\/(.+?)\/(.+?)\)/;
export const teamsLinkRegEx = /\((.+?\/\/.+?)\/(.+?\/.+?\/.+?)\/(.+?)\)/;
export const entityLinkRegEx = /<#E::([^<>]+?)::([^<>]+?)>/g;
export const entityRegex = /<#E::([^<>]+?)::([^<>]+?)\|(\[(.+?)?\]\((.+?)?\))>/;

// 3 is the default page count for the post feed in list API
export const POST_FEED_PAGE_COUNT = 3;

export const ENTITY_URL_MAP = {
  team: 'settings/members/teams',
  user: 'users',
};

export type EntityUrlMapType = keyof typeof ENTITY_URL_MAP;

export const confirmStateInitialValue = {
  state: false,
  threadId: undefined,
  postId: undefined,
  isThread: false,
};

export const MENTION_ALLOWED_CHARS = /^[A-Za-z0-9_.-]*$/;
export const MENTION_DENOTATION_CHARS = ['@', '#'];

export const TOOLBAR_ITEMS = [
  ['bold', 'italic', 'strike'],
  ['blockquote', 'code-block'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  ['insertMention', 'insertRef'],
];

export enum TaskOperation {
  RESOLVE = 'resolve',
  REJECT = 'close',
}

export enum PanelTab {
  TASKS = 'tasks',
  CONVERSATIONS = 'conversations',
}

export enum EntityField {
  DESCRIPTION = 'description',
  COLUMNS = 'columns',
  SCHEMA_FIELDS = 'schemaFields',
  TAGS = 'tags',
  TASKS = 'tasks',
  ML_FEATURES = 'mlFeatures',
  SCHEMA_TEXT = 'schemaText',
  OWNER = 'owner',
  REVIEWERS = 'reviewers',
  SYNONYMS = 'synonyms',
  RELATEDTERMS = 'relatedTerms',
  REFERENCES = 'references',
  EXTENSION = 'extension',
  DISPLAYNAME = 'displayName',
  NAME = 'name',
  MESSAGE_SCHEMA = 'messageSchema',
  CHARTS = 'charts',
  DATA_MODEL = 'dataModel',
  CONSTRAINT = 'constraint',
  TABLE_CONSTRAINTS = 'tableConstraints',
  PARTITIONS = 'partitions',
  REPLICATION_FACTOR = 'replicationFactor',
  SOURCE_URL = 'sourceUrl',
  MUTUALLY_EXCLUSIVE = 'mutuallyExclusive',
  EXPERTS = 'experts',
  FIELDS = 'fields',
  PARAMETER_VALUES = 'parameterValues',
}

export const ANNOUNCEMENT_BG = '#FFFDF8';
export const ANNOUNCEMENT_BORDER = '#FFC143';
export const TASK_BORDER = '#C6B5F6';
export const GLOBAL_BORDER = '#dde3ea';

export const ASSET_CARD_STYLES = [
  CardStyle.EntityCreated,
  CardStyle.EntitySoftDeleted,
  CardStyle.EntityDeleted,
];
