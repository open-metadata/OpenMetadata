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

import { KeyboardEvent } from 'react';
import { NavigatorHelper } from './NavigatorUtils';

export enum Keys {
  K = 'k',
  ESC = 'Escape',
}

/**
 * Returns an `onKeyDown` handler that runs `callback` when Enter or Space is
 * pressed (preventing the default scroll/submit) — used to make a non-native
 * clickable element keyboard-operable.
 *
 * @param callback   action to run on activation.
 * @param onlyIfSelf when true, ignores keydowns that bubbled up from nested
 *   interactive children (guards on `target === currentTarget`) — for clickable
 *   containers that also hold real controls.
 */
export const handleKeyboardActivation =
  (callback: () => void, onlyIfSelf = false) =>
  (event: KeyboardEvent): void => {
    if (onlyIfSelf && event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  };

export const isCommandKeyPress = (event: KeyboardEvent): boolean => {
  if (NavigatorHelper.isMacOs()) {
    return event.metaKey;
  } else if (!NavigatorHelper.isMacOs()) {
    return event.ctrlKey;
  }

  return false;
};
