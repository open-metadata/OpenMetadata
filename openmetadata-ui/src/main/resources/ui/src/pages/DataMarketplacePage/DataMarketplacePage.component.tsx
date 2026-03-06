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

import { Button } from 'antd';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import RGL, { ReactGridLayoutProps, WidthProvider } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import MarketplaceGreetingBanner from '../../components/DataMarketplace/MarketplaceGreetingBanner/MarketplaceGreetingBanner.component';
import MarketplaceSearchBar from '../../components/DataMarketplace/MarketplaceSearchBar/MarketplaceSearchBar.component';
import Loader from '../../components/common/Loader/Loader';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { TAB_GRID_MAX_COLUMNS } from '../../constants/CustomizeWidgets.constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { Page, PageType } from '../../generated/system/ui/page';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useGridLayoutDirection } from '../../hooks/useGridLayoutDirection';
import { getDocumentByFQN } from '../../rest/DocStoreAPI';
import {
  getLayoutFromCustomizedPage,
  getWidgetsFromKey,
} from '../../utils/CustomizePage/CustomizePageUtils';
import dataMarketplaceClassBase from '../../utils/DataMarketplace/DataMarketplaceClassBase';
import { getCustomizePagePath } from '../../utils/GlobalSettingsUtils';
import { WidgetConfig } from '../CustomizablePage/CustomizablePage.interface';
import './data-marketplace-page.less';

const ReactGridLayout = WidthProvider(RGL) as React.ComponentType<
  ReactGridLayoutProps & { children?: React.ReactNode }
>;

const DataMarketplacePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedPersona } = useApplicationStore();

  const defaultLayout = dataMarketplaceClassBase.getDefaultLayout(
    EntityTabs.OVERVIEW
  );

  const [isLoading, setIsLoading] = useState(true);
  const [layout, setLayout] = useState<Array<WidgetConfig>>(defaultLayout);

  useGridLayoutDirection(false);

  const fetchDocument = useCallback(async () => {
    try {
      setIsLoading(true);
      if (selectedPersona) {
        const pageFQN = `${EntityType.PERSONA}.${selectedPersona.fullyQualifiedName}`;
        const docData = await getDocumentByFQN(pageFQN);

        const pageData = docData.data?.pages?.find(
          (p: Page) => p.pageType === PageType.DataMarketplace
        );

        // Try tab-based layout first (new format)
        const tabLayout = getLayoutFromCustomizedPage(
          PageType.DataMarketplace,
          EntityTabs.OVERVIEW,
          pageData
        ) as WidgetConfig[];

        if (!isEmpty(tabLayout)) {
          setLayout(tabLayout);
        } else if (!isEmpty(pageData?.layout)) {
          // Fallback to flat layout (old format)
          setLayout(pageData?.layout as WidgetConfig[]);
        } else {
          setLayout(defaultLayout);
        }
      } else {
        setLayout(defaultLayout);
      }
    } catch {
      setLayout(defaultLayout);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPersona]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const handleCustomize = useCallback(() => {
    if (selectedPersona?.fullyQualifiedName) {
      navigate(
        getCustomizePagePath(
          selectedPersona.fullyQualifiedName,
          PageType.DataMarketplace
        )
      );
    }
  }, [navigate, selectedPersona]);

  const widgets = useMemo(
    () =>
      layout.map((widget) => (
        <div data-grid={widget} key={widget.i}>
          {getWidgetsFromKey(PageType.DataMarketplace, widget)}
        </div>
      )),
    [layout]
  );

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1
      mainContainerClassName="p-t-0 data-marketplace-main-container"
      pageTitle={t('label.data-marketplace')}>
      <div className="marketplace-grid-wrapper" dir="ltr">
        <div className="p-x-box">
          <div className="d-flex justify-end m-b-sm">
            {selectedPersona && (
              <Button
                data-testid="customize-marketplace-btn"
                onClick={handleCustomize}>
                {t('label.customize')}
              </Button>
            )}
          </div>
          <MarketplaceGreetingBanner />
          <MarketplaceSearchBar />
        </div>
        <ReactGridLayout
          className="grid-container p-x-box"
          cols={TAB_GRID_MAX_COLUMNS}
          containerPadding={[0, 0]}
          isDraggable={false}
          isResizable={false}
          margin={[16, 8]}
          rowHeight={100}>
          {widgets}
        </ReactGridLayout>
      </div>
    </PageLayoutV1>
  );
};

export default DataMarketplacePage;
