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
import { useState } from 'react';

/**
 * Core date pickers show Apply and Cancel but report every pick through
 * `onChange`. Spread the result on a picker to hold picks locally, commit them
 * on Apply, and drop them on Cancel or any other close.
 */
export const useStagedPickerValue = <T>(
  committed: T,
  commit: (value: T) => void
) => {
  // `undefined` means nothing is staged; `null` is a real (cleared) pick.
  const [draft, setDraft] = useState<T | undefined>(undefined);

  return {
    value: draft === undefined ? committed : draft,
    onChange: (value: T) => setDraft(value),
    onApply: () => {
      if (draft !== undefined) {
        commit(draft);
      }
      setDraft(undefined);
    },
    onCancel: () => setDraft(undefined),
    onOpenChange: (isOpen: boolean) => {
      if (!isOpen) {
        setDraft(undefined);
      }
    },
  };
};
