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

// Replaces the antd `<Button block type="text">` wrapper; nowrap and
// select-none are what that button's base style handed to the card.
export const CARD_CONTAINER_CLASS_NAME =
  'tw:relative tw:block tw:w-full tw:cursor-pointer tw:select-none tw:whitespace-nowrap tw:rounded-xl tw:text-left tw:outline-focus-ring tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2';

// The feed timestamps keep their light bubble rather than the default dark
// tooltip; the title span ships tw:text-white, hence the child override.
export const TIMESTAMP_TOOLTIP_CLASS_NAME =
  'tw:bg-overlay-surface tw:*:text-primary';

// Surface, radius, border, height and font size come from the shared
// `.comments-input-field` LESS rule (TaskTabNew renders a real input with it);
// the rest undoes Button's own layout so it reads as an empty input. The text
// colour is important because that rule forces text-primary in dark mode,
// which is meant for typed text, not this placeholder.
export const COMMENTS_TRIGGER_CLASS_NAME =
  'comments-input-field tw:w-full tw:min-w-0 tw:cursor-text tw:justify-start tw:px-[11px] tw:py-1 tw:font-normal tw:text-utility-gray-400!';
