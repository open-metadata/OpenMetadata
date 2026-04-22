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

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import MarketplaceNavBar from '../../components/DataMarketplace/MarketplaceNavBar/MarketplaceNavBar.component';
import PageLayoutV2 from '../../components/PageLayoutV2/PageLayoutV2';
import { useMarketplaceStore } from '../../hooks/useMarketplaceStore';

const MarketplaceLayout = () => {
  const { t } = useTranslation();
  const { setMarketplaceContext } = useMarketplaceStore();

  useEffect(() => {
    setMarketplaceContext(true);

    return () => setMarketplaceContext(false);
  }, []);

  return (
    <PageLayoutV2 pageTitle={t('label.data-marketplace')}>
      <MarketplaceNavBar />
      <Outlet />
    </PageLayoutV2>
  );
};

export default MarketplaceLayout;
