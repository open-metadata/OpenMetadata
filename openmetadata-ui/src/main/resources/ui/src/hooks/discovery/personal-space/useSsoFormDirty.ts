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
import { isEqual } from 'lodash';
import { useRef } from 'react';

/**
 * Whether the settings-modal SSO form holds unsaved edits. A saved setup
 * compares with what is saved; a new one with the provider's template it
 * opened with. Both sides go through `comparable`, because RJSF fills schema
 * defaults in after mount and an untouched form must not read as changed.
 */
export const useSsoFormDirty = <T>({
  hasExistingConfig,
  internalData,
  savedData,
  currentProvider,
  comparable,
}: {
  hasExistingConfig: boolean;
  internalData?: T;
  savedData?: T;
  currentProvider?: string;
  comparable: (data?: T) => unknown;
}): boolean => {
  const template = useRef<{ provider?: string; data?: T }>({});
  if (
    !hasExistingConfig &&
    internalData &&
    template.current.provider !== currentProvider
  ) {
    template.current = { provider: currentProvider, data: internalData };
  }
  const baseline = hasExistingConfig ? savedData : template.current.data;

  return (
    Boolean(internalData) &&
    !isEqual(comparable(internalData), comparable(baseline))
  );
};
