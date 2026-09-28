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
// `<Button block type="text">` wrapper: nowrap and select-none are what that
// button's base style handed to the card, the core Card focus outline has no
// colour of its own, and the transparent border reserves the 1px the ghost
// variant's hover border adds so hovering does not shift the feed list.
export const CARD_CONTAINER_CLASS_NAME =
  'tw:select-none tw:whitespace-nowrap tw:border tw:border-transparent tw:outline-focus-ring';
