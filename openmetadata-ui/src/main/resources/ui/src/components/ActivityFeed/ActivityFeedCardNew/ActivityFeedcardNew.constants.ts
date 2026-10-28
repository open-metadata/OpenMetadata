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

// Each child of the antd Space this markup replaced sat in its own block
// wrapper, which sets the line box the header text and avatars align in;
// keep that wrapper, and hide it when empty as antd's did. min-w-0 lets the
// entity link truncate (otherwise a long name pushed the field path past the
// card edge); first:shrink-0 keeps the verb whole.
export const SPACE_ITEM_CLASS_NAME =
  'tw:empty:hidden tw:min-w-0 tw:first:shrink-0';
// The verb/entity row: the verb may wrap too, for cards narrower than it. In
// list cards the entity item (last) takes the rest of the verb's line (basis
// 0) and wraps under the verb only below min-w-24 (icon plus a few characters).
export const HEADER_ITEM_CLASS_NAME = 'tw:empty:hidden tw:min-w-0';
export const LIST_HEADER_ITEM_CLASS_NAME = `${HEADER_ITEM_CLASS_NAME} tw:last:min-w-24 tw:last:flex-1 tw:last:basis-0`;

// In the thread panels a long entity name must not push the header past the
// card or under its menu: the row is held to the card's width, the name gives
// way (ellipsis) and the field after it stays whole.
export const PANEL_HEADER_LAYOUT = {
  row: 'tw:w-full tw:pe-8',
  rowItem: `${SPACE_ITEM_CLASS_NAME} tw:last:min-w-0 tw:last:flex-1`,
  // Fills what the line has left, up to its own width, and never narrower than
  // a few characters, so it can't vanish.
  entity: 'tw:min-w-16 tw:max-w-max tw:grow tw:basis-0',
  // Never narrower than its separators, a capped column name and the field
  // label, so only the entity name gives way.
  field: 'tw:min-w-min',
  fieldPath: 'tw:min-w-min',
  // The author's name gives way to the time, which never wraps.
  // Not SPACE_ITEM_CLASS_NAME: its first:shrink-0 would hold the name whole.
  authorRowItem: 'tw:empty:hidden tw:min-w-0 tw:last:shrink-0',
  authorName: 'tw:block tw:min-w-0',
  authorLink: 'tw:block tw:truncate',
  timestamp: 'tw:whitespace-nowrap',
};

export const DEFAULT_HEADER_LAYOUT = {
  row: undefined,
  rowItem: SPACE_ITEM_CLASS_NAME,
  authorRowItem: SPACE_ITEM_CLASS_NAME,
  authorName: undefined,
  authorLink: undefined,
  timestamp: undefined,
};

// An open conversation in a thread panel already lists its replies, so its
// reply count would only reopen the same conversation.
export const OPEN_THREAD_FOOTER_VISIBILITY = { showThreadIcon: false };
