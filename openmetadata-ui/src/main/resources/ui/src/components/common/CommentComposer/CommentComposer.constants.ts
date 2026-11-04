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

import classNames from 'classnames';

// The design's restyle of the OSS ActivityFeedEditorNew, scoped to this
// editor: one input line with the formatting toggle and send button inside it,
// under a format bar of the design's icons. Quill builds this markup itself, so
// these reach it from the editor's root (Tailwind reads `_` in those selectors
// as a space, so no class here has one). `!`: Quill's snow theme and the
// FeedEditor's own styles are unlayered CSS, which beats Tailwind's utilities
// whatever their selector.
export const ICON_CLASS = 'comment-composer-icon';

// The design's gray-blue border; in dark that scale turns navy, so it stays
// neutral. It also holds over FeedEditor's inline focus border, which all but
// vanishes in dark — and an edit box opens focused.
const EDITOR_BOX_CLASS = [
  'tw:[&_.editor-container]:border! tw:[&_.editor-container]:border-solid!',
  'tw:[&_.editor-container]:border-utility-gray-blue-100! tw:dark:[&_.editor-container]:border-primary!',
  'tw:[&_.editor-container]:rounded-[10px]! tw:[&_.editor-container]:bg-primary!',
  // Quill sets 13px Helvetica; comments read in the page's font at 14px (font
  // size only: the token's line height would squash Quill's 44px mention rows).
  'tw:[&_.ql-container.ql-snow]:border-none! tw:[&_.ql-container.ql-snow]:bg-transparent!',
  'tw:[&_.ql-container.ql-snow]:font-[inherit]! tw:[&_.ql-container.ql-snow]:text-(length:--tw-text-sm)!',
];

// The format bar sits in the same box as the text, split by a hairline. It
// anchors the emoji picker, which the composer places by its button. The
// design's icons, drawn into Quill's buttons, replace Quill's and
// quill-emoji's icons and the @ / # glyphs, at 16px in Quill's own button box.
const FORMAT_BAR_CLASS = [
  'tw:[&_.ql-toolbar.ql-snow]:relative! tw:[&_.ql-toolbar.ql-snow]:px-2! tw:[&_.ql-toolbar.ql-snow]:py-1!',
  'tw:[&_.ql-toolbar.ql-snow]:border-0! tw:[&_.ql-toolbar.ql-snow]:border-b!',
  'tw:[&_.ql-toolbar.ql-snow]:border-solid! tw:[&_.ql-toolbar.ql-snow]:border-b-secondary!',
  'tw:[&_.ql-toolbar_.ql-formats_button]:text-quaternary!',
  'tw:[&_.ql-toolbar_.ql-formats_button>svg:not(.comment-composer-icon)]:hidden!',
  'tw:[&_.ql-toolbar_.ql-formats_button]:after:content-none!',
  // The editor zeroes the @ / # buttons' padding for their glyphs.
  'tw:[&_.ql-toolbar_button.ql-insertMention]:px-1.25! tw:[&_.ql-toolbar_button.ql-insertMention]:py-0.75!',
  'tw:[&_.ql-toolbar_button.ql-insertRef]:px-1.25! tw:[&_.ql-toolbar_button.ql-insertRef]:py-0.75!',
  'tw:[&_.ql-toolbar_.ql-formats_button:hover]:text-fg-brand-primary!',
  'tw:[&_.ql-toolbar_.ql-formats_button:focus-visible]:text-fg-brand-primary!',
  'tw:[&_.ql-toolbar_.ql-formats_button.ql-active]:text-fg-brand-primary!',
  'tw:[&_.ql-toolbar_.comment-composer-icon]:block!',
  'tw:[&_.ql-toolbar_.comment-composer-icon]:float-none!',
  'tw:[&_.ql-toolbar_.comment-composer-icon]:size-4!',
  'tw:[&_.ql-toolbar_.comment-composer-icon]:mx-auto!',
  'tw:[&_.ql-toolbar_.comment-composer-icon]:my-px!',
];

// One line of text, clear of the toggle and send button on the right.
// `.editor-container` outranks the FeedEditor's own 100px minimum.
const TEXT_CLASS = [
  'tw:[&_.ql-editor]:min-h-11! tw:[&_.ql-editor]:pt-3! tw:[&_.ql-editor]:pb-3!',
  'tw:[&_.ql-editor]:pl-3.5! tw:[&_.ql-editor]:pr-25!',
  'tw:[&_.ql-editor]:bg-transparent! tw:[&_.ql-editor]:rounded-[10px]!',
  // A list starts at the text's edge: its items' padding holds the marker.
  'tw:[&_.ql-editor_ol]:pl-0!',
  // FeedEditor hard-codes the "Use @mention…" placeholder: the design's copy
  // comes from the component as a CSS variable, so it stays translated.
  // Quill's own placeholder color is invisible on a dark surface.
  'tw:[&_.ql-editor.ql-blank]:before:content-(--comment-composer-placeholder)!',
  'tw:[&_.ql-editor.ql-blank]:before:not-italic! tw:[&_.ql-editor.ql-blank]:before:left-3.5!',
  'tw:dark:[&_.ql-editor.ql-blank]:before:text-placeholder!',
];

// The @ / # suggestion list, in the core Dropdown's style: a padded overlay
// with inset rounded rows.
const MENTION_LIST_CLASS = [
  'tw:[&_.ql-mention-list-container]:w-62! tw:[&_.ql-mention-list-container]:py-1!',
  'tw:[&_.ql-mention-list-container]:border-none!',
  'tw:[&_.ql-mention-list-container]:rounded-lg! tw:[&_.ql-mention-list-container]:outline-1!',
  'tw:[&_.ql-mention-list-container]:outline-solid!',
  'tw:[&_.ql-mention-list-container]:-outline-offset-1!',
  'tw:[&_.ql-mention-list-container]:outline-subtle!',
  'tw:[&_.ql-mention-list-container]:bg-overlay-surface!',
  // The theme's `shadow-lg` is empty here; the token carries the values.
  'tw:[&_.ql-mention-list-container]:[box-shadow:var(--om-shadow-lg)]!',
  'tw:[&_.ql-mention-list-item]:mx-1.5! tw:[&_.ql-mention-list-item]:my-px!',
  'tw:[&_.ql-mention-list-item]:px-2.5! tw:[&_.ql-mention-list-item]:py-2!',
  'tw:[&_.ql-mention-list-item]:rounded-md! tw:[&_.ql-mention-list-item]:text-(length:--tw-text-sm)!',
  'tw:[&_.ql-mention-list-item]:text-secondary!',
  'tw:[&_.ql-mention-list-item.selected]:bg-primary_hover!',
  'tw:[&_.ql-mention-list-item.disabled]:cursor-default! tw:[&_.ql-mention-list-item.disabled]:text-tertiary!',
];

// The link bubble is a fixed 300px with nowrap content, so its chips overflow
// here: a flex row bounded by the editor's width instead. `:not(.ql-hidden)`
// keeps Quill's hide rule winning. Quill's editing mode zeroes the Save chip's
// right padding, leaving its label flush with the chip's edge. Its ::before and
// ::after are reached in the selector, not with `before:`/`after:`, which would
// also reset their `content` ("Enter Url:", "Save").
const LINK_TOOLTIP_CLASS = [
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)]:flex!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)]:items-center!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)]:gap-2!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)]:w-[min(420px,calc(100%-16px))]!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)::before]:shrink-0!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_input[type=text]]:flex-auto!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_input[type=text]]:min-w-0!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_input[type=text]]:w-auto!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_a.ql-preview]:flex-auto!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_a.ql-preview]:min-w-0!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_a.ql-preview]:w-auto!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_a.ql-action]:shrink-0!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden)_a.ql-remove]:shrink-0!',
  'tw:[&_.ql-snow_.ql-tooltip:not(.ql-hidden).ql-editing_a.ql-action::after]:pr-2!',
];

export const EDITOR_CLASS = classNames(
  EDITOR_BOX_CLASS,
  FORMAT_BAR_CLASS,
  TEXT_CLASS,
  MENTION_LIST_CLASS,
  LINK_TOOLTIP_CLASS
);

export const COLLAPSED_CLASS = 'tw:[&_.ql-toolbar.ql-snow]:hidden!';
