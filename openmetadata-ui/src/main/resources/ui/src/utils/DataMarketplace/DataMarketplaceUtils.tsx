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

import { ReactNode } from 'react';
import MarketplaceDataProductsWidget from '../../components/DataMarketplace/MarketplaceDataProductsWidget/MarketplaceDataProductsWidget.component';
import MarketplaceDomainsWidget from '../../components/DataMarketplace/MarketplaceDomainsWidget/MarketplaceDomainsWidget.component';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';

export const getDataMarketplaceWidgetsFromKey = (
  widgetConfig: WidgetConfig,
  isEditView?: boolean,
  dragHandle?: ReactNode
) => {
  if (
    widgetConfig.i.startsWith(DetailPageWidgetKeys.MARKETPLACE_DATA_PRODUCTS)
  ) {
    return (
      <MarketplaceDataProductsWidget
        dragHandle={dragHandle}
        isEditView={isEditView}
        widgetKey={widgetConfig.i}
      />
    );
  }
  if (widgetConfig.i.startsWith(DetailPageWidgetKeys.MARKETPLACE_DOMAINS)) {
    return (
      <MarketplaceDomainsWidget
        dragHandle={dragHandle}
        isEditView={isEditView}
        widgetKey={widgetConfig.i}
      />
    );
  }

  return null;
};
