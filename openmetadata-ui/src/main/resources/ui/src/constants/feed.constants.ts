/*
 *  Copyright 2021 Collate
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

export const EntityRegExPattern = /<#E\/([^<>]+?)\/([^<>]+?)\/([^<>]+?)>/;

export const EntityRegEx = new RegExp(EntityRegExPattern);

export const mentionRegEx = /\[@(.+?)?\]\((.+?)?\)/g;
export const hashtagRegEx = /\[#(.+?)?\]\((.+?)?\)/g;
export const linkRegEx = /\((.+?\/\/.+?)\/(.+?)\/(.+?)\)/;
export const entityLinkRegEx = /<#E\/([^<>]+?)\/([^<>]+?)>/g;
export const entityRegex = /<#E\/([^<>]+?)\/([^<>]+?)\|(\[(.+?)?\]\((.+?)?\))>/;

export const entityUrlMap = {
  team: 'teams',
  user: 'users',
};

export const EditorPlaceHolder = `Use @mention to tag a user or a team.
Use #mention to tag a data asset.`;

export const confirmStateInitialValue = {
  state: false,
  threadId: undefined,
  postId: undefined,
};

export const confirmationBodyText =
  'Are you sure you want to permanently delete this message?';

export const confirmHeadertext = 'Delete message?';

export const onConfirmText = 'Message deleted successfully';

export const onErrorText = 'Error while deleting message';

export const onUpdatedConversastionError =
  'Error while getting updated conversation';

export const MENTION_ALLOWED_CHARS = /^[A-Za-z0-9_]*$/;
export const MENTION_DENOTATION_CHARS = ['@', '#'];

export const TOOLBAR_ITEMS = [
  ['bold', 'italic', 'strike'],
  ['blockquote', 'code-block'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  ['insertMention', 'insertRef'],
];
