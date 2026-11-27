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
import { useTranslation } from 'react-i18next';
import { GlobalSearchSourceContribution } from './GlobalSearch.types';
import { GlobalSearchSourceRecent } from './useGlobalSearchItems';

/** Loads each plugin source's "recent" rows once per open of the search. */
export const useSourceRecents = (
  sources: GlobalSearchSourceContribution[]
): GlobalSearchSourceRecent[] => {
  const { t } = useTranslation();
  const [recents, setRecents] = useState<GlobalSearchSourceRecent[]>([]);
  const sourceKey = sources.map((source) => source.key).join();

  useEffect(() => {
    const controller = new AbortController();
    const withRecent = sources.filter((source) => source.recent);

    Promise.allSettled(
      // Inside a promise, so a source whose `recent` throws is just skipped.
      withRecent.map((source) =>
        Promise.resolve().then(() => source.recent?.(controller.signal) ?? [])
      )
    ).then((settled) => {
      if (controller.signal.aborted) {
        return;
      }
      setRecents(
        settled.flatMap((result, index) =>
          result.status === 'fulfilled'
            ? [
                {
                  key: withRecent[index].key,
                  label: t(
                    withRecent[index].recentLabelKey ??
                      withRecent[index].labelKey
                  ),
                  rows: result.value,
                },
              ]
            : []
        )
      );
    });

    return () => controller.abort();
    // Contributions are fixed once plugins register; the keys identify them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, t]);

  return recents;
};
