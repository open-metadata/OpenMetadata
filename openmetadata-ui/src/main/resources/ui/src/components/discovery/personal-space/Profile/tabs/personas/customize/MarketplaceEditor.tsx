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

import { Box } from '@openmetadata/ui-core-components';
import { DotsGrid } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import RGL, {
    Layout,
    ReactGridLayoutProps,
    WidthProvider
} from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { TAB_GRID_MAX_COLUMNS } from '../../../../../../../constants/CustomizeWidgets.constants';
import { EntityTabs } from '../../../../../../../enums/entity.enum';
import { Page, PageType } from '../../../../../../../generated/system/ui/page';
import { useGridLayoutDirection } from '../../../../../../../hooks/useGridLayoutDirection';
import { WidgetConfig } from '../../../../../../../interface/customization.interface';
import { useCustomizeStore } from '../../../../../../../pages/CustomizablePage/CustomizeStore';
import {
    normalizePersonaDocument,
    updatePersonaDocumentPage
} from '../../../../../../../utils/CustomizePage/PersonaPage.utils';
import dataMarketplaceClassBase from '../../../../../../../utils/DataMarketplace/DataMarketplaceClassBase';
import { getDataMarketplaceWidgetsFromKey } from '../../../../../../../utils/DataMarketplace/DataMarketplaceUtils';
import {
    showErrorToast,
    showSuccessToast
} from '../../../../../../../utils/ToastUtils';
import MarketplaceOverviewHeader from '../../../../../../governance/marketplace/MarketplaceOverviewHeader/MarketplaceOverviewHeader';
import '../../../../../../MyData/CustomizableComponents/CustomizeMyData/customize-my-data.less';
import { CustomizeEditorProps } from './customizeEditor.types';
import { savePersonaDocument } from './customizeEditor.utils';

const ReactGridLayout = WidthProvider(RGL) as React.ComponentType<
  ReactGridLayoutProps & { children?: React.ReactNode }
>;

const ROW_HEIGHT = 170;
const WIDGET_MARGIN: [number, number] = [16, 18];
const PAGE_TYPE = PageType.DataMarketplace;

// `marketplace-drag-handle` is the react-grid-layout drag selector.
const DRAG_HANDLE_CLASS = [
  'marketplace-drag-handle tw:flex tw:size-10 tw:cursor-move tw:items-center',
  'tw:justify-center tw:rounded-md tw:border tw:border-secondary',
  'tw:text-fg-secondary tw:hover:bg-primary_hover',
].join(' ');

const dragHandle = (
  <div className={DRAG_HANDLE_CLASS}>
    <DotsGrid className="tw:size-4" />
  </div>
);

const normalizeWidget = (widget: WidgetConfig): WidgetConfig => ({
  ...widget,
  w: TAB_GRID_MAX_COLUMNS,
  x: 0,
});

const MarketplaceEditor = ({
  document,
  onDocumentSaved,
  onActionsChange,
}: CustomizeEditorProps) => {
  const { t } = useTranslation();
  const {
    currentPage,
    currentPageType,
    updateCurrentPage,
    setDocument,
    setCurrentPageType,
  } = useCustomizeStore();

  const defaultLayout = useMemo(
    () =>
      dataMarketplaceClassBase
        .getDefaultLayout(EntityTabs.OVERVIEW)
        .map(normalizeWidget),
    []
  );

  const savedLayout = useMemo(() => {
    const page = ((document.data.pages ?? []) as Page[]).find(
      (p) => p.pageType === PAGE_TYPE
    );

    return page?.tabs?.[0]?.layout as WidgetConfig[] | undefined;
  }, [document]);

  const [layout, setLayout] = useState<WidgetConfig[]>(() =>
    isEmpty(savedLayout)
      ? defaultLayout
      : (savedLayout ?? []).map(normalizeWidget)
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      setDocument(document);
      setCurrentPageType(PAGE_TYPE);
      initialized.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useGridLayoutDirection();

  const buildPage = useCallback(
    (nextLayout: WidgetConfig[]): Page => {
      const tabs = currentPage?.tabs ?? [
        {
          ...dataMarketplaceClassBase.getDataMarketplaceDetailPageTabsIds()[0],
        },
      ];

      return {
        ...currentPage,
        pageType: (currentPageType as PageType) ?? PAGE_TYPE,
        tabs: tabs.map((tab, i) =>
          i === 0 ? { ...tab, layout: nextLayout } : tab
        ),
      } as Page;
    },
    [currentPage, currentPageType]
  );

  const handleLayoutUpdate = useCallback(
    (updatedLayout: Layout[]) => {
      // react-grid-layout also reports the layout on mount; only an actual
      // reorder counts as an edit.
      const isReordered = updatedLayout.some(
        (item) => layout.find((w) => w.i === item.i)?.y !== item.y
      );
      if (!isReordered) {
        return;
      }

      const newLayout = updatedLayout.map(
        (item) =>
          ({
            ...layout.find((w) => w.i === item.i),
            ...item,
            w: TAB_GRID_MAX_COLUMNS,
            x: 0,
            static: false,
          } as WidgetConfig)
      );
      setLayout(newLayout);
      setIsDirty(true);
      updateCurrentPage(buildPage(newLayout));
    },
    [layout, buildPage, updateCurrentPage]
  );

  const handleReset = useCallback(() => {
    setLayout(defaultLayout);
    setIsDirty(true);
    updateCurrentPage(buildPage(defaultLayout));
  }, [defaultLayout, buildPage, updateCurrentPage]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const newPage = buildPage(layout);
      const saved = await savePersonaDocument(document, (draft) => {
        draft.data = updatePersonaDocumentPage(draft, PAGE_TYPE, newPage).data;
      });
      const normalized = normalizePersonaDocument(saved);
      setDocument(normalized);
      onDocumentSaved(normalized);
      setIsDirty(false);
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.data-marketplace'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  }, [buildPage, layout, document, setDocument, onDocumentSaved, t]);

  useEffect(() => {
    onActionsChange({
      onSave: handleSave,
      onReset: handleReset,
      canSave: isDirty,
      isSaving,
    });
  }, [handleSave, handleReset, isDirty, isSaving, onActionsChange]);

  const widgets = useMemo(
    () =>
      layout.map((widget) => (
        <div data-grid={widget} key={widget.i}>
          {getDataMarketplaceWidgetsFromKey(widget, true, dragHandle)}
        </div>
      )),
    [layout]
  );

  return (
    <Box data-testid="marketplace-editor" direction="col">
      {/* Mirrors the AI-mode DataMarketplacePage chrome: header band 8px in,
          widget column on the 16px gutter with the same 18px gap. */}
      <div className="tw:px-2 tw:pt-2">
        <MarketplaceOverviewHeader isCustomizeView />
      </div>
      <div dir="ltr">
        {/* grid-container: shared drop-placeholder colour (customize-my-data.less). */}
        <ReactGridLayout
          useCSSTransforms
          verticalCompact
          className="grid-container tw:mt-6 tw:select-none"
          cols={TAB_GRID_MAX_COLUMNS}
          compactType="vertical"
          draggableHandle=".marketplace-drag-handle"
          isResizable={false}
          margin={WIDGET_MARGIN}
          rowHeight={ROW_HEIGHT}
          onLayoutChange={handleLayoutUpdate}>
          {widgets}
        </ReactGridLayout>
      </div>
    </Box>
  );
};

export default MarketplaceEditor;
