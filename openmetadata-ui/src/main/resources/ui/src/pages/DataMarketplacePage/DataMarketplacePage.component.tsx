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
import { EntityType } from '../../enums/entity.enum';
import { Page, PageType } from '../../generated/system/ui/page';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useGridLayoutDirection } from '../../hooks/useGridLayoutDirection';
import { getDocumentByFQN } from '../../rest/DocStoreAPI';
import { getWidgetFromKey } from '../../utils/CustomizableLandingPageUtils';
import customizePageClassBase from '../../utils/CustomizeMyDataPageClassBase';
import { getCustomizePagePath } from '../../utils/GlobalSettingsUtils';
import { WidgetConfig } from '../CustomizablePage/CustomizablePage.interface';
import './data-marketplace-page.less';

const ReactGridLayout = WidthProvider(RGL) as React.ComponentType<
  ReactGridLayoutProps & { children?: React.ReactNode }
>;

const MARKETPLACE_ROW_HEIGHT = 200;

const DataMarketplacePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedPersona } = useApplicationStore();

  const [isLoading, setIsLoading] = useState(true);
  const [layout, setLayout] = useState<Array<WidgetConfig>>(
    customizePageClassBase.marketplaceDefaultLayout
  );

  useGridLayoutDirection(false);

  const fetchDocument = useCallback(async () => {
    try {
      setIsLoading(true);
      if (selectedPersona) {
        const pageFQN = `${EntityType.PERSONA}.${selectedPersona.fullyQualifiedName}`;
        const docData = await getDocumentByFQN(pageFQN);

        const pageData = docData.data?.pages?.find(
          (p: Page) => p.pageType === PageType.DataMarketplace
        ) ?? { layout: [], pageType: PageType.DataMarketplace };

        const savedLayout = pageData.layout as WidgetConfig[];

        setLayout(
          isEmpty(savedLayout)
            ? customizePageClassBase.marketplaceDefaultLayout
            : savedLayout
        );
      } else {
        setLayout(customizePageClassBase.marketplaceDefaultLayout);
      }
    } catch {
      setLayout(customizePageClassBase.marketplaceDefaultLayout);
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
          {getWidgetFromKey({
            widgetConfig: widget,
            currentLayout: layout,
          })}
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
          cols={customizePageClassBase.landingPageMaxGridSize}
          containerPadding={[0, 0]}
          isDraggable={false}
          isResizable={false}
          margin={[
            customizePageClassBase.landingPageWidgetMargin,
            8,
          ]}
          rowHeight={MARKETPLACE_ROW_HEIGHT}>
          {widgets}
        </ReactGridLayout>
      </div>
    </PageLayoutV1>
  );
};

export default DataMarketplacePage;
