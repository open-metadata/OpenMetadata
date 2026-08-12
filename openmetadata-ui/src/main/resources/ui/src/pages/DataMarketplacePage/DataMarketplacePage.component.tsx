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

import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import {
  CSSProperties,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import marketplaceBg from '../../assets/img/widgets/marketplace-bg.png';
import Loader from '../../components/common/Loader/Loader';
import AnnouncementsWidgetV2 from '../../components/DataMarketplace/AnnouncementsWidgetV2/AnnouncementsWidgetV2.component';
import MarketplaceGreetingBanner from '../../components/DataMarketplace/MarketplaceGreetingBanner/MarketplaceGreetingBanner.component';
import MarketplaceSearchBar from '../../components/DataMarketplace/MarketplaceSearchBar/MarketplaceSearchBar.component';
import { TAB_GRID_MAX_COLUMNS } from '../../constants/CustomizeWidgets.constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { Page, PageType } from '../../generated/system/ui/page';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { getDocumentByFQN } from '../../rest/DocStoreAPI';
import { getWidgetsFromKey } from '../../utils/CustomizePage/CustomizePageDispatchUtils';
import { getLayoutFromCustomizedPage } from '../../utils/CustomizePage/CustomizePageWidgetUtils';
import dataMarketplaceClassBase from '../../utils/DataMarketplace/DataMarketplaceClassBase';
import { showErrorToast } from '../../utils/ToastUtils';
import { WidgetConfig } from '../CustomizablePage/CustomizablePage.interface';
import './data-marketplace-page.less';

// The reader renders the widgets as a plain column: the layout here is always a
// single full-width stack (`normalizeLayout` forces w/x and sorts by y) and the
// grid was static anyway. A fixed-pitch grid sized every slot the same whatever
// the widget held, so the visible gap was the grid's 30px margin minus however
// far the panel overflowed its slot — 19px when empty, 17px with cards, and it
// grew to 49px once the taller placeholder needed a second row. 18px holds the
// spacing the grid used to land on, now identically for every widget. The
// customize page still uses the grid, which is where drag and resize happen.
const WIDGET_GAP = 18;

// In AI mode the caller's `HeaderShell` owns the 20px gap to the content below
// through its own bottom margin, matching the Domains/Data Products list pages —
// the column must not stack another offset on top of it. The classic hero keeps
// the original 8px offset it was designed against.
const AI_MODE_GRID_STYLE = { gap: WIDGET_GAP, marginTop: 0 };
const CLASSIC_GRID_STYLE = { gap: WIDGET_GAP, marginTop: 8 };

const normalizeLayout = (l: WidgetConfig[]) =>
  l
    .map((widget) => ({
      ...widget,
      w: TAB_GRID_MAX_COLUMNS,
      x: 0,
    }))
    .sort((a, b) => a.y - b.y);

interface DataMarketplacePageProps {
  /**
   * Optional page-header renderer. When provided (AI mode), it replaces the
   * default greeting-banner + search hero — the caller's header owns the
   * title, breadcrumb, search and actions. Omit for the classic hero.
   */
  renderPageHeader?: () => ReactNode;
}

const DataMarketplacePage = ({
  renderPageHeader,
}: DataMarketplacePageProps) => {
  const { selectedPersona } = useApplicationStore();
  const { i18n } = useTranslation();

  const defaultLayout = useMemo(
    () => dataMarketplaceClassBase.getDefaultLayout(EntityTabs.OVERVIEW),
    []
  );

  const [isLoading, setIsLoading] = useState(true);
  const [layout, setLayout] = useState<Array<WidgetConfig>>(() => [
    ...defaultLayout,
  ]);

  const fetchDocument = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!selectedPersona) {
        setLayout(defaultLayout);

        return;
      }

      const pageFQN = `${EntityType.PERSONA}.${selectedPersona.fullyQualifiedName}`;
      const docData = await getDocumentByFQN(pageFQN);

      const pageData = docData.data?.pages?.find(
        (p: Page) => p.pageType === PageType.DataMarketplace
      );

      const tabLayout = getLayoutFromCustomizedPage(
        PageType.DataMarketplace,
        EntityTabs.OVERVIEW,
        pageData
      ) as WidgetConfig[];

      if (!isEmpty(tabLayout)) {
        setLayout(normalizeLayout(tabLayout));
      } else if (pageData && !isEmpty(pageData.layout)) {
        setLayout(normalizeLayout(pageData.layout as WidgetConfig[]));
      } else {
        setLayout(defaultLayout);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
      setLayout(defaultLayout);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPersona, defaultLayout]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  // Depend on the resolved direction, not the i18n instance: the instance
  // reference survives a language change, so memoising on it would keep a stale
  // dir if the language ever changes without remounting this route.
  const direction = i18n.dir();

  const widgets = useMemo(
    () =>
      layout.map((widget) => (
        <div dir={direction} key={widget.i}>
          {getWidgetsFromKey(PageType.DataMarketplace, widget)}
        </div>
      )),
    [layout, direction]
  );

  if (isLoading) {
    return <Loader />;
  }

  const gridWrapperClassName = `marketplace-grid-wrapper${
    renderPageHeader ? ' tw:!max-w-none' : ''
  }`;

  return (
    <div className="tw:h-full tw:overflow-y-auto">
      <div className="tw:mb-8">
        {renderPageHeader ? (
          <div className={gridWrapperClassName} dir="ltr">
            <div className="tw:px-2 tw:pt-2">{renderPageHeader()}</div>
          </div>
        ) : (
          <div
            className="marketplace-header-bg"
            style={
              { '--marketplace-bg': `url(${marketplaceBg})` } as CSSProperties
            }>
            <div className="marketplace-grid-wrapper" dir="ltr">
              <div className="p-x-box">
                <MarketplaceGreetingBanner />
                <MarketplaceSearchBar />
              </div>
            </div>
          </div>
        )}
        <div className={gridWrapperClassName} dir="ltr">
          <div className="p-x-box">
            <AnnouncementsWidgetV2 widgetKey="announcements" />
          </div>
          <div
            className="grid-container p-x-box tw:flex tw:flex-col"
            style={renderPageHeader ? AI_MODE_GRID_STYLE : CLASSIC_GRID_STYLE}>
            {widgets}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataMarketplacePage;
