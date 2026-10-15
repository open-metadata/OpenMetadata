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
import { ServiceCategory } from '../../../enums/service.enum';
import { Include } from '../../../generated/type/include';
import {
  countServiceChildren,
  getSecondaryAssetTabs,
} from './connectionServiceChildren.utils';

export const DATA_ASSETS_TAB_KEY = 'dataAssets';

/**
 * The tab-label counts of a service's asset tabs, keyed by tab: the data-assets tab and each
 * secondary tab (data models, files, spreadsheets). Fetched apart from the lists, as a tab's list
 * loads only once the tab is opened while its count shows from the start. A count that fails to
 * load is left out, so its tab shows no badge rather than a wrong one.
 */
export const useServiceAssetCounts = (
  serviceCategory: ServiceCategory,
  serviceFqn: string,
  include: Include
) => {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // A slower answer for the previous service or Deleted setting must not land after this one.
    let isCurrent = true;
    setCounts({});
    const counters = [
      {
        key: DATA_ASSETS_TAB_KEY,
        count: () => countServiceChildren(serviceCategory, serviceFqn, include),
      },
      ...getSecondaryAssetTabs(serviceCategory).map(({ key, countAssets }) => ({
        key,
        count: () => countAssets(serviceFqn, include),
      })),
    ];

    if (serviceFqn) {
      void Promise.allSettled(counters.map(({ count }) => count())).then(
        (results) => {
          const loaded: Record<string, number> = {};
          results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value !== undefined) {
              loaded[counters[index].key] = result.value;
            }
          });
          if (isCurrent) {
            setCounts(loaded);
          }
        }
      );
    }

    return () => {
      isCurrent = false;
    };
  }, [serviceCategory, serviceFqn, include]);

  return counts;
};
