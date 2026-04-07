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

import { create } from 'zustand';
import { ROUTES } from '../constants/constants';

interface MarketplaceStore {
  isMarketplace: boolean;
  domainBasePath: string;
  dataProductBasePath: string;
  setMarketplaceContext: (enabled: boolean) => void;
}

export const useMarketplaceStore = create<MarketplaceStore>()((set) => ({
  isMarketplace: false,
  domainBasePath: ROUTES?.DOMAIN ?? '/domain',
  dataProductBasePath: ROUTES?.DATA_PRODUCT ?? '/dataProduct',

  setMarketplaceContext: (enabled: boolean) => {
    set({
      isMarketplace: enabled,
      domainBasePath: enabled
        ? `${ROUTES.DATA_MARKETPLACE}/domains`
        : ROUTES.DOMAIN,
      dataProductBasePath: enabled
        ? `${ROUTES.DATA_MARKETPLACE}/data-products`
        : ROUTES.DATA_PRODUCT,
    });
  },
}));
