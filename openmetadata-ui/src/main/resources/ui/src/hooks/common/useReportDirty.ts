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
import { useEffect, useState } from 'react';

/** Tells the caller whether an editor's draft differs from what it opened with. */
export const useReportDirty = (
  draft: unknown,
  onDirtyChange?: (isDirty: boolean) => void
) => {
  const [initialDraft] = useState(draft);
  const isDirty = !isEqual(initialDraft, draft);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
};
