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
import classNames from 'classnames';
import {
  DEFAULT_HEADER_LAYOUT,
  HEADER_ITEM_CLASS_NAME,
  LIST_HEADER_ITEM_CLASS_NAME,
  OPEN_THREAD_FOOTER_VISIBILITY,
  PANEL_HEADER_LAYOUT,
} from './ActivityFeedcardNew.constants';

// Shared across both card variants: the top-level Card wrapper always mixes
// the same "showThread || isPost || isOpenInDrawer" right-panel state with
// the reply/active-card modifiers, only the base class differs.
export const getFeedCardClassName = (
  basePrefix: string,
  {
    showThread,
    isPost,
    isOpenInDrawer,
    isActive,
  }: {
    showThread?: boolean;
    isPost: boolean;
    isOpenInDrawer: boolean;
    isActive?: boolean;
  }
) =>
  classNames(
    basePrefix,
    {
      'activity-feed-card-new-right-panel m-0 gap-0':
        showThread || isPost || isOpenInDrawer,
    },
    { 'activity-feed-reply-card': isPost },
    { 'active-card is-active': isActive }
  );

// The whole feed/task card is clickable but also contains its own links and
// buttons, so it cannot be a <button> (interactive content may not nest). The
// container takes role="button" instead, and only reacts to keys pressed on
// itself so Enter/Space inside a nested control or editor keep their meaning.
export const handleCardContainerKeyDown =
  (onActivate: () => void) =>
  (event: {
    key: string;
    target: EventTarget;
    currentTarget: EventTarget;
    preventDefault: () => void;
  }) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate();
    }
  };

// Extras for the clickable core `Card` that replaced the antd
// `<Button block type="text">` wrapper: select-none comes from that button's
// base style. Its nowrap is left out on purpose: it stopped feed text wrapping,
// so cards overflowed their panel and the panel scrolled sideways. The core
// Card focus outline has no colour of its own, and the transparent border
// reserves the 1px the ghost variant's hover border adds so hovering does not
// shift the feed list.
// overflow-visible undoes Card's default clipping so the reply editor's
// absolutely positioned @mention list is not cut off at the card edge.
export const CARD_CONTAINER_CLASS_NAME =
  'tw:select-none tw:border tw:border-transparent tw:outline-focus-ring tw:overflow-visible';

// The thread panel's menu sits in the card's top corner.
export const getActionsClassName = (isThreadPanel?: boolean) =>
  isThreadPanel ? 'tw:absolute tw:end-2.5 tw:top-4.5' : undefined;

export const getHeaderTagsClassName = (
  showThread: boolean | undefined,
  isThreadPanel?: boolean
): string => {
  // In the thread panels the header's pieces share one line height: the
  // inherited taller line box left "conversation" a little below the entity
  // link beside it.
  if (isThreadPanel) {
    // Wraps only when even a short entity name and the field trail can't
    // share the line (a long column on a narrow drawer).
    return classNames(
      'd-flex items-center tw:min-w-0 tw:flex-wrap tw:leading-5',
      {
        'header-container-card': !showThread,
      }
    );
  }

  return classNames('d-flex', {
    'header-container-card': !showThread,
    // Both wrap: when the verb leaves the entity less than its minimum, the
    // entity moves to the next line instead of running past the card edge.
    // List cards align to the first line; the thread panel always puts the
    // entity under the verb (as in 1.13).
    'flex-wrap': true,
    'items-start': !showThread,
    'items-center': showThread,
  });
};

// Flex wrappers in the thread panels, so no line box adds descender space
// under the entity link and the header's pieces centre on one line.
export const getHeaderTagsItemClassName = (
  isPanelLayout: boolean,
  isThreadPanel?: boolean
): string => {
  if (isThreadPanel) {
    return `${HEADER_ITEM_CLASS_NAME} tw:flex tw:items-center`;
  }

  return isPanelLayout ? HEADER_ITEM_CLASS_NAME : LIST_HEADER_ITEM_CLASS_NAME;
};

export const getFooterVisibility = (
  isThreadPanel?: boolean,
  isPanelLayout?: boolean
) =>
  isThreadPanel && isPanelLayout ? OPEN_THREAD_FOOTER_VISIBILITY : undefined;

export const getHeaderLayout = (isThreadPanel?: boolean) =>
  isThreadPanel ? PANEL_HEADER_LAYOUT : DEFAULT_HEADER_LAYOUT;

// The card's body is painted edge to edge in the surface colour; in the thread
// panels its corners round with the card's, or they cover its border.
export const getFullCardBodyClassName = (isThreadPanel?: boolean): string =>
  classNames('activity-feed-card-new-body tw:p-0', {
    'tw:rounded-xl': isThreadPanel,
  });

// In the thread panels the card sits in a rounded frame; square corners would
// paint over the frame's.
export const getFullCardBaseClassName = (isThreadPanel?: boolean): string =>
  classNames(
    'relative activity-feed-card-new activity-feed-card-new-surface tw:overflow-visible tw:border-primary tw:text-primary',
    isThreadPanel ? 'tw:rounded-xl' : 'tw:rounded-none'
  );
