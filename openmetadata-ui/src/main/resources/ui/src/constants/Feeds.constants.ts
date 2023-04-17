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

export const EntityRegExPattern = /<#E::([^<>]+?)::([^<>]+?)(?:::([^<>]+?))?>/;

export const EntityRegEx = new RegExp(EntityRegExPattern);

export const mentionRegEx = /\[@(.+?)?\]\((.+?)?\)/g;
export const hashtagRegEx = /\[#(.+?)?\]\((.+?)?\)/g;
export const linkRegEx = /\((.+?\/\/.+?)\/(.+?)\/(.+?)\)/;
export const teamsLinkRegEx = /\((.+?\/\/.+?)\/(.+?\/.+?\/.+?)\/(.+?)\)/;
export const entityLinkRegEx = /<#E::([^<>]+?)::([^<>]+?)>/g;
export const entityRegex = /<#E::([^<>]+?)::([^<>]+?)\|(\[(.+?)?\]\((.+?)?\))>/;

export const entityUrlMap = {
  team: 'settings/members/teams',
  user: 'users',
};

export const confirmStateInitialValue = {
  state: false,
  threadId: undefined,
  postId: undefined,
  isThread: false,
};

export const MENTION_ALLOWED_CHARS = /^[A-Za-z0-9_]*$/;
export const MENTION_DENOTATION_CHARS = ['@', '#'];

export const TOOLBAR_ITEMS = [
  ['bold', 'italic', 'strike'],
  ['blockquote', 'code-block'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  ['insertMention', 'insertRef', 'emoji'],
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
  TAGS = 'tags',
  TASKS = 'tasks',
}

export const ANNOUNCEMENT_BG = '#FFFDF8';
export const ANNOUNCEMENT_BORDER = '#FFC143';
export const TASK_BORDER = '#C6B5F6';
export const GLOBAL_BORDER = '#dde3ea';
