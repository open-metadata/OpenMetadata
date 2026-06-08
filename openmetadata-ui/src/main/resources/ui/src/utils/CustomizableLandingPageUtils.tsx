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

export {
  ensurePlaceholderAtEnd,
  getAddWidgetHandler,
  getConstrainedWidgetWidth,
  getLandingPageLayoutWithEmptyWidgetPlaceholder,
  getLayoutUpdateHandler,
  getLayoutWithEmptyWidgetPlaceholder,
  getNewWidgetPlacement,
  getRemoveWidgetHandler,
  getUniqueFilteredLayout,
  getWidgetWidthLabelFromKey,
  separateWidgets,
} from './CustomizableLandingPagePureUtils';

import Icon from '@ant-design/icons';
import { isUndefined } from 'lodash';
import { DOMAttributes, Suspense } from 'react';
import { ReactComponent as ArrowRightIcon } from '../assets/svg/arrow-right.svg';
import EmptyWidgetPlaceholderV1 from '../components/MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholderV1';
import WidgetWrapper from '../components/MyData/Widgets/Common/WidgetWrapper/WidgetWrapper';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import customizeMyDataPageClassBase from './CustomizeMyDataPageClassBase';

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
      <EmptyWidgetPlaceholderV1
        handleOpenAddWidgetModal={handleOpenAddWidgetModal}
        handlePlaceholderWidgetKey={handlePlaceholderWidgetKey}
        personaName={personaName}
        widgetKey={widgetConfig.i}
      />
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

/**
 * Custom arrow components for carousel navigation
 */
export const CustomNextArrow = (props: DOMAttributes<HTMLDivElement>) => (
  <Icon
    className="custom-arrow right-arrow"
    component={ArrowRightIcon}
    onClick={props.onClick}
  />
);

export const CustomPrevArrow = (props: DOMAttributes<HTMLDivElement>) => (
  <Icon
    className="custom-arrow left-arrow"
    component={ArrowRightIcon}
    onClick={props.onClick}
  />
);

