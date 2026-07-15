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

import { EmptyPlaceholderAction } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';

/**
 * Returns `actions` when the caller supplied a non-empty array, otherwise
 * builds a single primary action from `handler`. When neither is present the
 * placeholder renders without a button.
 */
export const resolveSingleAction = (
  actions: EmptyPlaceholderAction[] | undefined,
  handler: (() => void) | undefined,
  key: string,
  label: ReactNode
): EmptyPlaceholderAction[] | undefined => {
  let resolvedActions = actions;

  if ((!resolvedActions || resolvedActions.length === 0) && handler) {
    resolvedActions = [{ key, label, color: 'primary', onPress: handler }];
  }

  return resolvedActions;
};
