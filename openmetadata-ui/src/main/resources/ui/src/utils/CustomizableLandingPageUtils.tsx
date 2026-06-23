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

import { isUndefined } from 'lodash';
import { lazy, Suspense } from 'react';
import WidgetWrapper from '../components/MyData/Widgets/Common/WidgetWrapper/WidgetWrapper';
import type { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import customizeMyDataPageClassBase from './CustomizeMyDataPageClassBase';

const EmptyWidgetPlaceholderV1 = lazy(
  () =>
    import(
      '../components/MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholderV1'
    )
);

/**
 * Renders widget component based on configuration
 */
export const getWidgetFromKey = ({
  currentLayout,
  handleLayoutUpdate,
  handleOpenAddWidgetModal,
  handlePlaceholderWidgetKey,
  handleRemoveWidget,
  handleSaveLayout,
  isEditView,
  personaName,
  widgetConfig,
}: {
  currentLayout?: Array<WidgetConfig>;
  handleLayoutUpdate?: (layout: import('react-grid-layout').Layout[]) => void;
  handleOpenAddWidgetModal?: () => void;
  handlePlaceholderWidgetKey?: (key: string) => void;
  handleRemoveWidget?: (key: string) => void;
  handleSaveLayout?: () => Promise<void>;
  isEditView?: boolean;
  personaName?: string;
  widgetConfig: WidgetConfig;
}) => {
  if (
    widgetConfig.i.endsWith('.EmptyWidgetPlaceholder') &&
    !isUndefined(handleOpenAddWidgetModal) &&
    !isUndefined(handlePlaceholderWidgetKey)
  ) {
    return (
      <Suspense fallback={<WidgetWrapper loading>{null}</WidgetWrapper>}>
        <EmptyWidgetPlaceholderV1
          handleOpenAddWidgetModal={handleOpenAddWidgetModal}
          handlePlaceholderWidgetKey={handlePlaceholderWidgetKey}
          personaName={personaName}
          widgetKey={widgetConfig.i}
        />
      </Suspense>
    );
  }

  const Widget = customizeMyDataPageClassBase.getWidgetsFromKey(widgetConfig.i);

  return (
    <Suspense fallback={<WidgetWrapper loading>{null}</WidgetWrapper>}>
      <Widget
        currentLayout={currentLayout}
        handleLayoutUpdate={handleLayoutUpdate}
        handleRemoveWidget={handleRemoveWidget}
        handleSaveLayout={handleSaveLayout}
        isEditView={isEditView}
        selectedGridSize={widgetConfig.w}
        widgetKey={widgetConfig.i}
      />
    </Suspense>
  );
};
