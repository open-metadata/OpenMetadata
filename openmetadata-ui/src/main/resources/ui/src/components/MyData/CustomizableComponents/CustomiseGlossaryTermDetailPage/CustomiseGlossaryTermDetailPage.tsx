/*
 *  Copyright 2023 Collate.
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

import { Modal } from 'antd';
import { isEmpty, noop } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import RGL, { Layout, WidthProvider } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import gridBgImg from '../../../../assets/img/grid-bg-img.png';
import { Page } from '../../../../generated/system/ui/page';
import { useGridLayoutDirection } from '../../../../hooks/useGridLayoutDirection';
import { WidgetConfig } from '../../../../pages/CustomizablePage/CustomizablePage.interface';
import { useCustomizeStore } from '../../../../pages/CustomizablePage/CustomizeStore';
import '../../../../pages/MyDataPage/my-data.less';
import customizeGlossaryTermPageClassBase from '../../../../utils/CustomiseGlossaryTermPage/CustomizeGlossaryTermPage';
import {
  getLayoutUpdateHandler,
  getLayoutWithEmptyWidgetPlaceholder,
  getUniqueFilteredLayout,
} from '../../../../utils/CustomizableLandingPageUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { getWidgetFromKey } from '../../../../utils/GlossaryTerm/GlossaryTermUtil';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import { CustomizablePageHeader } from '../CustomizablePageHeader/CustomizablePageHeader';
import { CustomizeMyDataProps } from '../CustomizeMyData/CustomizeMyData.interface';

const ReactGridLayout = WidthProvider(RGL);

function CustomizeGlossaryTermDetailPage({
  personaDetails,
  onSaveLayout,
}: Readonly<CustomizeMyDataProps>) {
  const { t } = useTranslation();
  const { currentPage, currentPageType } = useCustomizeStore();

  const [layout, setLayout] = useState<Array<WidgetConfig>>(
    (currentPage?.layout as WidgetConfig[]) ??
      customizeGlossaryTermPageClassBase.defaultLayout
  );

  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);

  const handleLayoutUpdate = useCallback(
    (updatedLayout: Layout[]) => {
      if (!isEmpty(layout) && !isEmpty(updatedLayout)) {
        setLayout(getLayoutUpdateHandler(updatedLayout));
      }
    },
    [layout]
  );

  const handleOpenResetModal = useCallback(() => {
    setIsResetModalOpen(true);
  }, []);

  const handleCloseResetModal = useCallback(() => {
    setIsResetModalOpen(false);
  }, []);

  const widgets = useMemo(
    () =>
      layout.map((widget) => (
        <div data-grid={widget} id={widget.i} key={widget.i}>
          {getWidgetFromKey({
            widgetConfig: widget,
            handleOpenAddWidgetModal: noop,
            handlePlaceholderWidgetKey: noop,
            handleRemoveWidget: noop,
            isEditView: true,
          })}
        </div>
      )),
    [layout]
  );

  const handleReset = useCallback(() => {
    // Get default layout with the empty widget added at the end
    const newMainPanelLayout = getLayoutWithEmptyWidgetPlaceholder(
      customizeGlossaryTermPageClassBase.defaultLayout,
      2,
      4
    );
    setLayout(newMainPanelLayout);
    onSaveLayout({
      ...(currentPage as Page),
      layout: getUniqueFilteredLayout(newMainPanelLayout),
    });
    setIsResetModalOpen(false);
  }, []);

  const handleSave = async () => {
    await onSaveLayout({
      ...(currentPage ?? ({ pageType: currentPageType } as Page)),
      layout: getUniqueFilteredLayout(layout),
    });
  };

  // call the hook to set the direction of the grid layout
  useGridLayoutDirection();

  return (
    <>
      <PageLayoutV1
        mainContainerClassName="p-t-0"
        pageContainerStyle={{
          backgroundImage: `url(${gridBgImg})`,
        }}
        pageTitle={t('label.customize-entity', {
          entity: t('label.landing-page'),
        })}>
        <CustomizablePageHeader
          personaName={getEntityName(personaDetails)}
          onReset={handleOpenResetModal}
          onSave={handleSave}
        />
        <ReactGridLayout
          verticalCompact
          className="grid-container"
          cols={8}
          draggableHandle=".drag-widget-icon"
          isResizable={false}
          margin={[
            customizeGlossaryTermPageClassBase.detailPageWidgetMargin,
            customizeGlossaryTermPageClassBase.detailPageWidgetMargin,
          ]}
          rowHeight={customizeGlossaryTermPageClassBase.detailPageRowHeight}
          onLayoutChange={handleLayoutUpdate}>
          {widgets}
        </ReactGridLayout>
      </PageLayoutV1>

      {isResetModalOpen && (
        <Modal
          centered
          cancelText={t('label.no')}
          data-testid="reset-layout-modal"
          okText={t('label.yes')}
          open={isResetModalOpen}
          title={t('label.reset-default-layout')}
          onCancel={handleCloseResetModal}
          onOk={handleReset}>
          {t('message.reset-layout-confirmation')}
        </Modal>
      )}
    </>
  );
}

export default CustomizeGlossaryTermDetailPage;
