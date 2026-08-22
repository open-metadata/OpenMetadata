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

import { useIsAiMode } from '../../../../hooks/useAppMode';
import DataMarketplacePage from '../../../../pages/DataMarketplacePage/DataMarketplacePage.component';
import MarketplaceOverviewHeader from '../MarketplaceOverviewHeader/MarketplaceOverviewHeader';

/**
 * Marketplace overview route. In AI mode the classic greeting-banner + search
 * hero is replaced by the shared `HeaderShell` page header (breadcrumb, title,
 * subtitle, search + Add New); classic mode keeps the default overview chrome.
 */
const MarketplaceOverviewPage = () => {
  const isAiMode = useIsAiMode();

  return (
    <DataMarketplacePage
      renderPageHeader={
        isAiMode ? () => <MarketplaceOverviewHeader /> : undefined
      }
    />
  );
};

export default MarketplaceOverviewPage;
