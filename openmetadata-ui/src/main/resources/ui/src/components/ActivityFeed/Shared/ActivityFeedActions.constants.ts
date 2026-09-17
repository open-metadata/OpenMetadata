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

/**
 * Reveal styling for a card that wants its feed actions hidden until the
 * pointer is over it. Deliberately opacity and not a conditional mount: the
 * buttons stay in the tab order and in the accessibility tree either way, and
 * `focus-within` brings them back into view for keyboard users.
 *
 * Two variants rather than one because a conversation card contains its reply
 * cards - an unnamed `tw:group` would make hovering the conversation reveal
 * every reply's actions at once. Each is paired with the matching
 * `tw:group/<name>` on the card that owns it, and both are spelled out in full
 * because Tailwind only sees class names it can read statically.
 *
 * Kept out of the component module so a test that mocks ActivityFeedActions
 * does not also have to restate these.
 */
export const FEED_ACTIONS_HOVER_REVEAL = [
  'tw:opacity-0 tw:pointer-events-none',
  'tw:motion-safe:transition-opacity',
  'tw:group-hover/feed-card:opacity-100',
  'tw:group-hover/feed-card:pointer-events-auto',
  'tw:focus-within:opacity-100 tw:focus-within:pointer-events-auto',
].join(' ');

/** As above, scoped to a single reply card. */
export const COMMENT_ACTIONS_HOVER_REVEAL = [
  'tw:opacity-0 tw:pointer-events-none',
  'tw:motion-safe:transition-opacity',
  'tw:group-hover/comment:opacity-100',
  'tw:group-hover/comment:pointer-events-auto',
  'tw:focus-within:opacity-100 tw:focus-within:pointer-events-auto',
].join(' ');
