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
import { useEffect, useState } from 'react';

/**
 * Tracks which tabs have been selected at least once. Core `Tabs.Panel` only
 * mounts the selected panel; pass `shouldForceMount={visitedTabs.has(key)}` and
 * `className="tw:data-inert:hidden"` to keep panels holding local state (drafts,
 * filters, form edits) alive across tab switches, while still mounting lazily.
 */
export const useVisitedTabs = (activeKey: string) => {
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(
    () => new Set([activeKey])
  );

  useEffect(() => {
    setVisitedTabs((prev) =>
      prev.has(activeKey) ? prev : new Set(prev).add(activeKey)
    );
  }, [activeKey]);

  return visitedTabs;
};
